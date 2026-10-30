/**
 * BoltHaven Browser Companion — Content Script for ChatGPT (chatgpt.com)
 * Handles automated prompt injection, image attachment, sending, and completion detection.
 */

(() => {
  if (window.__bolthaven_injected) return;
  window.__bolthaven_injected = true;

  console.log('[BOLTHAVEN] ChatGPT Tab Worker injected into:', window.location.href);

  // ── Auto Keep-Alive & Wakeup Bridge ───────────────────────────────────────
  // Automatically keeps the background service worker awake and triggers polling
  // so the user NEVER has to manually click the extension icon.
  let keepAlivePort = null;
  function connectKeepAlive() {
    try {
      if (!keepAlivePort) {
        keepAlivePort = chrome.runtime.connect({ name: 'bolthaven-worker-keepalive' });
        keepAlivePort.onDisconnect.addListener(() => {
          keepAlivePort = null;
          setTimeout(connectKeepAlive, 1500);
        });
      }
      // Send wake-up message to ensure background worker immediately polls companion
      chrome.runtime.sendMessage({ action: 'WAKE_UP_AND_POLL', url: window.location.href }).catch(() => {});
    } catch (e) {
      keepAlivePort = null;
      setTimeout(connectKeepAlive, 2500);
    }
  }

  // Connect on tab load
  connectKeepAlive();
  // Continuously ping every 3 seconds to guarantee background service worker stays awake
  setInterval(connectKeepAlive, 3000);

  // Helper to wait for element
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }, timeout);
    });
  }

  // Find ChatGPT prompt input
  function findPromptInput() {
    return (
      document.querySelector('#prompt-textarea') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('textarea[data-id="root"]') ||
      document.querySelector('textarea')
    );
  }

  // Safely click an element with complete synthetic pointer, mouse, and click events
  function clickElementSafely(el) {
    if (!el) return;
    try {
      el.focus();
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.click();
    } catch (e) {
      el.click();
    }
  }

  // Find ChatGPT send button (supporting all modern ChatGPT layouts and icon buttons)
  function findSendButton() {
    const composer = getComposerContainer() || document.querySelector('form') || document;
    // 1. Explicit modern attributes inside composer or document
    const explicit = (
      composer.querySelector('button[data-testid="send-button"]') ||
      composer.querySelector('button[data-testid="composer-send-button"]') ||
      composer.querySelector('button[data-testid="fruitjuice-send-button"]') ||
      composer.querySelector('button[aria-label="Send prompt"]') ||
      composer.querySelector('button[aria-label="Send message"]') ||
      composer.querySelector('button[aria-label="Send"]') ||
      composer.querySelector('button[aria-label*="Send" i]') ||
      composer.querySelector('button[data-testid*="send" i]')
    );
    if (explicit) return explicit;

    // 2. Search composer toolbar for the send button (with SVG up-arrow)
    // EXCLUDE model pickers, attach button, mic, voice, reason, etc.!
    const buttons = Array.from(composer.querySelectorAll('button:not(:disabled)')).filter((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const testid = (b.getAttribute('data-testid') || '').toLowerCase();
      const text = (b.innerText || b.textContent || '').toLowerCase();

      // Exclude model picker (contains "gpt", "sol", "light", "medium", "o1", "o3", "4o", "model")
      if (
        text.includes('gpt') ||
        text.includes('sol') ||
        text.includes('light') ||
        text.includes('medium') ||
        text.includes('model') ||
        aria.includes('model') ||
        aria.includes('switch') ||
        testid.includes('model')
      ) {
        return false;
      }

      // Exclude attachment, mic, voice, search, reason
      if (
        aria.includes('voice') ||
        aria.includes('dictate') ||
        aria.includes('record') ||
        aria.includes('attach') ||
        aria.includes('plus') ||
        aria.includes('search') ||
        aria.includes('reason') ||
        aria.includes('canvas') ||
        testid.includes('attach') ||
        testid.includes('voice') ||
        testid.includes('mic')
      ) {
        return false;
      }
      return true;
    });

    if (buttons.length > 0) {
      // Sort buttons by rect.right descending: The send button is ALWAYS the rightmost circular button on the toolbar!
      buttons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
      return buttons[0];
    }

    return null;
  }

  // Check if send button is actually interactive and ready
  function isSendButtonReady(btn) {
    if (!btn) return false;
    if (btn.disabled) return false;
    if (btn.getAttribute('aria-disabled') === 'true') return false;
    if (btn.classList.contains('disabled')) return false;
    return true;
  }

  // Wait for the attachment thumbnail in composer to finish uploading to OpenAI server
  async function waitForAttachmentUploadComplete(composerEl, maxWaitMs = 15000) {
    const deadline = Date.now() + maxWaitMs;
    console.log('[BOLTHAVEN] Checking attachment upload status in composer...');
    while (Date.now() < deadline) {
      if (activeJobAborted) return false;
      const composer = composerEl || getComposerContainer() || document.querySelector('form') || document;

      // Look for upload progress spinner ONLY inside thumbnail cards above prompt area
      const cards = getAttachmentThumbnailCards(composer.querySelector('#prompt-textarea') || composer);
      let cardUploading = false;
      for (const card of cards) {
        const spinner = card.querySelector('circle, svg.animate-spin, [class*="animate-spin"], [role="progressbar"], [class*="loading"]');
        if (spinner) {
          cardUploading = true;
          break;
        }
      }

      const sendBtn = findSendButton();
      const sendReady = isSendButtonReady(sendBtn);

      // If cards are not actively spinning AND the send button is ready, attachment is complete!
      if (!cardUploading && sendReady) {
        await new Promise((r) => setTimeout(r, 400));
        console.log('[BOLTHAVEN] ✓ Attachment upload fully complete and Send button is active!');
        return true;
      }

      await new Promise((r) => setTimeout(r, 300));
    }
    console.log('[BOLTHAVEN] Attachment upload wait settled, proceeding to send...');
    return true;
  }

  // Find stop button (indicates generation is actively running).
  // CRITICAL: Must be strictly scoped inside the composer container!
  // Outside composer, SVG <rect> exists on Copy, Sidebar, and other buttons and would falsely trigger!
  function findStopButton() {
    const composer = document.querySelector('form, div[class*="composer"], div[id*="composer"]');
    if (!composer) return null;

    // 1. Explicit data-testid or aria-label strictly within composer
    const byAttr = composer.querySelector(
      'button[data-testid="stop-button"], ' +
      'button[data-testid*="stop"], ' +
      'button[aria-label*="Stop generating" i], ' +
      'button[aria-label*="Stop streaming" i], ' +
      'button[aria-label*="Stop message" i], ' +
      'button[aria-label*="Stop" i]'
    );
    if (byAttr && !byAttr.disabled) return byAttr;

    // 2. Button with SVG rect strictly within composer (excluding model picker, attach, mic, copy)
    const composerButtons = Array.from(composer.querySelectorAll('button:not(:disabled)'));
    for (const b of composerButtons) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const testid = (b.getAttribute('data-testid') || '').toLowerCase();
      const text = (b.textContent || '').trim().toLowerCase();

      // Skip non-stop composer buttons (audio, speech, voice mic, attachments, model selector, copy)
      if (
        aria.includes('attach') ||
        aria.includes('upload') ||
        aria.includes('file') ||
        aria.includes('voice') ||
        aria.includes('speech') ||
        aria.includes('audio') ||
        aria.includes('sound') ||
        aria.includes('mic') ||
        aria.includes('dictate') ||
        aria.includes('model') ||
        testid.includes('voice') ||
        testid.includes('speech') ||
        testid.includes('audio') ||
        testid.includes('sound') ||
        testid.includes('mic') ||
        testid.includes('dictate') ||
        testid.includes('model') ||
        text.includes('gpt-') ||
        text.includes('model') ||
        aria.includes('copy')
      ) {
        continue;
      }

      // Stop button in ChatGPT has either a square SVG rect or stop label
      if (
        b.querySelector('svg rect, svg square') ||
        aria.includes('stop') ||
        testid.includes('stop')
      ) {
        return b;
      }
    }

    return null;
  }

  // Detect whether ChatGPT is actively thinking, reasoning, or generating
  function isThinkingOrGenerating() {
    // 1. Stop button present strictly in composer -> 100% actively generating!
    if (findStopButton()) return true;

    // 2. Look for "Working", "Thinking", or "Creating image" indicators across page
    // Leaf or near-leaf elements displaying "Working" or "Thinking"
    const textNodes = document.querySelectorAll('div, span, p, button, article');
    for (const el of textNodes) {
      if (el.children.length > 2) continue;
      const txt = (el.textContent || '').trim();
      // Match "Working", "Working...", "Working for 30s", "Thinking...", "Creating image..."
      // But do NOT match "Worked for ..." (which indicates it finished!)
      if ((/^Working\b/i.test(txt) && !/^Worked\b/i.test(txt)) || /^Thinking\b/i.test(txt) || /^Creating image/i.test(txt)) {
        return true;
      }
    }

    // 3. Look for active thinking indicators strictly inside the latest assistant turn
    const allAssistantTurns = document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"], article'
    );
    if (allAssistantTurns.length > 0) {
      const lastTurn = allAssistantTurns[allAssistantTurns.length - 1];
      const hasSpinner = lastTurn.querySelector('svg.animate-spin, div[class*="spin"], .result-thinking, .animate-pulse');
      if (hasSpinner) return true;

      const txt = (lastTurn.textContent || '').slice(-300);
      if (/\bWorking\.\.\./i.test(txt) || /\bThinking\.\.\./i.test(txt) || /\bCreating image\b/i.test(txt)) {
        return true;
      }
    }

    // 4. Check composer action button: if active (not disabled) and has stop mode
    const composer = document.querySelector('form, div[class*="composer"], div[id*="composer"]');
    if (composer) {
      const actionBtn = composer.querySelector('button[data-testid="send-button"], button[data-testid*="stop"], button[aria-label*="stop" i]');
      if (actionBtn && !actionBtn.disabled) {
        const aria = (actionBtn.getAttribute('aria-label') || '').toLowerCase();
        if (aria.includes('stop')) return true;
        if (actionBtn.querySelector('svg rect, svg square')) return true;
      }
    }

    return false;
  }

  // Set to prevent duplicate downloads of the exact same image/filename in this tab session
  const downloadedFileNames = new Set();

  // Trigger reliable multi-tier image download to disk and browser downloads directory
  async function downloadEnhancedImage(imgEl, finalUrl, fileName) {
    if (!finalUrl || !fileName) return false;

    // Deduplication guard: ensure this exact file is never downloaded twice
    if (downloadedFileNames.has(fileName)) {
      console.log('[BOLTHAVEN] Skipping duplicate download for:', fileName);
      return true;
    }
    downloadedFileNames.add(fileName);

    console.log('[BOLTHAVEN] ⬇️ Triggering reliable multi-tier download:', fileName, finalUrl);

    // Convert blob: URL to data: URL if needed, so companion direct save can write to disk without network failure
    let companionUrl = finalUrl;
    if (finalUrl.startsWith('blob:')) {
      try {
        const bResp = await fetch(finalUrl);
        if (bResp.ok) {
          const bBlob = await bResp.blob();
          companionUrl = await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(bBlob);
          });
        }
      } catch (e) {
        console.warn('[BOLTHAVEN] Could not convert blob to data URL for companion save:', e.message);
      }
    }

    // Tier 1: Direct Node.js Companion download and disk write (bypasses all browser sandbox & CORS restrictions!)
    try {
      console.log('[BOLTHAVEN] Tier 1: Requesting Node companion direct save for:', fileName);
      const compResp = await fetch('http://127.0.0.1:9224/save-generated-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: companionUrl, filename: fileName }),
      });
      if (compResp.ok) {
        console.log('[BOLTHAVEN] ✓ Companion wrote image directly to disk:', fileName);
      }
    } catch (e) {
      console.warn('[BOLTHAVEN] Companion direct save note:', e.message);
    }

    // Tier 1.5: Native ChatGPT download button on image card (if visible/available)
    try {
      const nativeBtn = findGeneratedImageDownloadButton(imgEl);
      if (nativeBtn) {
        console.log('[BOLTHAVEN] Clicking native ChatGPT image download button...');
        clickElementSafely(nativeBtn);
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (e) {
      console.warn('[BOLTHAVEN] Native download button click notice:', e.message);
    }

    // Tier 2: Background chrome.downloads API (handles cross-origin, custom filename)
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'DOWNLOAD_IMAGE', url: finalUrl, filename: fileName },
          (res) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { success: true });
            }
          }
        );
      });

      if (response && response.success) {
        console.log('[BOLTHAVEN] ✓ Successfully downloaded via chrome.downloads:', fileName);
        return true;
      }
      console.warn('[BOLTHAVEN] chrome.downloads reported failure, attempting fallback...', response?.error);
    } catch (e) {
      console.warn('[BOLTHAVEN] chrome.downloads sendMessage failed:', e.message);
    }

    // Tier 3: Direct in-tab blob anchor download (fallback)
    try {
      console.log('[BOLTHAVEN] Fallback: Fetching blob for direct browser download...');
      const resp = await fetch(finalUrl, { mode: 'cors' });
      if (resp.ok) {
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          } catch (e) {}
        }, 8000);
        console.log('[BOLTHAVEN] ✓ Fallback direct anchor download triggered for:', fileName);
        return true;
      }
    } catch (e) {
      console.warn('[BOLTHAVEN] Fallback blob download failed:', e.message);
    }

    return false;
  }

  // Locate the native download button inside the generated image card
  function findGeneratedImageDownloadButton(imgEl) {
    if (!imgEl) return null;
    const card = imgEl.closest('div[class*="group"], div[class*="relative"], article, section') || imgEl.parentElement;
    if (!card) return null;

    const buttons = Array.from(card.querySelectorAll('button, a[download]'));
    // 1. Explicit download / export / share aria-label, title, or testid
    const explicit = buttons.find((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const title = (b.getAttribute('title') || '').toLowerCase();
      const testid = (b.getAttribute('data-testid') || '').toLowerCase();
      return (
        aria.includes('download') ||
        title.includes('download') ||
        testid.includes('download') ||
        aria.includes('export') ||
        title.includes('export') ||
        testid.includes('export') ||
        aria.includes('save') ||
        title.includes('save')
      );
    });
    if (explicit) return explicit;

    // 2. Icon button positioned in bottom-right corner of image or inside card overlay
    const imgR = imgEl.getBoundingClientRect();
    for (const b of buttons) {
      const txt = (b.textContent || '').trim().toLowerCase();
      if (txt === 'edit') continue;
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('thumb') || aria.includes('rate') || aria.includes('copy')) continue;
      const r = b.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.width <= 52 && r.height <= 52) {
        if (r.right >= imgR.right - 90 && (r.bottom >= imgR.bottom - 90 || r.top <= imgR.top + 90)) {
          return b;
        }
      }
    }
    return null;
  }

  // Find generated image element in assistant turn (strictly NEW images only!)
  function findGeneratedHeroImage(preExistingUrls) {
    const preUrls = preExistingUrls || new Set();

    // 0. Locate any image with an "Edit" button adjacent or inside its card that was NOT pre-existing
    const editButtons = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').trim() === 'Edit');
    for (let i = editButtons.length - 1; i >= 0; i--) {
      const editBtn = editButtons[i];
      const card = editBtn.closest('div[class*="group"], div[class*="relative"], article, section') || editBtn.parentElement;
      if (card) {
        const cardImg = card.querySelector('img');
        if (cardImg) {
          const src = cardImg.src || cardImg.getAttribute('src') || '';
          if (src && !preUrls.has(src) && !src.toLowerCase().includes('avatar') && !src.toLowerCase().includes('icon')) {
            if (cardImg.complete && (cardImg.naturalWidth >= 100 || cardImg.width >= 100)) {
              return cardImg;
            }
          }
        }
      }
    }

    // 1. Assistant turns (from newest to oldest)
    const assistantTurns = Array.from(document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"], article'
    ));

    for (let i = assistantTurns.length - 1; i >= 0; i--) {
      const turn = assistantTurns[i];
      if (turn.getAttribute('data-message-author-role') === 'user') continue;
      if (turn.querySelector('[data-message-author-role="user"]')) continue;

      const imgs = Array.from(turn.querySelectorAll('img')).filter((img) => {
        const src = img.src || img.getAttribute('src') || '';
        if (!src || preUrls.has(src)) return false;
        if (img.closest('form, div[class*="composer"], nav, header, [data-message-author-role="user"]')) return false;

        const s = src.toLowerCase();
        if (s.includes('avatar') || s.includes('profile') || s.includes('icon') || s.includes('emoji') || s.includes('favicon') || s.includes('logo')) {
          return false;
        }
        const rect = img.getBoundingClientRect();
        const hasSize = (rect.width >= 100 && rect.height >= 100) || (img.naturalWidth >= 100 && img.naturalHeight >= 100);
        const isOai = s.includes('oaiusercontent.com') || s.includes('file-service') || s.startsWith('blob:');
        return hasSize || isOai;
      });

      if (imgs.length > 0) {
        const newImg = imgs.find((img) => !preUrls.has(img.src || img.getAttribute('src') || ''));
        if (newImg) return newImg;
      }
    }

    // 2. Global fallback across document (strictly NEW images only!)
    const allImgs = Array.from(document.querySelectorAll('img')).filter((img) => {
      if (img.closest('form, div[class*="composer"], nav, header, [data-message-author-role="user"]')) return false;
      const src = img.src || img.getAttribute('src') || '';
      if (!src || preUrls.has(src)) return false;
      const s = src.toLowerCase();
      if (s.includes('avatar') || s.includes('profile') || s.includes('icon') || s.includes('emoji') || s.includes('favicon') || s.includes('logo')) {
        return false;
      }
      const rect = img.getBoundingClientRect();
      const hasSize = (rect.width >= 100 && rect.height >= 100) || (img.naturalWidth >= 100 && img.naturalHeight >= 100);
      const isOai = s.includes('oaiusercontent.com') || s.includes('file-service') || s.startsWith('blob:');
      return (hasSize || isOai) && img.complete;
    });

    if (allImgs.length > 0) {
      return allImgs[allImgs.length - 1];
    }

    return null;
  }

  // Find newly generated enhanced photo for the Enhance IMG pipeline (strictly NEW images only!)
  function findGeneratedEnhancedImage(preExistingUrls, preAssistantCount = 0) {
    const preUrls = preExistingUrls || new Set();

    // 0. Look for image card with an "Edit" button that was NOT in preExistingUrls
    const editButtons = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').trim() === 'Edit');
    for (let i = editButtons.length - 1; i >= 0; i--) {
      const editBtn = editButtons[i];
      const card = editBtn.closest('div[class*="group"], div[class*="relative"], article, section') || editBtn.parentElement;
      if (card) {
        const cardImg = card.querySelector('img');
        if (cardImg) {
          const src = cardImg.src || cardImg.getAttribute('src') || '';
          if (src && !preUrls.has(src)) {
            const s = src.toLowerCase();
            if (!s.includes('avatar') && !s.includes('profile') && !s.includes('icon') && !s.includes('emoji') && !s.includes('logo')) {
              if (cardImg.complete && (cardImg.naturalWidth >= 100 || cardImg.width >= 100)) {
                return cardImg;
              }
            }
          }
        }
      }
    }

    // 1. Assistant turns (strictly from newest to oldest, excluding user turns)
    const assistantTurns = Array.from(
      document.querySelectorAll(
        'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"], article'
      )
    ).filter((turn) => {
      if (turn.getAttribute('data-message-author-role') === 'user') return false;
      if (turn.querySelector('[data-message-author-role="user"]')) return false;
      const c = (turn.className || '').toLowerCase();
      if (c.includes('user-turn') || c.includes('user-message')) return false;
      return true;
    });

    for (let i = assistantTurns.length - 1; i >= 0; i--) {
      const turn = assistantTurns[i];
      const imgs = Array.from(turn.querySelectorAll('img')).filter((img) => {
        const src = img.src || img.getAttribute('src') || '';
        if (!src || preUrls.has(src)) return false;
        // Strictly exclude if inside composer form, nav, header, or user bubble
        if (img.closest('form, div[class*="composer"], [data-message-author-role="user"], header, nav')) {
          return false;
        }
        const s = src.toLowerCase();
        if (s.includes('avatar') || s.includes('profile') || s.includes('icon') || s.includes('emoji') || s.includes('favicon') || s.includes('logo')) {
          return false;
        }
        const rect = img.getBoundingClientRect();
        const hasSize = (rect.width >= 100 && rect.height >= 100) || (img.naturalWidth >= 100 && img.naturalHeight >= 100);
        return hasSize || s.includes('oaiusercontent.com') || s.includes('file-service') || s.startsWith('blob:');
      });

      if (imgs.length > 0) {
        const best = imgs.find((img) => !preUrls.has(img.src || img.getAttribute('src') || ''));
        if (best) return best;
      }
    }

    // 2. Global fallback across document for newly added images (strictly excluding user bubble, composer, header)
    const allImgs = Array.from(document.querySelectorAll('img')).filter((img) => {
      if (img.closest('form, div[class*="composer"], nav, header, [data-message-author-role="user"]')) return false;
      const src = img.src || img.getAttribute('src') || '';
      if (!src || preUrls.has(src)) return false;
      const s = src.toLowerCase();
      if (s.includes('avatar') || s.includes('profile') || s.includes('icon') || s.includes('emoji') || s.includes('favicon') || s.includes('logo')) {
        return false;
      }
      const rect = img.getBoundingClientRect();
      const hasSize = (rect.width >= 100 && rect.height >= 100) || (img.naturalWidth >= 100 && img.naturalHeight >= 100);
      return (hasSize || s.includes('oaiusercontent.com') || s.includes('file-service') || s.startsWith('blob:')) && img.complete;
    });

    if (allImgs.length > 0) {
      return allImgs[allImgs.length - 1];
    }

    return null;
  }

  // Detect ChatGPT error banner and locate the Retry button
  function findRetryButton() {
    // 1. Direct button with text "Retry"
    const buttons = Array.from(document.querySelectorAll('button'));
    const retryBtn = buttons.find((b) => {
      const txt = (b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (txt === 'retry' || aria === 'retry') && !b.disabled;
    });
    if (retryBtn) return retryBtn;

    // 2. Button inside any container containing error text (e.g. "Error in message stream")
    const errorContainers = Array.from(document.querySelectorAll('div, section, article')).filter((d) => {
      const txt = d.textContent || '';
      return (
        txt.includes('Error in message stream') ||
        txt.includes('There was an error generating a response') ||
        txt.includes('Something went wrong') ||
        txt.includes('An error occurred')
      );
    });
    for (const container of errorContainers) {
      const btn = container.querySelector('button');
      if (btn && !btn.disabled) return btn;
    }

    return null;
  }

  // Find file input element in ChatGPT
  function findFileInput() {
    return (
      document.querySelector('input[type="file"]') ||
      document.querySelector('input[accept*="image"]')
    );
  }

  let activeJobAborted = false;

  // Get active composer container element
  function getComposerContainer(inputEl) {
    if (inputEl) {
      return (
        inputEl.closest('div[class*="ComposerLayoutRoot" i], div[class*="ComposerMode" i]') ||
        inputEl.closest('div[class*="relative"][class*="flex-col"]') ||
        inputEl.closest('form') ||
        inputEl.parentElement?.parentElement?.parentElement?.parentElement ||
        document.querySelector('form, div[class*="ComposerLayoutRoot" i], div[class*="ComposerMode" i]')
      );
    }
    const input = document.querySelector('#prompt-textarea, [contenteditable="true"], textarea');
    if (input) {
      return (
        input.closest('div[class*="ComposerLayoutRoot" i], div[class*="ComposerMode" i]') ||
        input.closest('div[class*="relative"][class*="flex-col"]') ||
        input.closest('form') ||
        input.parentElement?.parentElement?.parentElement?.parentElement
      );
    }
    return document.querySelector('form, div[class*="ComposerLayoutRoot" i], div[class*="ComposerMode" i]');
  }

  // Find the attachment (+) button on the ChatGPT composer
  function findAttachmentButton(composer) {
    const root = composer || getComposerContainer() || document;
    
    // 1. Explicit aria-label or data-testid
    const explicit = root.querySelector(
      'button[aria-label*="Add files" i], ' +
      'button[aria-label*="Attach" i], ' +
      'button[aria-label*="Upload" i], ' +
      'button[aria-label*="Add file" i], ' +
      'button[aria-label*="Add photo" i], ' +
      'button[data-testid*="attach" i], ' +
      'button[data-testid*="upload" i]'
    );
    if (explicit && !explicit.disabled) return explicit;

    // 2. Buttons in composer with plus icon (exclude send/mic/voice)
    const buttons = Array.from(root.querySelectorAll('button:not(:disabled)'));
    for (const b of buttons) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('send') || aria.includes('voice') || aria.includes('mic') || aria.includes('dictate')) {
        continue;
      }
      const svg = b.querySelector('svg');
      if (svg) {
        const svgHtml = svg.innerHTML || '';
        if (svgHtml.includes('line') || svgHtml.includes('path')) {
          const rect = b.getBoundingClientRect();
          if (rect.width >= 20 && rect.height >= 20) {
            return b;
          }
        }
      }
    }
    return null;
  }

  // Find all genuine thumbnail preview img elements strictly inside the ChatGPT composer
  function getComposerAttachmentThumbnails(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];

    const imgs = Array.from(composer.querySelectorAll('img')).filter((img) => {
      if (img.closest('article, [data-message-author-role], [data-testid*="conversation-turn"], nav, header, #prompt-textarea')) return false;

      const src = img.src || img.getAttribute('src') || '';
      if (!src) return false;
      if (
        src.includes('avatar') ||
        src.includes('profile') ||
        src.includes('icon') ||
        src.includes('emoji') ||
        src.includes('logo') ||
        src.includes('favicon')
      ) {
        return false;
      }

      const isRealImage =
        src.startsWith('blob:') ||
        src.startsWith('data:image/') ||
        src.includes('file-service') ||
        src.includes('oaiusercontent.com') ||
        src.includes('files.oaiusercontent.com');

      if (!isRealImage) return false;

      const rect = img.getBoundingClientRect();
      return rect.width >= 15 && rect.height >= 15;
    });

    return imgs;
  }

  // Find all genuine thumbnail preview canvas elements strictly inside the ChatGPT composer
  function getComposerAttachmentCanvases(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];

    const canvases = Array.from(composer.querySelectorAll('canvas')).filter((canvas) => {
      if (canvas.closest('article, [data-message-author-role], [data-testid*="conversation-turn"], nav, header, #prompt-textarea')) return false;
      const rect = canvas.getBoundingClientRect();
      return rect.width >= 15 && rect.height >= 15;
    });

    return canvases;
  }

  // Find thumbnail preview img element strictly inside the ChatGPT composer
  function getComposerAttachmentThumbnail(inputEl) {
    const thumbs = getComposerAttachmentThumbnails(inputEl);
    return thumbs.length > 0 ? thumbs[0] : null;
  }

  // Get all individual attachment thumbnail card containers in the composer (located above prompt textarea)
  function getAttachmentThumbnailCards(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];
    const promptArea = composer.querySelector('#prompt-textarea') || inputEl;
    const promptTop = promptArea ? promptArea.getBoundingClientRect().top : Infinity;

    const allDescendants = Array.from(composer.querySelectorAll('div, li, span')).filter((el) => {
      if (el.closest('#prompt-textarea, [contenteditable="true"], article, [data-message-author-role], [data-testid*="conversation-turn"], nav, header')) {
        return false;
      }
      if (el.closest('button')) return false;

      const rect = el.getBoundingClientRect();
      // Must be physically above or at prompt textarea top and within sensible card bounds
      if (rect.bottom > promptTop + 25 || rect.width < 20 || rect.height < 20 || rect.width > 400 || rect.height > 400) {
        return false;
      }

      const img = el.querySelector('img');
      const hasImg = img && !img.closest('button') && (
        (img.src || '').startsWith('blob:') ||
        (img.src || '').startsWith('data:image/') ||
        (img.src || '').includes('file-service') ||
        (img.src || '').includes('oaiusercontent.com') ||
        (img.src || '').includes('files.oaiusercontent.com')
      );
      const hasCanvas = el.querySelector('canvas') !== null;
      const isAttachmentCard = (
        (el.getAttribute('data-testid') || '').includes('attachment') ||
        (el.className || '').toString().includes('attachment')
      ) && (hasImg || hasCanvas || el.querySelector('button') !== null);

      return hasImg || hasCanvas || isAttachmentCard;
    });

    // Keep only outermost containers of each individual thumbnail card
    const cards = [];
    for (const el of allDescendants) {
      if (!allDescendants.some((other) => other !== el && el.contains(other))) {
        cards.push(el);
      }
    }
    return cards;
  }

  // Find thumbnail delete / remove buttons strictly inside the composer (excluding attach/plus button!)
  function findAttachmentRemoveButtons(composer) {
    const root = composer || getComposerContainer();
    if (!root) return [];
    const promptArea = root.querySelector('#prompt-textarea');
    const promptTop = promptArea ? promptArea.getBoundingClientRect().top : Infinity;

    const allButtons = Array.from(root.querySelectorAll('button:not(:disabled)'));

    return allButtons.filter((btn) => {
      // Must not be in conversation turns or sidebar nav or prompt textarea
      if (btn.closest('article, [data-message-author-role], [data-testid*="conversation-turn"], nav, header, #prompt-textarea')) return false;

      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const testid = (btn.getAttribute('data-testid') || '').toLowerCase();

      // STRICT EXCLUSIONS: Never confuse navigation, scroll, send, voice, etc. with a remove button!
      if (
        aria.includes('scroll') ||
        aria.includes('bottom') ||
        aria.includes('down') ||
        aria.includes('arrow') ||
        aria.includes('copy') ||
        aria.includes('edit') ||
        aria.includes('share') ||
        aria.includes('like') ||
        aria.includes('dislike') ||
        aria.includes('more') ||
        aria.includes('action') ||
        aria.includes('attach') ||
        aria.includes('upload') ||
        aria.includes('add') ||
        aria.includes('send') ||
        aria.includes('voice') ||
        aria.includes('mic') ||
        aria.includes('dictate') ||
        aria.includes('search') ||
        aria.includes('reason') ||
        aria.includes('model') ||
        aria.includes('canvas') ||
        testid.includes('attach') ||
        testid.includes('send') ||
        testid.includes('voice') ||
        testid.includes('mic')
      ) {
        return false;
      }

      // Check if button is explicitly labeled as removing an attachment / image
      const isExplicitRemove =
        aria.includes('remove attachment') ||
        aria.includes('remove image') ||
        aria.includes('remove photo') ||
        aria.includes('remove file') ||
        aria.includes('delete attachment') ||
        testid.includes('remove-attachment') ||
        testid.includes('remove-file') ||
        testid.includes('delete-attachment');

      if (isExplicitRemove) return true;

      // Or the button is strictly inside a detected thumbnail card with an actual image or canvas
      const parentCard = btn.closest('[class*="attachment" i], [class*="thumbnail" i], [data-testid*="attachment" i]');
      if (parentCard) {
        const hasThumbImg = parentCard.querySelector('img, canvas');
        if (hasThumbImg) return true;
      }

      const siblingImg = btn.parentElement?.querySelector('img, canvas') || btn.closest('div')?.querySelector('img, canvas');
      if (siblingImg) {
        const rect = btn.getBoundingClientRect();
        if (rect.bottom <= promptTop + 25 && rect.width < 36 && rect.height < 36) {
          return true;
        }
      }

      return false;
    });
  }

  // Count distinct genuine image attachments present in the composer
  // CRITICAL: Returns 0 if no genuine image or canvas thumbnail exists in DOM!
  function getAttachedImagesCount(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return 0;

    // 1. Direct count of genuine thumbnail images
    const thumbImgs = getComposerAttachmentThumbnails(inputEl);
    if (thumbImgs.length > 0) return thumbImgs.length;

    // 2. Direct count of genuine canvas thumbnails
    const canvases = getComposerAttachmentCanvases(inputEl);
    if (canvases.length > 0) return canvases.length;

    // 3. Attachment cards that encapsulate an image/canvas
    const cards = getAttachmentThumbnailCards(inputEl);
    if (cards.length > 0) {
      const outerCards = cards.filter((c) => !cards.some((other) => other !== c && other.contains(c)));
      return outerCards.length;
    }

    // 4. Remove buttons on genuine thumbnail cards
    const removeBtns = findAttachmentRemoveButtons(composer);
    if (removeBtns.length > 0) return removeBtns.length;

    return 0;
  }

  // Detect whether an image thumbnail/attachment is actively present in the ChatGPT composer
  function isImageAttachedInComposer(inputEl, minCount = 1) {
    return getAttachedImagesCount(inputEl) >= minCount;
  }

  // If more than maxExpected images are attached, remove the extra duplicate ones
  async function pruneExcessAttachments(inputEl, maxExpected = 1) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return;

    let count = getAttachedImagesCount(inputEl);
    let attempts = 0;

    while (count > maxExpected && attempts < 15) {
      attempts++;
      console.warn(`[BOLTHAVEN] Detected ${count} attached images (target: ${maxExpected}). Pruning duplicate #${attempts}...`);

      let removeBtns = findAttachmentRemoveButtons(composer);
      if (removeBtns.length > 0) {
        const btnToRemove = removeBtns[removeBtns.length - 1];
        clickElementSafely(btnToRemove);
        await new Promise((r) => setTimeout(r, 400));
      } else {
        const cards = getAttachmentThumbnailCards(inputEl);
        if (cards.length > maxExpected) {
          const card = cards[cards.length - 1];
          card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 150));
          const btn = card.querySelector('button') || card.parentElement?.querySelector('button');
          if (btn) {
            clickElementSafely(btn);
          }
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      count = getAttachedImagesCount(inputEl);
    }

    console.log(`[BOLTHAVEN] Current attached images in composer: ${count} (expected: ${maxExpected})`);
  }

  // Wait until image attachment is genuinely detected in composer
  async function waitForImageAttached(inputEl, timeoutMs = 5000, minCount = 1) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (activeJobAborted) return false;
      if (getAttachedImagesCount(inputEl) >= minCount) {
        await new Promise((r) => setTimeout(r, 350));
        return true;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return getAttachedImagesCount(inputEl) >= minCount;
  }
    return getAttachedImagesCount(inputEl) >= minCount;
  }

  // Completely clear prompt text inside ProseMirror contenteditable or textarea
  function clearPromptText(inputEl) {
    if (!inputEl) return;
    try {
      inputEl.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('delete', false, null);
    } catch (e) {}

    if (inputEl.tagName.toLowerCase() === 'textarea') {
      inputEl.value = '';
      inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } else {
      inputEl.innerHTML = '<p><br></p>';
      inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  }

  // Set prompt text inside ProseMirror contenteditable or textarea without duplicating
  function setPromptText(inputEl, text) {
    if (!inputEl || !text) return;
    inputEl.focus();

    const cleanText = text.trim();
    const existing = (inputEl.textContent || '').trim();
    if (existing === cleanText) return;

    // 1. Wipe out any pre-existing residual text completely
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('delete', false, null);
    } catch (e) {}

    const p = inputEl.querySelector('p');
    if (p && (p.textContent || '').trim().length > 0) {
      p.textContent = '';
    }

    // 2. Insert text via execCommand insertText
    try {
      document.execCommand('insertText', false, cleanText);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {}

    let curContent = (inputEl.textContent || '').trim();
    if (curContent.includes(cleanText.slice(0, 20)) && curContent.length >= cleanText.length * 0.8) {
      console.log(`[BOLTHAVEN] Inserted prompt via execCommand (${cleanText.length} chars)`);
      return;
    }

    // 3. Fallback: ProseMirror DataTransfer ClipboardEvent paste (only if execCommand didn't apply)
    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', cleanText);
      const pasteEvt = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });
      inputEl.dispatchEvent(pasteEvt);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {}

    curContent = (inputEl.textContent || '').trim();
    if (curContent.includes(cleanText.slice(0, 20)) && curContent.length >= cleanText.length * 0.8) {
      console.log('[BOLTHAVEN] Inserted prompt via paste fallback');
      return;
    }

    // 4. Last-ditch textarea / paragraph injection fallback
    if (inputEl.tagName.toLowerCase() === 'textarea') {
      inputEl.value = cleanText;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const lines = cleanText.split('\n');
      const paragraphsHtml = lines.map((line) => `<p>${line || '<br>'}</p>`).join('');
      inputEl.innerHTML = paragraphsHtml;
      inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: cleanText }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('[BOLTHAVEN] Inserted prompt via paragraph structure fallback');
    }
  }

  // Fetch image blob from primary or fallback URL (preferring local storage via background)
  async function fetchImageBlob(primaryUrl, fallbackUrl) {
    let b64DataUrl = null;
    let lastError = null;

    try {
      const res = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'FETCH_IMAGE_BASE64', url: primaryUrl, fallbackUrl: fallbackUrl },
          (response) => {
            if (response && response.success && response.dataUrl) {
              resolve(response.dataUrl);
            } else {
              reject(new Error(response?.error || 'Failed to fetch image via background'));
            }
          }
        );
      });
      b64DataUrl = res;
    } catch (e) {
      lastError = e;
      console.warn('[BOLTHAVEN] Background image fetch warning:', e.message);
    }

    if (!b64DataUrl) {
      const candidates = [primaryUrl, fallbackUrl].filter(Boolean);
      for (const u of candidates) {
        try {
          const resp = await fetch(u);
          if (resp.ok) {
            return await resp.blob();
          }
        } catch (e) {}
      }
      throw lastError || new Error('Could not fetch image blob from candidate URLs');
    }

    const resp = await fetch(b64DataUrl);
    return await resp.blob();
  }

  // Attach a single image File into the ChatGPT composer cleanly without duplicating
  async function attachImageFileToComposer(inputEl, file, maxExpected = 1, minExpected = 1) {
    const composer = getComposerContainer(inputEl);
    const targetInputArea = document.querySelector('#prompt-textarea') || inputEl;

    // If leftover attachments are present from a previous run, prune them first
    if (getAttachedImagesCount(inputEl) >= maxExpected) {
      console.log(`[BOLTHAVEN] Pruning leftover attachments before attaching new image...`);
      await pruneExcessAttachments(inputEl, 0);
    }

    // Try multiple channels with retries (up to 2 passes)
    for (let pass = 1; pass <= 2; pass++) {
      if (activeJobAborted) return false;

      // ── CHANNEL 1: Native <input type="file"> inside or closest to composer ──
      try {
        console.log(`[BOLTHAVEN] Pass ${pass} - Channel 1: Injecting File into file input...`);
        let fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));

        // Prioritize file input in or near composer
        let targetInput = composer?.querySelector('input[type="file"]') ||
                          fileInputs.find((i) => (i.accept || '').includes('image')) ||
                          fileInputs[0];

        if (!targetInput) {
          const plusBtn = findAttachmentButton(composer);
          if (plusBtn) {
            clickElementSafely(plusBtn);
            await new Promise((r) => setTimeout(r, 350));

            const menuItems = Array.from(
              document.querySelectorAll('[role="menuitem"], [role="menu"] button, div[class*="popover"] button, div[data-radix-popper-content-wrapper] button')
            );
            const uploadMenuItem = menuItems.find((el) => {
              const t = (el.textContent || '').toLowerCase();
              return t.includes('upload') || t.includes('computer') || t.includes('photos & files') || t.includes('photo');
            });
            if (uploadMenuItem) {
              clickElementSafely(uploadMenuItem);
              await new Promise((r) => setTimeout(r, 300));
            }
            fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
            targetInput = fileInputs[0];
          }
        }

        if (targetInput) {
          const dt = new DataTransfer();
          dt.items.add(file);

          try {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
            if (nativeSetter) {
              nativeSetter.call(targetInput, dt.files);
            } else {
              targetInput.files = dt.files;
            }
          } catch (e) {
            targetInput.files = dt.files;
          }

          if (targetInput._valueTracker) {
            targetInput._valueTracker.setValue('');
          }

          targetInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

          await new Promise((r) => setTimeout(r, 300));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

          const attached = await waitForImageAttached(inputEl, 4000, minExpected);
          if (attached) {
            console.log(`[BOLTHAVEN] ✓ Image attachment confirmed via file input (${getAttachedImagesCount(inputEl)} >= ${minExpected})`);
            await pruneExcessAttachments(inputEl, maxExpected);
            return true;
          }
        }
      } catch (e) {
        console.warn('[BOLTHAVEN] Channel 1 notice:', e.message);
      }

      if (getAttachedImagesCount(inputEl) >= minExpected) {
        await pruneExcessAttachments(inputEl, maxExpected);
        return true;
      }

      // ── CHANNEL 2: ClipboardEvent Paste on #prompt-textarea ──
      try {
        console.log(`[BOLTHAVEN] Pass ${pass} - Channel 2: Dispatching ClipboardEvent paste on #prompt-textarea...`);
        targetInputArea.focus();
        await new Promise((r) => setTimeout(r, 100));

        const dtPaste = new DataTransfer();
        dtPaste.items.add(file);
        let pasteEvent;
        try {
          pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clipboardData: dtPaste,
          });
        } catch (e) {
          pasteEvent = new Event('paste', { bubbles: true, cancelable: true, composed: true });
        }
        try {
          Object.defineProperty(pasteEvent, 'clipboardData', {
            value: dtPaste,
            writable: false,
            configurable: true,
          });
        } catch (e) {}

        targetInputArea.dispatchEvent(pasteEvent);

        const attachedPaste = await waitForImageAttached(inputEl, 4000, minExpected);
        if (attachedPaste) {
          console.log(`[BOLTHAVEN] ✓ Image attachment confirmed via ClipboardEvent paste (${getAttachedImagesCount(inputEl)} >= ${minExpected})`);
          await pruneExcessAttachments(inputEl, maxExpected);
          return true;
        }
      } catch (e) {
        console.warn('[BOLTHAVEN] Channel 2 notice:', e.message);
      }

      if (getAttachedImagesCount(inputEl) >= minExpected) {
        await pruneExcessAttachments(inputEl, maxExpected);
        return true;
      }

      // ── CHANNEL 3: Drag & Drop Event ──
      try {
        console.log(`[BOLTHAVEN] Pass ${pass} - Channel 3: Dispatching DragEvent drop...`);
        const dtDrop = new DataTransfer();
        dtDrop.items.add(file);

        const dropTargets = [
          targetInputArea,
          composer,
          document.querySelector('form'),
          document.body,
        ].filter(Boolean);

        for (const t of dropTargets) {
          t.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, composed: true, dataTransfer: dtDrop }));
          t.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true, dataTransfer: dtDrop }));
          t.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: dtDrop }));
        }

        const attachedDrop = await waitForImageAttached(inputEl, 4000, minExpected);
        if (attachedDrop) {
          console.log(`[BOLTHAVEN] ✓ Image attachment confirmed via DragEvent drop (${getAttachedImagesCount(inputEl)} >= ${minExpected})`);
          await pruneExcessAttachments(inputEl, maxExpected);
          return true;
        }
      } catch (e) {
        console.warn('[BOLTHAVEN] Channel 3 notice:', e.message);
      }

      if (getAttachedImagesCount(inputEl) >= minExpected) {
        await pruneExcessAttachments(inputEl, maxExpected);
        return true;
      }

      // ── CHANNEL 4: Explicit Attachment (+) Button Menu Click ──
      try {
        console.log(`[BOLTHAVEN] Pass ${pass} - Channel 4: Clicking attachment (+) button to trigger upload...`);
        const plusBtn = findAttachmentButton(composer);
        if (plusBtn) {
          clickElementSafely(plusBtn);
          await new Promise((r) => setTimeout(r, 400));

          const menuItems = Array.from(
            document.querySelectorAll('[role="menuitem"], [role="menu"] button, div[class*="popover"] button, div[data-radix-popper-content-wrapper] button')
          );
          const uploadItem = menuItems.find((el) => {
            const t = (el.textContent || '').toLowerCase();
            return t.includes('upload') || t.includes('computer') || t.includes('photos') || t.includes('file');
          });
          if (uploadItem) {
            clickElementSafely(uploadItem);
            await new Promise((r) => setTimeout(r, 350));
          }

          const freshInputs = Array.from(document.querySelectorAll('input[type="file"]'));
          for (const fi of freshInputs) {
            const dtFresh = new DataTransfer();
            dtFresh.items.add(file);
            try {
              fi.files = dtFresh.files;
            } catch (e) {}
            if (fi._valueTracker) fi._valueTracker.setValue('');
            fi.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            fi.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          }

          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

          const attachedFresh = await waitForImageAttached(inputEl, 4000, minExpected);
          if (attachedFresh) {
            console.log(`[BOLTHAVEN] ✓ Image attachment confirmed via fresh file input from menu (${getAttachedImagesCount(inputEl)} >= ${minExpected})`);
            await pruneExcessAttachments(inputEl, maxExpected);
            return true;
          }
        }
      } catch (e) {
        console.warn('[BOLTHAVEN] Channel 4 notice:', e.message);
      }

      if (getAttachedImagesCount(inputEl) >= minExpected) {
        await pruneExcessAttachments(inputEl, maxExpected);
        return true;
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    return getAttachedImagesCount(inputEl) >= minExpected;
  }

  // Attach image via data URL or web URL cleanly
  async function attachImageViaPaste(inputEl, imgUrl, fileName = 'attachment.png', maxExpected = 1, minExpected = 1) {
    if (!imgUrl) return false;
    try {
      const blob = await fetchImageBlob(imgUrl, '');
      const mimeType = blob.type || 'image/png';
      const file = new File([blob], fileName, { type: mimeType });
      return await attachImageFileToComposer(inputEl, file, maxExpected, minExpected);
    } catch (e) {
      console.warn('[BOLTHAVEN] attachImageViaPaste error:', e);
      return false;
    }
  }

  // Process a single job in this tab
  async function processJobInTab(job) {
    activeJobAborted = false;
    console.log('[BOLTHAVEN] Starting job in tab:', job.job_id, 'Image #' + (job.original_position || 1));

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], textarea', 25000);
    if (!input) {
      chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
      throw new Error('Could not locate ChatGPT prompt input textarea');
    }

    if (activeJobAborted) {
      clearPromptText(input);
      chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
      throw new Error('Job stopped by user');
    }

    // Safety guard: If tab is currently busy generating an in-progress image, WAIT for it to finish first!
    const preWaitStart = Date.now();
    while (isThinkingOrGenerating() && Date.now() - preWaitStart < 240000) {
      if (activeJobAborted) {
        clearPromptText(input);
        chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
        throw new Error('Job stopped by user');
      }
      console.log(`[BOLTHAVEN] Tab is currently busy generating an in-progress image. Waiting before starting Image #${job.original_position || 1}...`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    // 0. RESET COMPOSER: Clean out any leftover attachments and text from previous runs completely
    console.log('[BOLTHAVEN] Resetting composer: removing all leftover attachments and residual text...');
    await pruneExcessAttachments(input, 0);
    clearPromptText(input);
    await new Promise((r) => setTimeout(r, 400));

    // Snapshot pre-existing assistant images currently in this chat history before send
    const preExistingImageUrls = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (src) preExistingImageUrls.add(src);
    });
    console.log(`[BOLTHAVEN] Pre-existing images in chat history: ${preExistingImageUrls.size}`);

    // 1. Attach single image FIRST and strictly verify that it appears in composer!
    const localPath = job.source_file_path || '';
    const remoteUrl = job.source_file_url || '';
    let primaryUrl = '';
    let fallbackUrl = '';

    // ALWAYS prioritize local storage: fast (5ms) & guaranteed on local disk
    if (localPath && localPath.startsWith('/storage/')) {
      primaryUrl = `http://localhost:8085${localPath}`;
      fallbackUrl = remoteUrl;
    } else if (remoteUrl) {
      primaryUrl = remoteUrl;
      fallbackUrl = localPath ? `http://localhost:8085${localPath}` : '';
    } else {
      primaryUrl = localPath;
    }

    let attached = false;
    if (primaryUrl || fallbackUrl) {
      const filename = `property_image_${job.original_position || 1}.jpg`;
      console.log(`[BOLTHAVEN] Fetching image for attachment: ${primaryUrl}`);
      const blob = await fetchImageBlob(primaryUrl, fallbackUrl);
      const mimeType = blob.type || 'image/jpeg';
      const file = new File([blob], filename, { type: mimeType });

      console.log(`[BOLTHAVEN] Attaching single image #${job.original_position || 1}...`);
      attached = await attachImageFileToComposer(input, file);
    }

    // STRICT SAFETY GUARD: Do NOT submit prompt if image failed to attach!
    const verifiedAttachmentCount = getAttachedImagesCount(input);
    if (!attached || verifiedAttachmentCount < 1) {
      console.warn(`[BOLTHAVEN] ⚠️ Image failed to attach (attached: ${attached}, count: ${verifiedAttachmentCount}). Aborting send!`);
      clearPromptText(input);
      chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
      return {
        success: false,
        error: `Image #${job.original_position || 1} could not be attached to ChatGPT composer. Aborting to avoid sending text without photo.`,
      };
    }

    if (activeJobAborted) {
      clearPromptText(input);
      chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
      return { success: false, error: 'Job stopped by user' };
    }

    // Ensure exactly 1 image thumbnail is present before setting prompt (prunes any accidental duplicate)
    await pruneExcessAttachments(input, 1);

    // 2. Set the clean prompt text BELOW the attached image (clearing any old text)
    const promptText = (job.resolved_prompt || 'Enhance the attached architectural photo').trim();
    setPromptText(input, promptText);
    await new Promise((r) => setTimeout(r, 600));

    if (activeJobAborted) {
      clearPromptText(input);
      chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
      return { success: false, error: 'Job stopped by user' };
    }

    // Guarantee that exactly 1 image is STILL present before sending!
    await pruneExcessAttachments(input, 1);
    if (!isImageAttachedInComposer(input)) {
      console.warn('[BOLTHAVEN] ⚠️ Image disappeared from composer after setting prompt text. Aborting send!');
      clearPromptText(input);
      chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
      return {
        success: false,
        error: `Image #${job.original_position || 1} was not found in composer before send. Aborting to protect job.`,
      };
    }

    // 3. Wait for attachment upload to ChatGPT server to fully complete (no progress spinner on thumbnail)
    await waitForAttachmentUploadComplete(getComposerContainer(input) || document, 25000);

    // Record pre-existing assistant turn count and existing images BEFORE sending
    const preAssistantCount = document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"]'
    ).length;
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (src) preExistingImageUrls.add(src);
    });
    console.log(`[BOLTHAVEN] Pre-existing assistant turns: ${preAssistantCount}, pre-existing images: ${preExistingImageUrls.size}`);

    // 4. Click Send button and VERIFY that the message actually sends and leaves the composer
    console.log('[BOLTHAVEN] Sending prompt + image to ChatGPT...');
    let messageSent = false;
    const sendDeadline = Date.now() + 25000;
    let sendAttempt = 0;

    while (Date.now() < sendDeadline) {
      if (activeJobAborted) {
        chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
        return { success: false, error: 'Job stopped by user' };
      }

      // Re-check that image is genuinely attached right before clicking send!
      if (!isImageAttachedInComposer(input)) {
        console.warn('[BOLTHAVEN] ⚠️ Image missing at send time. Aborting send!');
        clearPromptText(input);
        chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
        return {
          success: false,
          error: `Image #${job.original_position || 1} was not attached at send time. Aborted to avoid sending prompt without photo.`,
        };
      }

      const sendBtn = findSendButton();
      sendAttempt++;
      console.log(`[BOLTHAVEN] Send attempt ${sendAttempt} (sendBtn ready: ${isSendButtonReady(sendBtn)})...`);

      if (sendBtn && isSendButtonReady(sendBtn)) {
        clickElementSafely(sendBtn);
      }
      // Also dispatch Enter key on input as reliable primary/fallback
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));

      await new Promise((r) => setTimeout(r, 1200));

      // Verify if message was successfully dispatched:
      const currentComposerText = (input.innerText || input.textContent || '').trim();
      const stillHasAttachedImg = isImageAttachedInComposer(input);
      const isGeneratingNow = isThinkingOrGenerating();
      const currentTurns = document.querySelectorAll(
        'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"]'
      );

      // A message is confirmed sent when:
      // (a) composer input has cleared AND image thumbnail is no longer in composer
      // OR (b) stop button / thinking indicator is active
      // OR (c) assistant turn count increased
      if ((!stillHasAttachedImg && currentComposerText === '') || isGeneratingNow || currentTurns.length > preAssistantCount) {
        messageSent = true;
        console.log('[BOLTHAVEN] ✓ Message confirmed sent to ChatGPT with attached image!');
        chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
        break;
      }
    }

    if (!messageSent) {
      console.log('[BOLTHAVEN] ⚠️ Message could not be sent after 25s. Composer still holds prompt/image. Aborting.');
      chrome.runtime.sendMessage({ action: 'ATTACHMENT_PHASE_COMPLETE', jobId: job.job_id }).catch(() => {});
      return {
        success: false,
        error: `Image #${job.original_position || 1} failed to send to ChatGPT (message remained in composer).`,
      };
    }

    // ── CRITICAL POST-SEND SNAPSHOT & MINIMUM WAIT ───────────────────────
    // Wait 3.5 seconds for prompt to dispatch and user turn with input photo to render in chat
    await new Promise((r) => setTimeout(r, 3500));

    // Snapshot all images currently on page into preExistingImageUrls!
    // This explicitly includes the user's uploaded input photo and thumbnail
    // so it is NEVER mistaken for the AI generated output photo!
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (src) preExistingImageUrls.add(src);
    });

    // 5. Monitor for generation to COMPLETELY FINISH (poll every 1s, up to 6 min)
    console.log('[BOLTHAVEN] Waiting for ChatGPT generation of Image #' + (job.original_position || 1) + ' to complete...');
    const startTime = Date.now();
    const maxWaitMs = 360000; // 6 minutes max
    const MIN_GENERATION_WAIT_MS = 15000; // MUST wait at least 15s (image generation in ChatGPT takes 30-90s!)
    let consecutiveCalmChecks = 0;
    const REQUIRED_CALM_CHECKS = 3; // Must be calm for 3 consecutive checks (1s apart)
    let streamRetryCount = 0;
    const MAX_STREAM_RETRIES = 3;
    let lastRetryClickTime = 0;

    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        if (activeJobAborted) {
          clearInterval(checkInterval);
          return resolve({ success: false, error: 'Job stopped by user' });
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > maxWaitMs) {
          clearInterval(checkInterval);
          return resolve({ success: false, error: 'ChatGPT image generation timed out (6 min)' });
        }

        const currentlyGenerating = isThinkingOrGenerating();

        // ── AUTO-RETRY DETECTION ──────────────────────────────────────────
        const now = Date.now();
        if (!currentlyGenerating && now - lastRetryClickTime > 4000) {
          const retryBtn = findRetryButton();
          if (retryBtn) {
            if (streamRetryCount < MAX_STREAM_RETRIES) {
              streamRetryCount++;
              lastRetryClickTime = now;
              consecutiveCalmChecks = 0;
              console.log(
                `[BOLTHAVEN] ⚠️ "Error in message stream" detected! Auto-clicking "Retry" (attempt ${streamRetryCount}/${MAX_STREAM_RETRIES})...`
              );
              retryBtn.click();
              return;
            } else {
              clearInterval(checkInterval);
              return resolve({ success: false, error: 'ChatGPT generation failed: "Error in message stream" persisted after 3 retries.' });
            }
          }
        }

        // 1. If STILL generating or minimum wait time hasn't elapsed: reset calm counter!
        if (currentlyGenerating || elapsed < MIN_GENERATION_WAIT_MS) {
          consecutiveCalmChecks = 0;
          if (elapsed % 5000 < 1000) {
            console.log(
              `[BOLTHAVEN] ChatGPT is enhancing Image #${job.original_position || 1} (Working... elapsed: ${Math.round(elapsed / 1000)}s)`
            );
          }
          return;
        }

        // 2. Search strictly for newly created enhanced image
        const enhancedImg = findGeneratedEnhancedImage(preExistingImageUrls, preAssistantCount);

        if (!enhancedImg) {
          consecutiveCalmChecks = 0;
          return;
        }

        // 3. Enhanced image exists and ChatGPT is NOT generating!
        consecutiveCalmChecks++;
        console.log(
          `[BOLTHAVEN] Enhanced Image #${job.original_position || 1} detected on screen (calm check ${consecutiveCalmChecks}/${REQUIRED_CALM_CHECKS})...`
        );

        if (consecutiveCalmChecks >= REQUIRED_CALM_CHECKS) {
          clearInterval(checkInterval);
          const finalUrl = enhancedImg.src || enhancedImg.getAttribute('src') || '';
          console.log(`[BOLTHAVEN] ✓ Generation fully finished! Enhanced Image #${job.original_position || 1} verified:`, finalUrl);

          preExistingImageUrls.add(finalUrl);
          const fileName = `enhanced_${job.original_position || 1}_${job.job_id || Date.now()}.png`;

          // Download using our reliable 3-tier downloader
          await downloadEnhancedImage(enhancedImg, finalUrl, fileName);

          // Wait 3s for download to register on disk before resolving slot
          await new Promise((r) => setTimeout(r, 3000));

          return resolve({
            success: true,
            job_id: job.job_id,
            original_position: job.original_position,
            result_url: finalUrl,
          });
        }
      }, 1000);
    });
  }

  // ── Two-Stage Staging: Tab 1 (Prompt Extractor) ───────────────────────────
  async function extractStage1Prompt(promptText) {
    activeJobAborted = false;
    console.log('[BOLTHAVEN] Stage 1: Injecting prompt into Tab 1 to generate response...');

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], textarea', 25000);
    if (!input) throw new Error('Could not locate ChatGPT prompt input textarea in Tab 1');

    // Count existing assistant turns before sending
    const preAssistantCount = document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"]'
    ).length;

    // Set the prompt text
    setPromptText(input, promptText || 'Analyze property details and formulate facebook ad prompt');
    await new Promise((r) => setTimeout(r, 800));

    if (activeJobAborted) throw new Error('Stage 1 aborted by user');

    // Wait for send button and click send
    let sendBtn = findSendButton();
    let attempts = 0;
    while ((!sendBtn || sendBtn.disabled) && attempts < 25) {
      if (activeJobAborted) throw new Error('Stage 1 aborted by user');
      await new Promise((r) => setTimeout(r, 300));
      sendBtn = findSendButton();
      attempts++;
    }

    if (!sendBtn) throw new Error('Send button could not be activated in Tab 1');
    sendBtn.click();
    console.log('[BOLTHAVEN] Stage 1: Prompt sent in Tab 1. Waiting for completion...');

    await new Promise((r) => setTimeout(r, 2000));

    // Wait for generation to complete
    return new Promise((resolve, reject) => {
      let streamRetryCount = 0;
      const MAX_STREAM_RETRIES = 3;
      let lastRetryClickTime = 0;
      let waitSeconds = 0;
      const MAX_WAIT_SECONDS = 180;
      let calmChecks = 0;

      const interval = setInterval(async () => {
        if (activeJobAborted) {
          clearInterval(interval);
          return reject(new Error('Stage 1 aborted by user'));
        }

        waitSeconds++;
        if (waitSeconds > MAX_WAIT_SECONDS) {
          clearInterval(interval);
          return reject(new Error('Stage 1 generation timed out after 180s'));
        }

        const currentlyGenerating = isThinkingOrGenerating();

        // Auto-retry on "Error in message stream"
        const now = Date.now();
        if (!currentlyGenerating && now - lastRetryClickTime > 4000) {
          const retryBtn = findRetryButton();
          if (retryBtn) {
            if (streamRetryCount < MAX_STREAM_RETRIES) {
              streamRetryCount++;
              lastRetryClickTime = now;
              calmChecks = 0;
              console.log(`[BOLTHAVEN] Stage 1: Auto-clicking Retry (${streamRetryCount}/${MAX_STREAM_RETRIES})...`);
              retryBtn.click();
              return;
            } else {
              clearInterval(interval);
              return reject(new Error('Stage 1 failed: Error in message stream persisted'));
            }
          }
        }

        if (currentlyGenerating) {
          calmChecks = 0;
          return;
        }

        // Generation not running: check for assistant turn
        calmChecks++;
        if (calmChecks >= 2) {
          const assistantTurns = Array.from(
            document.querySelectorAll(
              'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"]'
            )
          ).filter((el) => {
            return (
              el.getAttribute('data-message-author-role') === 'assistant' ||
              el.querySelector('div.markdown, p, .whitespace-pre-wrap')
            );
          });

          if (assistantTurns.length > 0) {
            clearInterval(interval);
            const latestTurn = assistantTurns[assistantTurns.length - 1];
            const contentEl = latestTurn.querySelector('div.markdown') || latestTurn;
            const extractedText = (contentEl.innerText || contentEl.textContent || '').trim();

            console.log('[BOLTHAVEN] ✓ Stage 1 complete! Extracted prompt length:', extractedText.length);
            resolve({
              success: true,
              extractedPrompt: extractedText,
            });
          }
        }
      }, 1000);
    });
  }

  // ── Two-Stage Staging: Tab 2 (Image Pasting + Prompt + Generate + Download) ─
  // 1. Pastes manual reference image FIRST
  // 2. Pastes condo images 1.png, 2.png, 3.png SECOND
  // 3. Pastes extracted prompt BELOW the images
  // 4. Waits for uploads to complete & clicks Send
  // 5. Waits for ChatGPT to finish generating the Hero Image & automatically downloads it!
  async function executeStage2Staging({ extractedPrompt, referenceImage, condoImages, condoName }) {
    activeJobAborted = false;
    console.log('[BOLTHAVEN] Stage 2: Assembling reference image, condo images (1, 2, 3), and prompt...');

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], textarea', 25000);
    if (!input) throw new Error('Could not locate ChatGPT prompt input textarea');

    // Snapshot all existing images on the page BEFORE sending so we only detect the newly generated Hero image
    const preExistingImageUrls = new Set(
      Array.from(document.querySelectorAll('img'))
        .map((img) => img.src || img.getAttribute('src') || '')
        .filter(Boolean)
    );

    // 0. RESET COMPOSER: Clean out any leftover attachments and residual text from previous runs completely
    console.log('[BOLTHAVEN] Resetting composer: removing any leftover attachments and residual text...');
    await pruneExcessAttachments(input, 0);
    clearPromptText(input);
    await new Promise((r) => setTimeout(r, 400));

    // Prepare files in the exact sequence requested:
    // 1st: Reference design image
    // 2nd, 3rd, 4th: Condo building photos 1, 2, 3
    const filesToAttach = [];

    if (referenceImage) {
      try {
        console.log('[BOLTHAVEN] Stage 2: Preparing Reference Image (1st)...');
        const blob = await fetchImageBlob(referenceImage, '');
        const mimeType = blob.type || 'image/png';
        filesToAttach.push(new File([blob], '0_reference_design.png', { type: mimeType }));
      } catch (e) {
        console.warn('[BOLTHAVEN] Failed to prepare reference image file:', e);
      }
    }

    if (Array.isArray(condoImages) && condoImages.length > 0) {
      console.log(`[BOLTHAVEN] Stage 2: Preparing ${condoImages.length} condo building images (2nd, 3rd, 4th)...`);
      for (let i = 0; i < condoImages.length; i++) {
        const img = condoImages[i];
        const imgUrl = img.data_url || img.url || img.full_path;
        if (!imgUrl) continue;
        try {
          const blob = await fetchImageBlob(imgUrl, '');
          const mimeType = blob.type || 'image/png';
          const fname = img.filename || `condo_photo_${img.index || (i + 1)}.png`;
          filesToAttach.push(new File([blob], fname, { type: mimeType }));
        } catch (e) {
          console.warn(`[BOLTHAVEN] Failed to prepare condo image #${i + 1}:`, e);
        }
      }
    }

    const targetTotalImages = filesToAttach.length;
    console.log(`[BOLTHAVEN] Stage 2: Target total images to attach: ${targetTotalImages} (1 Reference + ${filesToAttach.length - (referenceImage ? 1 : 0)} Condo Photos)`);

    let totalImagesPasted = 0;

    if (targetTotalImages > 0) {
      // Step A: Attempt batch injection into ChatGPT file input (handles multiple files simultaneously!)
      const composer = getComposerContainer(input);
      let fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
      if (fileInputs.length === 0 && composer) {
        const plusBtn = findAttachmentButton(composer);
        if (plusBtn) {
          clickElementSafely(plusBtn);
          await new Promise((r) => setTimeout(r, 350));
          const menuItems = Array.from(
            document.querySelectorAll('[role="menuitem"], [role="menu"] button, div[class*="popover"] button')
          );
          const uploadMenuItem = menuItems.find((el) => {
            const t = (el.textContent || '').toLowerCase();
            return t.includes('upload') || t.includes('computer') || t.includes('photos & files');
          });
          if (uploadMenuItem) {
            clickElementSafely(uploadMenuItem);
            await new Promise((r) => setTimeout(r, 300));
          }
          fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
        }
      }

      let batchSuccess = false;
      if (fileInputs.length > 0) {
        try {
          const targetInput = fileInputs[0];
          console.log(`[BOLTHAVEN] Injecting ${filesToAttach.length} files into file input via DataTransfer batch...`);
          const dt = new DataTransfer();
          for (const file of filesToAttach) {
            dt.items.add(file);
          }
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
          if (nativeSetter) {
            nativeSetter.call(targetInput, dt.files);
          } else {
            targetInput.files = dt.files;
          }
          targetInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

          // Wait up to 6s for attachments to register
          await waitForImageAttached(input, 6000, targetTotalImages);
          const curCount = getAttachedImagesCount(input);
          if (curCount >= targetTotalImages) {
            batchSuccess = true;
            totalImagesPasted = curCount;
            console.log(`[BOLTHAVEN] ✓ Batch attached all ${curCount} images at once!`);
          }
        } catch (e) {
          console.warn('[BOLTHAVEN] Batch injection notice:', e);
        }
      }

      // Step B: If batch injection didn't attach all images (e.g. file input only accepted 1),
      // sequentially attach the rest one by one!
      if (!batchSuccess) {
        console.log('[BOLTHAVEN] Sequential attachment mode for remaining images...');
        let curCount = getAttachedImagesCount(input);
        for (let i = curCount; i < filesToAttach.length; i++) {
          if (activeJobAborted) throw new Error('Stage 2 aborted by user');
          const file = filesToAttach[i];
          const expectedTarget = i + 1;
          console.log(`[BOLTHAVEN] Attaching file ${expectedTarget}/${targetTotalImages}: "${file.name}"...`);
          await attachImageFileToComposer(input, file, targetTotalImages, expectedTarget);
          await new Promise((r) => setTimeout(r, 1200));
        }
        totalImagesPasted = getAttachedImagesCount(input);
      }
    }

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // 3. Set the prompt text BELOW all the attached images
    console.log('[BOLTHAVEN] Stage 2: Setting prompt text below attached images...');
    setPromptText(input, extractedPrompt || 'Create facebook advertisement from the attached reference and building photos');
    await new Promise((r) => setTimeout(r, 800));

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // 4. Wait for all image attachments (Reference + 1, 2, 3) to finish uploading to OpenAI
    const composer = getComposerContainer(input);
    await waitForAttachmentUploadComplete(composer, 25000);

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // 5. Wait for send button and click Send
    let sendBtn = findSendButton();
    let attempts = 0;
    while ((!sendBtn || !isSendButtonReady(sendBtn)) && attempts < 30) {
      if (activeJobAborted) throw new Error('Stage 2 aborted by user');
      await new Promise((r) => setTimeout(r, 350));
      sendBtn = findSendButton();
      attempts++;
    }

    if (!sendBtn) throw new Error('Send button could not be activated');
    clickElementSafely(sendBtn);
    console.log(`[BOLTHAVEN] ✓ Stage 2: Submitted ${totalImagesPasted} images + prompt! Waiting for Hero Image generation...`);

    chrome.runtime.sendMessage({
      action: 'STAGE2_PROGRESS',
      step: 'generating_image',
      images_attached: totalImagesPasted,
      message: `🎨 Generating Hero Image in ChatGPT (${totalImagesPasted} images + prompt submitted)...`,
    }).catch(() => {});

    // Give ChatGPT 3.5s to begin streaming/generating and render user prompt
    await new Promise((r) => setTimeout(r, 3500));

    // Snapshot all images on page now (includes the uploaded/pasted condo & reference images in user bubble)
    // so they are NEVER mistaken for the AI generated Hero Image!
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (src) preExistingImageUrls.add(src);
    });

    // 6. Wait for ChatGPT to finish generating the Hero Image and automatically download it!
    const startTime = Date.now();
    const maxWaitMs = 360000; // 6 minutes max for DALL-E / GPT-4o image generation
    const MIN_HERO_WAIT_MS = 15000;
    let consecutiveCalmChecks = 0;
    const REQUIRED_CALM_CHECKS = 3;
    let streamRetryCount = 0;
    const MAX_STREAM_RETRIES = 3;
    let lastRetryClickTime = 0;

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        if (activeJobAborted) {
          clearInterval(checkInterval);
          return reject(new Error('Hero image generation stopped by user'));
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > maxWaitMs) {
          clearInterval(checkInterval);
          return reject(new Error('ChatGPT Hero image generation timed out (6 min)'));
        }

        const currentlyGenerating = isThinkingOrGenerating();

        // Auto-retry if "Error in message stream" occurs
        const now = Date.now();
        if (!currentlyGenerating && now - lastRetryClickTime > 4000) {
          const retryBtn = findRetryButton();
          if (retryBtn) {
            if (streamRetryCount < MAX_STREAM_RETRIES) {
              streamRetryCount++;
              lastRetryClickTime = now;
              consecutiveCalmChecks = 0;
              console.log(`[BOLTHAVEN] ⚠️ Stream error detected! Auto-clicking Retry (${streamRetryCount}/${MAX_STREAM_RETRIES})...`);
              retryBtn.click();
              return;
            } else {
              clearInterval(checkInterval);
              return reject(new Error('ChatGPT Hero generation failed after 3 stream retries'));
            }
          }
        }

        // 1. Locate newly generated Hero image
        const heroImg = findGeneratedHeroImage(preExistingImageUrls);

        // 2. Check if generation is still actively running
        const generating = isThinkingOrGenerating();

        // If the image is already fully loaded and rendered on screen
        const isImageReady = heroImg && (heroImg.complete || (heroImg.naturalWidth && heroImg.naturalWidth >= 100) || (heroImg.width && heroImg.width >= 100));

        // Block/wait if still generating OR image is not yet rendered OR elapsed < 15s
        if (generating || !isImageReady || elapsed < MIN_HERO_WAIT_MS) {
          consecutiveCalmChecks = 0;
          return;
        }

        if (isImageReady) {
          consecutiveCalmChecks++;
          console.log(`[BOLTHAVEN] Hero image detected on screen (calm check ${consecutiveCalmChecks}/${REQUIRED_CALM_CHECKS})...`);
          if (consecutiveCalmChecks >= REQUIRED_CALM_CHECKS) {
            clearInterval(checkInterval);
            const finalUrl = heroImg.src || heroImg.getAttribute('src') || '';
            console.log('[BOLTHAVEN] ✓ Hero Image generation complete! Downloading:', finalUrl);

            preExistingImageUrls.add(finalUrl);
            const safeCondoSlug = String(condoName || 'hero')
              .replace(/[^a-zA-Z0-9_-]+/g, '_')
              .replace(/^_+|_+$/g, '')
              .slice(0, 40) || 'hero';
            const fileName = `fb_hero_${safeCondoSlug}_${Date.now()}.png`;

            chrome.runtime.sendMessage({
              action: 'STAGE2_PROGRESS',
              step: 'downloading_image',
              images_attached: totalImagesPasted,
              result_url: finalUrl,
              message: `⬇️ Downloading generated Hero Image (${fileName})...`,
            }).catch(() => {});

            // A. Trigger native ChatGPT download button on image card (if visible/available)
            try {
              const nativeBtn = findGeneratedImageDownloadButton(heroImg);
              if (nativeBtn) {
                console.log('[BOLTHAVEN] Clicking native ChatGPT image download button...');
                clickElementSafely(nativeBtn);
                await new Promise((r) => setTimeout(r, 800));
              }
            } catch (e) {
              console.warn('[BOLTHAVEN] Native download button click notice:', e.message);
            }

            // B. Also trigger direct download to browser downloads directory
            await downloadEnhancedImage(heroImg, finalUrl, fileName);
            await new Promise((r) => setTimeout(r, 2000));

            return resolve({
              success: true,
              imagesAttached: totalImagesPasted,
              result_url: finalUrl,
              filename: fileName,
            });
          }
        }
      }, 1000);
    });
  }

  // Listen for commands from background worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'STOP_TAB_JOB' || request.action === 'ABORT_TAB_JOB') {
      activeJobAborted = true;
      try {
        const stopBtn = findStopButton();
        if (stopBtn) {
          clickElementSafely(stopBtn);
          console.log('[BOLTHAVEN] Clicked ChatGPT Stop button to halt active generation');
        }
      } catch (e) {}
      console.log('[BOLTHAVEN] Tab job aborted on user command');
      sendResponse({ success: true, aborted: true });
      return true;
    }

    if (request.action === 'PROCESS_TAB_JOB') {
      processJobInTab(request.job)
        .then((result) => sendResponse({ success: true, result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // asynchronous
    }

    if (request.action === 'TEST_ATTACH') {
      (async () => {
        try {
          const input = document.querySelector('#prompt-textarea, [contenteditable="true"], textarea');
          if (!input) return sendResponse({ success: false, error: 'No prompt textarea found' });

          const testUrl = 'http://localhost:8085/storage/uploads/facebook-import/FB-20261029-182451-0004/image_001.jpg';
          console.log('[BOLTHAVEN] TEST_ATTACH fetching image:', testUrl);
          const blob = await fetchImageBlob(testUrl, '');
          const file = new File([blob], 'image_001.jpg', { type: blob.type || 'image/jpeg' });

          console.log('[BOLTHAVEN] TEST_ATTACH invoking attachImageFileToComposer...');
          const result = await attachImageFileToComposer(input, file);
          const attachedCount = getAttachedImagesCount(input);
          const strictComposer = getComposerContainer(input);
          const imgs = strictComposer ? Array.from(strictComposer.querySelectorAll('img')).map((i) => i.src) : [];

          sendResponse({
            success: result,
            attachedCount,
            imgs,
            fileSize: file.size,
          });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (request.action === 'EXTRACT_STAGE1_PROMPT') {
      extractStage1Prompt(request.prompt)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === 'EXECUTE_STAGE2_STAGING') {
      executeStage2Staging({
        extractedPrompt: request.extractedPrompt,
        referenceImage: request.referenceImage,
        condoImages: request.condoImages,
        condoName: request.condoName,
      })
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === 'INSPECT_CHATGPT') {
      const allImgs = Array.from(document.querySelectorAll('img')).map((img) => ({
        src: (img.src || img.getAttribute('src') || '').slice(0, 120),
        alt: img.alt,
        w: img.width || img.naturalWidth || Math.round(img.getBoundingClientRect().width),
        h: img.height || img.naturalHeight || Math.round(img.getBoundingClientRect().height),
        inTurn: Boolean(img.closest('article, [data-message-author-role], [data-testid*="conversation-turn"]')),
        inComposer: Boolean(img.closest('form, div[class*="composer"]')),
      }));
      const stopBtn = findStopButton();
      const isGen = isThinkingOrGenerating();
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]')).map((i) => ({
        id: i.id,
        name: i.name,
        accept: i.accept,
        multiple: i.multiple,
        style: i.getAttribute('style'),
        parentTag: i.parentElement?.tagName,
        parentClass: i.parentElement?.className,
      }));
      const composer = getComposerContainer() || document.querySelector('form') || document.body;
      const buttons = Array.from(composer.querySelectorAll('button')).map((b) => ({
        aria: b.getAttribute('aria-label'),
        testid: b.getAttribute('data-testid'),
        id: b.id,
        text: (b.innerText || '').slice(0, 30),
        rect: { w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) },
        svgHtml: (b.querySelector('svg')?.outerHTML || '').slice(0, 100),
      }));
      const input = document.querySelector('#prompt-textarea, [contenteditable="true"], textarea');
      const attachedCount = input ? getAttachedImagesCount(input) : 0;
      const removeButtons = input ? findAttachmentRemoveButtons(getComposerContainer(input)) : [];
      const thumbCards = input ? getAttachmentThumbnailCards(input) : [];
      const strictComposer = input ? (input.closest('div[class*="ComposerLayoutRoot" i], div[class*="ComposerMode" i]') || input.closest('form') || input.parentElement?.parentElement?.parentElement?.parentElement) : null;
      const strictImgs = strictComposer ? Array.from(strictComposer.querySelectorAll('img')).map((i) => i.src) : [];
      sendResponse({
        isGen,
        hasStopBtn: Boolean(stopBtn),
        imagesCount: allImgs.length,
        strictImgsCount: strictImgs.length,
        attachedCount,
        removeButtonsCount: removeButtons.length,
        thumbCardsCount: thumbCards.length,
        url: window.location.href,
      });
      return true;
    }

    if (request.action === 'PING_TAB') {
      sendResponse({ status: 'ready', url: window.location.href });
      return true;
    }
  });
})();
