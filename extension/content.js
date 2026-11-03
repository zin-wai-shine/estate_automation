/**
 * BoltHaven Browser Companion — Content Script for ChatGPT (chatgpt.com)
 * Handles automated prompt injection, image attachment, sending, and completion detection.
 */

(() => {
  // Clear any existing keepalive interval if script is re-injected
  if (window.__bolthaven_keepalive_timer) {
    clearInterval(window.__bolthaven_keepalive_timer);
  }
  window.__bolthaven_injected = true;

  console.log('[BOLTHAVEN] ChatGPT Tab Worker active on:', window.location.href);

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
    }
  }

  // Connect on tab load
  connectKeepAlive();
  // Continuously ping every 3 seconds to guarantee background service worker stays awake
  window.__bolthaven_keepalive_timer = setInterval(connectKeepAlive, 3000);

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
      document.querySelector('div[contenteditable="true"].ProseMirror') ||
      document.querySelector('div.ProseMirror') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('textarea[data-id="root"]') ||
      document.querySelector('textarea')
    );
  }

  // Safely click any interactive DOM element using native pointer and mouse events
  function clickElementSafely(el) {
    if (!el) return false;
    try {
      el.focus();
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const mouseOpts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, buttons: 1 };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...mouseOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
      el.dispatchEvent(new PointerEvent('pointerup', { ...mouseOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
      el.dispatchEvent(new MouseEvent('click', mouseOpts));
      el.click();
      return true;
    } catch (e) {
      try { el.click(); } catch (e2) {}
      return false;
    }
  }
  window.clickElementSafely = clickElementSafely;

  // Safely click send button using native pointer, mouse, submit, and keyboard Enter events
  function clickSendButton(btn) {
    if (!btn) return false;
    try {
      btn.focus();

      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const mouseOpts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, buttons: 1 };

      btn.dispatchEvent(new PointerEvent('pointerdown', { ...mouseOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
      btn.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
      btn.dispatchEvent(new PointerEvent('pointerup', { ...mouseOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
      btn.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
      btn.dispatchEvent(new MouseEvent('click', mouseOpts));
      btn.click();

      // Also trigger form.requestSubmit if button belongs to a form
      if (btn.form && typeof btn.form.requestSubmit === 'function') {
        try {
          btn.form.requestSubmit(btn);
        } catch (e) {}
      }

      // Also dispatch Enter key on prompt input
      const promptTarget = findPromptInput();
      if (promptTarget) {
        promptTarget.focus();
        promptTarget.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, charCode: 13, bubbles: true, cancelable: true, composed: true, shiftKey: false
        }));
        promptTarget.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, charCode: 13, bubbles: true, cancelable: true, composed: true, shiftKey: false
        }));
      }

      // Also trigger click in MAIN world context (bypasses Chrome isolated world limitations for React events)
      try {
        chrome.runtime.sendMessage({ action: 'CLICK_SEND_MAIN_WORLD' }, () => {});
      } catch (e) {}

      return true;
    } catch (e) {
      try { btn.click(); } catch (e2) {}
      return false;
    }
  }

  // Find ChatGPT send button (strictly excluding desktop app, model pickers, files, mic, etc.)
  function findSendButton() {
    // 1. Explicit modern attributes
    const explicit = (
      document.querySelector('button[data-testid="send-button"]') ||
      document.querySelector('button[data-testid="composer-send-button"]') ||
      document.querySelector('button[aria-label="Send"]') ||
      document.querySelector('button[aria-label="Send prompt"]') ||
      document.querySelector('button[aria-label="Send message"]')
    );
    if (explicit && isSendButtonReady(explicit) && !isStopButton(explicit)) return explicit;

    // 2. Search composer toolbar for the send button (circular button with SVG up-arrow)
    const composer = getComposerContainer() || document;
    const buttons = Array.from(composer.querySelectorAll('button:not(:disabled)')).filter((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const testid = (b.getAttribute('data-testid') || '').toLowerCase();
      const text = (b.innerText || b.textContent || '').trim().toLowerCase();

      // STRICT RULE: The send button NEVER has text!
      if (text.length > 0) return false;

      // STRICT RULE: Never match the stop button!
      if (isStopButton(b)) return false;

      // Exclude model picker, desktop app, attachments, mic, voice, reason, files, projects, plugins, editor, copy, share
      if (
        aria.includes('stop') ||
        aria.includes('cancel') ||
        aria.includes('editor') ||
        aria.includes('desktop') ||
        aria.includes('app') ||
        aria.includes('project') ||
        aria.includes('plugin') ||
        aria.includes('model') ||
        aria.includes('gpt') ||
        aria.includes('voice') ||
        aria.includes('mic') ||
        aria.includes('dictate') ||
        aria.includes('record') ||
        aria.includes('attach') ||
        aria.includes('add files') ||
        aria.includes('plus') ||
        aria.includes('remove') ||
        aria.includes('copy') ||
        aria.includes('share') ||
        aria.includes('pin') ||
        aria.includes('more') ||
        aria.includes('action') ||
        testid.includes('stop') ||
        testid.includes('desktop') ||
        testid.includes('app') ||
        testid.includes('attach') ||
        testid.includes('voice') ||
        testid.includes('mic')
      ) {
        return false;
      }

      // Send button is always a small circular button with an SVG icon
      const rect = b.getBoundingClientRect();
      if (rect.width > 54 || rect.height > 54 || rect.width < 18 || rect.height < 18) {
        return false;
      }

      // Must be near or below the prompt textarea, never way above in the chat history
      const promptInput = findPromptInput();
      const promptRect = promptInput?.getBoundingClientRect();
      if (promptRect && rect.bottom < promptRect.top - 10) {
        return false;
      }

      return Boolean(b.querySelector('svg'));
    });

    if (buttons.length > 0) {
      buttons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
      return buttons[0];
    }

    return (explicit && !isStopButton(explicit)) ? explicit : null;
  }

  function isStopButton(el) {
    if (!el) return false;
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const testid = (el.getAttribute('data-testid') || '').toLowerCase();
    if (aria.includes('stop') || testid.includes('stop')) return true;
    if (el.querySelector('svg rect, svg square')) return true;
    return false;
  }

  // Check if send button is actually interactive and ready
  function isSendButtonReady(btn) {
    if (!btn) return false;
    if (btn.disabled) return false;
    if (btn.getAttribute('aria-disabled') === 'true') return false;
    if (btn.classList.contains('disabled')) return false;
    return true;
  }

  // Find thumbnail card containers in composer
  function getAttachmentThumbnailCards(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];
    return Array.from(composer.querySelectorAll('[class*="attachment" i], [class*="thumbnail" i], [data-testid*="attachment" i]'));
  }

  // Wait for the attachment thumbnail in composer to finish uploading to OpenAI server
  async function waitForAttachmentUploadComplete(composerEl, maxWaitMs = 4000) {
    const deadline = Date.now() + maxWaitMs;
    console.log('[BOLTHAVEN] Checking attachment upload status in composer...');
    while (Date.now() < deadline) {
      if (activeJobAborted) return false;
      const composer = composerEl || getComposerContainer() || document;

      // Only check genuine spinning loader icons (NEVER raw SVG circle tag which matches static icons!)
      const spinner = composer.querySelector('svg.animate-spin, [class*="animate-spin"], [role="progressbar"], div[class*="loading" i]');
      const sendBtn = findSendButton();
      const sendReady = isSendButtonReady(sendBtn);

      if (!spinner && sendReady) {
        await new Promise((r) => setTimeout(r, 300));
        console.log('[BOLTHAVEN] ✓ Attachment ready in composer!');
        return true;
      }

      await new Promise((r) => setTimeout(r, 200));
    }
    console.log('[BOLTHAVEN] Attachment settled, proceeding to prompt...');
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

  // Get active composer container element (holds both attachments row and footer toolbar)
  function getComposerContainer(inputEl) {
    const input = inputEl || findPromptInput();
    if (!input) {
      return document.querySelector('[class*="ComposerLayoutBody" i], [class*="ComposerLayoutRoot" i], form') || document.body;
    }

    // Modern ChatGPT structure:
    // Level 0: ProseMirror (#prompt-textarea)
    // Level 2: ComposerLayoutInput
    // Level 6: ComposerLayoutBody (contains attachments row, input, and footer toolbar with Send button)
    const layoutBody = input.closest('[class*="ComposerLayoutBody" i]') || input.closest('[class*="ComposerLayoutRoot" i]');
    if (layoutBody) return layoutBody;

    // Check standard form
    const form = input.closest('form');
    if (form) return form;

    // Walk up until we reach a parent that has both the input AND buttons (Send, Attach)
    let cur = input.parentElement;
    for (let depth = 0; depth < 8 && cur && cur !== document.body; depth++) {
      if (cur.querySelectorAll('button').length >= 3) {
        return cur;
      }
      cur = cur.parentElement;
    }

    return cur || document.body;
  }

  // Find the attachment (+) button on the ChatGPT composer
  function findAttachmentButton(composer) {
    const searchRoots = [composer, getComposerContainer(), document].filter(Boolean);

    for (const root of searchRoots) {
      // 1. Explicit aria-label or data-testid
      const explicit = root.querySelector(
        'button[aria-label*="Add files" i], ' +
        'button[aria-label*="Attach" i], ' +
        'button[aria-label*="Upload" i], ' +
        'button[aria-label*="Add file" i], ' +
        'button[aria-label*="Add photo" i], ' +
        'button[aria-label*="Add content" i], ' +
        'button[data-testid*="attach" i], ' +
        'button[data-testid*="upload" i]'
      );
      if (explicit && !explicit.disabled) return explicit;

      // 2. Button with text "Files" (present in "Work with ChatGPT" mode)
      const buttons = Array.from(root.querySelectorAll('button:not(:disabled)'));
      for (const b of buttons) {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const text = (b.textContent || '').trim().toLowerCase();
        if (aria.includes('send') || aria.includes('voice') || aria.includes('mic') || aria.includes('dictate') || text.includes('send')) {
          continue;
        }
        if (text === 'files' || aria.includes('files') || aria.includes('upload') || aria.includes('attach')) {
          return b;
        }
        const svg = b.querySelector('svg');
        if (svg) {
          const svgHtml = svg.innerHTML || '';
          if (svgHtml.includes('line') || svgHtml.includes('path') || svgHtml.includes('polygon')) {
            const rect = b.getBoundingClientRect();
            if (rect.width >= 16 && rect.height >= 16 && rect.width <= 60 && rect.height <= 60) {
              return b;
            }
          }
        }
      }
    }
    return null;
  }

  // Find all genuine thumbnail preview img elements strictly inside the ChatGPT composer
  function getComposerAttachmentThumbnails() {
    const allImgs = Array.from(document.querySelectorAll('img'));

    const imgs = allImgs.filter((img) => {
      // Exclude messages in conversation history turns, header, and sidebar
      if (img.closest('article, [data-message-author-role], [data-testid*="conversation-turn"], nav, header, aside, [data-testid*="sidebar"]')) {
        return false;
      }

      const src = img.src || img.getAttribute('src') || '';
      if (!src) return false;
      const lowerSrc = src.toLowerCase();
      if (
        lowerSrc.includes('avatar') ||
        lowerSrc.includes('profile') ||
        lowerSrc.includes('icon') ||
        lowerSrc.includes('emoji') ||
        lowerSrc.includes('logo') ||
        lowerSrc.includes('favicon')
      ) {
        return false;
      }
      const alt = (img.alt || '').toLowerCase();
      if (alt.includes('avatar') || alt.includes('profile') || alt.includes('logo')) {
        return false;
      }

      // If it's a blob, data URL, or oaiusercontent, it's definitely an attachment preview!
      if (lowerSrc.startsWith('blob:') || lowerSrc.startsWith('data:') || lowerSrc.includes('oaiusercontent') || lowerSrc.includes('files')) {
        return true;
      }

      const rect = img.getBoundingClientRect();
      return (rect.width >= 15 && rect.height >= 15) || (img.naturalWidth >= 15 && img.naturalHeight >= 15);
    });

    return imgs;
  }

  // Find all genuine thumbnail preview canvas elements strictly inside the ChatGPT composer
  function getComposerAttachmentCanvases(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];

    return Array.from(composer.querySelectorAll('canvas')).filter((canvas) => {
      if (canvas.closest('article, [data-message-author-role], [data-testid*="conversation-turn"], nav, header, aside, [data-testid*="sidebar"]')) return false;
      const rect = canvas.getBoundingClientRect();
      return (rect.width >= 15 && rect.height >= 15) || canvas.width >= 15;
    });
  }

  // Find any thumbnail containers with background-image inside composer
  function getComposerAttachmentBgDivs(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];

    return Array.from(composer.querySelectorAll('div[style*="background-image"], [data-testid*="attachment"]')).filter((el) => {
      if (el.closest('article, [data-message-author-role], [data-testid*="conversation-turn"], nav, header, aside, [data-testid*="sidebar"]')) return false;
      if (el.querySelector('img, canvas')) return false;
      const style = el.getAttribute('style') || '';
      return style.includes('blob:') || style.includes('data:image');
    });
  }

  // Find thumbnail preview img element strictly inside the ChatGPT composer
  function getComposerAttachmentThumbnail(inputEl) {
    const thumbs = getComposerAttachmentThumbnails(inputEl);
    return thumbs.length > 0 ? thumbs[0] : null;
  }

  // Find thumbnail delete / remove buttons strictly inside the composer (excluding attach/plus button!)
  function findAttachmentRemoveButtons(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];

    const allButtons = Array.from(composer.querySelectorAll('button:not(:disabled)'));

    return allButtons.filter((btn) => {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const testid = (btn.getAttribute('data-testid') || '').toLowerCase();
      const text = (btn.textContent || '').trim().toLowerCase();

      // Exclude Send, Attach, Model, Voice
      if (
        aria.includes('send') || aria.includes('plus') || aria.includes('add files') ||
        aria.includes('voice') || aria.includes('mic') || aria.includes('dictate') ||
        aria.includes('model') || text === 'files' || text === 'send' ||
        testid.includes('send') || testid.includes('attach')
      ) {
        return false;
      }

      // Explicit remove/delete labels in ChatGPT (e.g. "Remove image_001.jpg", "Dismiss")
      if (
        aria.startsWith('remove') ||
        aria.includes('remove') ||
        aria.includes('delete') ||
        aria.includes('dismiss') ||
        testid.includes('remove') ||
        testid.includes('delete')
      ) {
        return true;
      }

      const parentThumb = btn.closest('[class*="attachment" i], [class*="thumbnail" i], [data-testid*="attachment" i]');
      if (parentThumb && btn.querySelector('svg')) {
        return true;
      }

      return false;
    });
  }

  // Count distinct genuine image attachments present in the composer
  function getAttachedImagesCount(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return 0;

    // 1. Remove buttons strictly inside composer (each attached file has exactly one remove button!)
    const removeBtns = findAttachmentRemoveButtons(composer);
    if (removeBtns.length > 0) return removeBtns.length;

    // 2. Thumbnail images strictly inside composer (excluding icons/avatars)
    const thumbImgs = Array.from(composer.querySelectorAll('img')).filter((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (!src) return false;
      const lower = src.toLowerCase();
      if (lower.includes('avatar') || lower.includes('profile') || lower.includes('icon') || lower.includes('logo')) return false;
      const rect = img.getBoundingClientRect();
      return (rect.width >= 30 && rect.height >= 30);
    });
    if (thumbImgs.length > 0) return thumbImgs.length;

    return 0;
  }

  // Detect whether an image thumbnail/attachment is actively present in the ChatGPT composer
  function isImageAttachedInComposer(inputEl, minCount = 1) {
    return getAttachedImagesCount(inputEl) >= minCount;
  }

  // Clear any leftover attachments before starting a new job
  async function pruneExcessAttachments(inputEl, maxExpected = 0) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return;

    let attempts = 0;
    while (getAttachedImagesCount(composer) > maxExpected && attempts < 6) {
      attempts++;
      console.log(`[BOLTHAVEN] Pruning attachments (attempt ${attempts}, count: ${getAttachedImagesCount(composer)})...`);
      const removeBtns = findAttachmentRemoveButtons(composer);
      for (const btn of removeBtns) {
        try {
          btn.click();
          await new Promise((r) => setTimeout(r, 150));
        } catch (e) {}
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  // Wait until image attachment is genuinely detected in composer
  async function waitForImageAttached(inputEl, timeoutMs = 8000, minCount = 1) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (activeJobAborted) return false;
      if (getAttachedImagesCount(inputEl) >= minCount) {
        await new Promise((r) => setTimeout(r, 300));
        return true;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return getAttachedImagesCount(inputEl) >= minCount;
  }

  // Check if a text is just a ChatGPT placeholder
  function isPlaceholderText(t) {
    if (!t) return true;
    const lower = t.trim().toLowerCase();
    return (
      lower === 'work with chatgpt' ||
      lower === 'message chatgpt' ||
      lower === 'ask anything' ||
      lower === 'what should we work on?'
    );
  }

  // Safely get text content from textarea or contenteditable div (ignoring placeholder text)
  function getComposerText(inputEl) {
    const promptArea = inputEl || findPromptInput();
    if (!promptArea) return '';
    if (promptArea.tagName && promptArea.tagName.toLowerCase() === 'textarea') {
      const v = (promptArea.value || '').trim();
      return isPlaceholderText(v) ? '' : v;
    }
    const ps = Array.from(promptArea.querySelectorAll('p'));
    let text = '';
    if (ps.length > 0) {
      text = ps.map((p) => p.textContent || '').join('\n').trim();
    } else {
      text = (promptArea.innerText || promptArea.textContent || '').trim();
    }
    return isPlaceholderText(text) ? '' : text;
  }

  // Check whether the prompt text has actually been accepted and inserted into ChatGPT's composer
  function isPromptActuallyInserted(expectedText, inputEl) {
    const promptArea = inputEl || findPromptInput();
    if (!promptArea) return false;
    const current = getComposerText(promptArea);
    if (!current || current.length < 5) return false;
    if (expectedText) {
      const cleanExpected = expectedText.trim().toLowerCase();
      const firstChunk = cleanExpected.slice(0, Math.min(20, cleanExpected.length));
      if (!current.toLowerCase().includes(firstChunk)) {
        return false;
      }
    }
    return true;
  }

  // Safely clear ONLY prompt text (preserving any attached images)
  function clearPromptText(inputEl) {
    const promptArea = inputEl || findPromptInput();
    if (!promptArea) return;
    try {
      if (promptArea.tagName && promptArea.tagName.toLowerCase() === 'textarea') {
        promptArea.value = '';
        promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        promptArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        return;
      }
      promptArea.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(promptArea);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete', false, null);
      promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      promptArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } catch (e) {}
  }

  // Set prompt text inside textarea or ProseMirror contenteditable without touching attachments
  function setPromptText(inputEl, text) {
    let cleanText = '';
    let promptArea = null;
    if (typeof inputEl === 'string') {
      cleanText = inputEl.trim();
      promptArea = findPromptInput();
    } else {
      cleanText = (text || '').trim();
      promptArea = inputEl || findPromptInput();
    }
    if (!cleanText || !promptArea) return false;

    // CASE 1: Standard HTML <textarea>
    if (promptArea.tagName && promptArea.tagName.toLowerCase() === 'textarea') {
      promptArea.focus();
      promptArea.value = cleanText;
      promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      promptArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      return isPromptActuallyInserted(cleanText, promptArea);
    }

    // CASE 2: ProseMirror / contenteditable div
    promptArea.focus();

    // Method 0: Select all and execute atomic insertText (preserves ProseMirror document transaction)
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(promptArea);
      sel.removeAllRanges();
      sel.addRange(range);
      const inserted = document.execCommand('insertText', false, cleanText);
      if (inserted && isPromptActuallyInserted(cleanText, promptArea)) {
        promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        console.log(`[BOLTHAVEN] setPromptText: Method 0 (execCommand insertText) succeeded (${getComposerText(promptArea).length} chars)`);
        return true;
      }
    } catch (e) {}

    // Method 1: Synthetic beforeinput with insertFromPaste (ProseMirror's primary native path)
    try {
      promptArea.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', cleanText);
      promptArea.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertFromPaste',
        dataTransfer: dt,
      }));
    } catch (e) {}

    if (isPromptActuallyInserted(cleanText, promptArea)) {
      promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      console.log(`[BOLTHAVEN] setPromptText: Method 1 (beforeinput insertFromPaste) succeeded (${getComposerText(promptArea).length} chars)`);
      return true;
    }

    // Method 2: Synthetic paste event with clipboardData (ProseMirror paste plugin)
    try {
      promptArea.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', cleanText);
      const pasteEv = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      Object.defineProperty(pasteEv, 'clipboardData', { value: dt });
      promptArea.dispatchEvent(pasteEv);
    } catch (e) {}

    if (isPromptActuallyInserted(cleanText, promptArea)) {
      promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      console.log(`[BOLTHAVEN] setPromptText: Method 2 (native paste) succeeded (${getComposerText(promptArea).length} chars)`);
      return true;
    }

    // Method 3: Line-by-line insertion with insertText and insertParagraph
    try {
      promptArea.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(promptArea);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);

      const lines = cleanText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          document.execCommand('insertText', false, lines[i]);
        }
        if (i < lines.length - 1) {
          document.execCommand('insertParagraph', false, null);
        }
      }
    } catch (e) {}

    if (isPromptActuallyInserted(cleanText, promptArea)) {
      promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      console.log(`[BOLTHAVEN] setPromptText: Method 3 (execCommand lines) succeeded (${getComposerText(promptArea).length} chars)`);
      return true;
    }

    // Method 4: Direct paragraph structure + input event (reliable when switching tabs)
    try {
      const lines = cleanText.split('\n');
      promptArea.innerHTML = lines.map((l) => `<p>${l || '<br>'}</p>`).join('');
      promptArea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText' }));
    } catch (e) {}

    promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    promptArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    const ready = isPromptActuallyInserted(cleanText, promptArea);
    console.log(`[BOLTHAVEN] setPromptText final check: ${ready ? 'SUCCESS' : 'FAILED'} ("${getComposerText(promptArea).slice(0, 35)}...")`);
    return ready;
  }

  // Convert base64 data URL to Blob synchronously (handles massive data URLs in <1ms without message passing)
  function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    try {
      const parts = dataUrl.split(',');
      if (parts.length < 2) return null;
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
      const binary = atob(parts[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      return new Blob([array], { type: mime });
    } catch (e) {
      console.warn('[BOLTHAVEN] dataUrlToBlob conversion failed:', e.message);
      return null;
    }
  }

  // Fetch image blob from primary or fallback URL (preferring local storage via background)
  async function fetchImageBlob(primaryUrl, fallbackUrl) {
    // 0. Instant direct conversion if URL is already a data: URI
    if (primaryUrl && primaryUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(primaryUrl);
      if (blob) return blob;
    }
    if (fallbackUrl && fallbackUrl.startsWith('data:')) {
      const blob = dataUrlToBlob(fallbackUrl);
      if (blob) return blob;
    }

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
    const targetInputArea = inputEl || findPromptInput();

    // 1. Prune leftover attachments only if strictly required
    let currentCount = getAttachedImagesCount();
    if (maxExpected === 1 && currentCount > 0) {
      console.log(`[BOLTHAVEN] Pruning ${currentCount} leftover attachments to 0 before attaching single image...`);
      await pruneExcessAttachments(inputEl, 0);
      await new Promise((r) => setTimeout(r, 400));
    } else if (maxExpected > 1 && currentCount >= maxExpected) {
      console.log(`[BOLTHAVEN] Current attachments (${currentCount}) >= max expected (${maxExpected}). Pruning excess...`);
      await pruneExcessAttachments(inputEl, maxExpected - 1);
      await new Promise((r) => setTimeout(r, 400));
    }

    if (activeJobAborted) return false;

    // 2. ATTACH:
    // Method A: Native ClipboardEvent paste directly on prompt textarea / ProseMirror
    let pasteDispatched = false;
    if (targetInputArea) {
      try {
        targetInputArea.focus();
        const dt = new DataTransfer();
        dt.items.add(file);
        const pasteEv = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          composed: true,
          clipboardData: dt,
        });
        targetInputArea.dispatchEvent(pasteEv);
        pasteDispatched = true;
      } catch (e) {
        console.warn('[BOLTHAVEN] Paste dispatch warning:', e);
      }
    }

    // Method B: Complement with native input[type="file"]
    let fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
    let targetInput = fileInputs.find((i) => (i.accept || '').includes('image')) ||
                      fileInputs[fileInputs.length - 1] ||
                      fileInputs[0];

    // If no file input in DOM (rare), check "Files" button or attachment (+) button to reveal it
    if (!targetInput) {
      const filesBtn = Array.from(document.querySelectorAll('button:not(:disabled)')).find((b) => {
        const t = (b.textContent || '').trim().toLowerCase();
        return t === 'files' || t.startsWith('files');
      });
      if (filesBtn) {
        clickElementSafely(filesBtn);
        await new Promise((r) => setTimeout(r, 400));
        fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
        targetInput = fileInputs[fileInputs.length - 1] || fileInputs[0];
      }
    }

    if (!targetInput) {
      const plusBtn = findAttachmentButton();
      if (plusBtn) {
        clickElementSafely(plusBtn);
        await new Promise((r) => setTimeout(r, 400));
        fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
        targetInput = fileInputs[fileInputs.length - 1] || fileInputs[0];
        // Close menu immediately so it doesn't block UI
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      }
    }

    if (targetInput) {
      console.log(`[BOLTHAVEN] Injecting single file into file input (${targetInput.accept || 'all'})...`);
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

      // CRITICAL: Dispatch ONLY 'change' event!
      targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      // Send Escape key to close any popover or menu that opened
      await new Promise((r) => setTimeout(r, 200));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

      // Wait up to 6s for the single image attachment to appear
      const attached = await waitForImageAttached(inputEl, 6000, 1);
      if (attached) {
        console.log(`[BOLTHAVEN] ✓ Image attachment confirmed via file input (${getAttachedImagesCount()} attached)`);
        return true;
      }
    }

    return pasteDispatched || isImageAttachedInComposer();
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

  // ── Watch ChatGPT Generation & Auto-Download Enhanced Result ────────────
  async function watchGenerationAndDownload(job, preExistingImageUrls, preAssistantCount) {
    console.log(`[BOLTHAVEN] [Generation Phase] Monitoring ChatGPT generation for Image #${job.original_position || 1}...`);

    // Minimum wait for prompt dispatch and user's input image turn to render
    await new Promise((r) => setTimeout(r, 3500));
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (src) preExistingImageUrls.add(src);
    });

    const startTime = Date.now();
    const maxWaitMs = 360000; // 6 minutes max
    const MIN_GENERATION_WAIT_MS = 15000; // Must wait at least 15s (AI generation takes 30-90s)
    let consecutiveCalmChecks = 0;
    const REQUIRED_CALM_CHECKS = 3;
    let streamRetryCount = 0;
    const MAX_STREAM_RETRIES = 3;
    let lastRetryClickTime = 0;

    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        if (activeJobAborted) {
          clearInterval(checkInterval);
          chrome.runtime.sendMessage({
            action: 'JOB_GENERATION_FAILED',
            jobId: job.job_id,
            error: 'Job stopped by user',
          }).catch(() => {});
          return resolve({ success: false, error: 'Job stopped by user' });
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > maxWaitMs) {
          clearInterval(checkInterval);
          chrome.runtime.sendMessage({
            action: 'JOB_GENERATION_FAILED',
            jobId: job.job_id,
            error: 'ChatGPT image generation timed out (6 min)',
          }).catch(() => {});
          return resolve({ success: false, error: 'ChatGPT image generation timed out (6 min)' });
        }

        const currentlyGenerating = isThinkingOrGenerating();

        // ── Auto-retry on "Error in message stream" ───────────────────────
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
              chrome.runtime.sendMessage({
                action: 'JOB_GENERATION_FAILED',
                jobId: job.job_id,
                error: 'ChatGPT generation failed: "Error in message stream" persisted after 3 retries.',
              }).catch(() => {});
              return resolve({ success: false, error: 'ChatGPT generation failed: "Error in message stream" persisted after 3 retries.' });
            }
          }
        }

        // 1. If still generating or minimum wait time hasn't passed, reset calm counter
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

        // 3. Image detected and generation calm
        consecutiveCalmChecks++;
        console.log(
          `[BOLTHAVEN] Enhanced Image #${job.original_position || 1} detected on screen (calm check ${consecutiveCalmChecks}/${REQUIRED_CALM_CHECKS})...`
        );

        if (consecutiveCalmChecks >= REQUIRED_CALM_CHECKS) {
          clearInterval(checkInterval);
          const finalUrl = enhancedImg.src || enhancedImg.getAttribute('src') || '';
          console.log(`[BOLTHAVEN] ✓ Generation fully finished! Enhanced Image #${job.original_position || 1}:`, finalUrl);

          preExistingImageUrls.add(finalUrl);
          const fileName = `enhanced_${job.original_position || 1}_${job.job_id || Date.now()}.png`;

          // Download using reliable downloader
          await downloadEnhancedImage(enhancedImg, finalUrl, fileName);
          await new Promise((r) => setTimeout(r, 2500));

          // Notify background that generation & download succeeded
          chrome.runtime.sendMessage({
            action: 'JOB_GENERATION_COMPLETE',
            jobId: job.job_id,
            original_position: job.original_position,
            result_url: finalUrl,
          }).catch(() => {});

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

  let activeJobRunning = false;

  // ── Setup & Send Phase: Attach 1 image + prompt + submit cleanly ───────────
  async function setupAndSendJob(job) {
    if (activeJobRunning) {
      console.warn(`[BOLTHAVEN] Job is already running on this tab! Ignoring duplicate call for Image #${job.original_position}`);
      return { success: false, error: 'Job already in progress on this tab' };
    }
    activeJobRunning = true;
    try {
      return await _setupAndSendJobInternal(job);
    } finally {
      activeJobRunning = false;
    }
  }

  async function _setupAndSendJobInternal(job) {
    activeJobAborted = false;
    console.log(`[BOLTHAVEN] [Setup Phase] Setting up Image #${job.original_position || 1} (Job ${job.job_id})...`);

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], .ProseMirror, textarea', 25000);
    if (!input) {
      throw new Error('Could not locate ChatGPT prompt input textarea');
    }

    if (activeJobAborted) {
      clearPromptText(input);
      throw new Error('Job stopped by user');
    }

    // Safety guard: If tab is currently busy generating an in-progress image, wait for it
    const preWaitStart = Date.now();
    while (isThinkingOrGenerating() && Date.now() - preWaitStart < 240000) {
      if (activeJobAborted) {
        clearPromptText(input);
        throw new Error('Job stopped by user');
      }
      console.log(`[BOLTHAVEN] Tab currently busy generating. Waiting before starting Image #${job.original_position || 1}...`);
      await new Promise((r) => setTimeout(r, 2000));
    }

    // 0. Clean prompt text and prune any leftover attachments before starting
    clearPromptText(input);

    // Auto-dismiss any "You don't have access to this conversation" popover/banner
    try {
      const banners = Array.from(document.querySelectorAll('div, section')).filter(
        (d) => (d.textContent || '').includes("You don't have access to this conversation")
      );
      for (const b of banners) {
        const closeBtn = b.querySelector('button');
        if (closeBtn) closeBtn.click();
      }
    } catch (e) {}

    const existingAttached = getAttachedImagesCount();
    if (existingAttached > 0) {
      console.log(`[BOLTHAVEN] Pruning ${existingAttached} leftover attachment(s) to 0 before starting Image #${job.original_position || 1}...`);
      await pruneExcessAttachments(input, 0);
      await new Promise((r) => setTimeout(r, 400));
    }

    // Snapshot pre-existing assistant images currently in chat history
    const preExistingImageUrls = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (src) preExistingImageUrls.add(src);
    });

    // 1. Attach single image FIRST and verify
    const localPath = job.source_file_path || '';
    const remoteUrl = job.source_file_url || '';
    let primaryUrl = '';
    let fallbackUrl = '';

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

    // Verify that image is attached before touching prompt
    let verifiedAttachmentCount = getAttachedImagesCount(input);
    if (!attached && verifiedAttachmentCount < 1) {
      clearPromptText(input);
      throw new Error(`Image #${job.original_position || 1} could not be attached to ChatGPT composer.`);
    }

    // If more than 1 image is attached, prune down to exactly 1 so it never fails or duplicates!
    if (verifiedAttachmentCount > 1) {
      console.warn(`[BOLTHAVEN] Detected ${verifiedAttachmentCount} attachments. Pruning down to exactly 1...`);
      await pruneExcessAttachments(input, 1);
      verifiedAttachmentCount = getAttachedImagesCount(input);
    }

    console.log(`[BOLTHAVEN] ✓ Step 1 Done: Single image #${job.original_position || 1} confirmed attached! Waiting for upload to finish...`);

    // 2. Wait for the image upload to fully complete BEFORE typing the prompt.
    const composerEl = getComposerContainer(input) || document;
    await waitForAttachmentUploadComplete(composerEl, 6000);

    if (activeJobAborted) {
      clearPromptText(input);
      throw new Error('Job stopped by user');
    }

    // 3. Set prompt text below the attached image
    const promptText = (job.resolved_prompt || 'Enhance the attached architectural photo').trim();
    console.log(`[BOLTHAVEN] Setting prompt text (${promptText.length} chars)...`);

    let textReady = false;
    for (let attempt = 1; attempt <= 6; attempt++) {
      textReady = setPromptText(input, promptText);
      if (textReady) break;
      await new Promise((r) => setTimeout(r, 400));
    }

    // STRICT GUARD: Prompt text MUST be verified in composer!
    const hasPrompt = isPromptActuallyInserted(promptText, input);
    const composerText = getComposerText(input);
    if (!hasPrompt) {
      throw new Error(`Failed to insert prompt text for Image #${job.original_position || 1} (composer has "${composerText.slice(0, 30)}..."). Aborting to avoid sending image without prompt.`);
    }

    await new Promise((r) => setTimeout(r, 400));

    if (activeJobAborted) {
      clearPromptText(input);
      throw new Error('Job stopped by user');
    }

    console.log(`[BOLTHAVEN] ✓ Step 2 Done: Image attached + prompt verified (${composerText.length} chars). Sending Image #${job.original_position || 1}...`);

    // Record pre-existing assistant turn count before sending
    const preAssistantCount = document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"]'
    ).length;

    // 4. Click Send button and VERIFY message was dispatched
    console.log(`[BOLTHAVEN] Sending prompt + image #${job.original_position || 1} to ChatGPT...`);
    let messageSent = false;
    const sendDeadline = Date.now() + 15000;

    while (Date.now() < sendDeadline) {
      if (activeJobAborted) throw new Error('Job stopped by user');

      const sendBtn = findSendButton();
      if (sendBtn && isSendButtonReady(sendBtn)) {
        clickSendButton(sendBtn);
      }

      await new Promise((r) => setTimeout(r, 800));

      const isGeneratingNow = isThinkingOrGenerating();
      const stopBtnActive = Boolean(findStopButton());
      const currentTurns = document.querySelectorAll(
        'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"]'
      );
      const composerTextNow = getComposerText(input);
      const attachmentsNow = getAttachedImagesCount(input);

      // Confirmed dispatched IF:
      // 1. Generation started (stop button or isThinking)
      // OR 2. Assistant turns increased
      // OR 3. Both composer prompt text AND attachment have cleared!
      // OR 4. Send button is gone or replaced by stop button!
      const composerCleared = (composerTextNow.length === 0 && attachmentsNow === 0);
      const sendBtnNow = findSendButton();
      const sendBtnGone = !sendBtnNow || !isSendButtonReady(sendBtnNow);

      if (isGeneratingNow || stopBtnActive || currentTurns.length > preAssistantCount || (composerCleared && sendBtnGone)) {
        messageSent = true;
        console.log(`[BOLTHAVEN] ✓ Image #${job.original_position || 1} confirmed dispatched to ChatGPT!`);
        break;
      }
    }

    if (!messageSent) {
      throw new Error(`Image #${job.original_position || 1} failed to send to ChatGPT (send button clicked but turn did not dispatch).`);
    }

    // Launch background generation watcher asynchronously
    watchGenerationAndDownload(job, preExistingImageUrls, preAssistantCount);

    return { success: true };
  }

  // Process a single job in this tab (handles both setup and waiting for legacy callers)
  async function processJobInTab(job) {
    const setupResult = await setupAndSendJob(job);
    if (!setupResult || !setupResult.success) {
      return { success: false, error: setupResult?.error || 'Failed to setup and send job' };
    }

    // Return a promise that resolves when the generation completes
    return new Promise((resolve) => {
      const onGenDone = (request) => {
        if (request.jobId === job.job_id) {
          if (request.action === 'JOB_GENERATION_COMPLETE') {
            chrome.runtime.onMessage.removeListener(onGenDone);
            resolve({
              success: true,
              job_id: job.job_id,
              original_position: job.original_position,
              result_url: request.result_url || '',
            });
          } else if (request.action === 'JOB_GENERATION_FAILED') {
            chrome.runtime.onMessage.removeListener(onGenDone);
            resolve({
              success: false,
              job_id: job.job_id,
              error: request.error || 'Generation failed',
            });
          }
        }
      };
      chrome.runtime.onMessage.addListener(onGenDone);
    });
  }

  // ── Two-Stage Staging: Tab 1 (Prompt Extractor) ───────────────────────────
  async function extractStage1Prompt(promptText) {
    activeJobAborted = false;
    console.log('[BOLTHAVEN] Stage 1: Injecting prompt into Tab 1 to generate response...');

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], .ProseMirror, textarea', 25000);
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

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], .ProseMirror, textarea', 25000);
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
        try {
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
        } catch (err) {
          console.warn('[BOLTHAVEN] Plus button trigger notice:', err);
        }
      }

      let batchSuccess = false;
      if (fileInputs.length > 0) {
        try {
          const targetInput = fileInputs.find((i) => (i.accept || '').includes('image')) ||
                            fileInputs[fileInputs.length - 1] ||
                            fileInputs[0];
          console.log(`[BOLTHAVEN] Injecting ${filesToAttach.length} files into file input (${targetInput.accept || 'all'})...`);
          const dt = new DataTransfer();
          for (const file of filesToAttach) {
            dt.items.add(file);
          }
          targetInput.multiple = true;
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
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

          // Wait up to 10s for all attachments to register
          await waitForImageAttached(input, 10000, targetTotalImages);
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

    // STRICT ATTACHMENT VERIFICATION:
    const confirmedCount = getAttachedImagesCount(input);
    if (targetTotalImages > 0 && confirmedCount === 0) {
      throw new Error(`Failed to attach images: expected ${targetTotalImages} images (1 Reference + 3 Condo Photos), but 0 were attached to ChatGPT. Aborting to prevent sending prompt without photos.`);
    }

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
    clickSendButton(sendBtn);
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

  // Listen for commands from background worker (deduplicating listener across injections)
  if (window.__bolthaven_msg_listener) {
    try {
      chrome.runtime.onMessage.removeListener(window.__bolthaven_msg_listener);
    } catch (e) {}
  }

  window.__bolthaven_msg_listener = (request, sender, sendResponse) => {
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

    if (request.action === 'RESET_COMPOSER') {
      (async () => {
        try {
          const input = findPromptInput();
          if (input) {
            await pruneExcessAttachments(input, 0);
            clearPromptText(input);
          }
          sendResponse({ success: true });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;
    }

    if (request.action === 'SETUP_AND_SEND_JOB') {
      setupAndSendJob(request.job)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // asynchronous
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
          const input = findPromptInput();
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
      const pm = document.querySelector('.ProseMirror, #prompt-textarea');
      if (pm && request.tryClick) {
        pm.focus();
        setPromptText(pm, 'Hello test prompt');
      }
      const sendBtn = findSendButton();
      const clickLog = [];

      const docButtons = Array.from(document.querySelectorAll('button')).map((b) => ({
        aria: b.getAttribute('aria-label'),
        testid: b.getAttribute('data-testid'),
        text: (b.innerText || b.textContent || '').trim().slice(0, 30),
        disabled: b.disabled,
        rect: { w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), x: Math.round(b.getBoundingClientRect().x), y: Math.round(b.getBoundingClientRect().y) },
        svgId: b.querySelector('use')?.getAttribute('href') || (b.querySelector('svg')?.outerHTML || '').slice(0, 60),
      })).filter((b) => Boolean(b.aria || b.testid || b.svgId));

      if (request.tryClick && sendBtn) {
        clickLog.push(`Found sendBtn: <${sendBtn.tagName} type="${sendBtn.type}" aria-label="${sendBtn.getAttribute('aria-label')}">`);
        clickLog.push(`Disabled: ${sendBtn.disabled}, aria-disabled: ${sendBtn.getAttribute('aria-disabled')}`);
        clickLog.push(`Has form: ${Boolean(sendBtn.form)}`);
        try {
          const clicked = clickSendButton(sendBtn);
          clickLog.push(`clickSendButton returned: ${clicked}`);
        } catch (e) {
          clickLog.push(`clickSendButton threw: ${e.message}`);
        }
      }

      sendResponse({
        url: window.location.href,
        hasPm: Boolean(pm),
        pmId: pm?.id,
        pmTag: pm?.tagName,
        hasPta: Boolean(pta),
        ptaClass: pta?.className,
        ptaTag: pta?.tagName,
        composerText: getComposerText(),
        attachedCount: getAttachedImagesCount(),
        sendBtn: Boolean(sendBtn),
        clickLog,
        allButtons: docButtons,
        hasStopBtn: Boolean(findStopButton()),
      });
      return true;
    }

    if (request.action === 'PING_TAB') {
      sendResponse({ status: 'ready', url: window.location.href });
      return true;
    }
  };

  chrome.runtime.onMessage.addListener(window.__bolthaven_msg_listener);
})();
