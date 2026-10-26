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
      composer.querySelector('button[data-testid*="send" i]') ||
      document.querySelector('button[data-testid="send-button"]') ||
      document.querySelector('button[data-testid="composer-send-button"]') ||
      document.querySelector('button[aria-label="Send prompt"]') ||
      document.querySelector('button[aria-label*="Send" i]')
    );
    if (explicit) return explicit;

    // 2. Search composer toolbar for the send button (with SVG up-arrow)
    const buttons = Array.from(composer.querySelectorAll('button'));
    for (const b of buttons) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('voice') || aria.includes('dictate') || aria.includes('record') || aria.includes('attach') || aria.includes('plus')) {
        continue;
      }
      const svg = b.querySelector('svg');
      if (svg) {
        const rect = b.getBoundingClientRect();
        if (rect.width >= 24 && rect.height >= 24) {
          return b;
        }
      }
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
  async function waitForAttachmentUploadComplete(composerEl, maxWaitMs = 25000) {
    const deadline = Date.now() + maxWaitMs;
    console.log('[BOLTHAVEN] Checking attachment upload status in composer...');
    while (Date.now() < deadline) {
      if (activeJobAborted) return false;
      const composer = composerEl || getComposerContainer() || document.querySelector('form') || document;
      // Look for upload progress spinner (circle, spinner, or progressbar) on the thumbnail
      const hasSpinner = composer.querySelector(
        'circle, svg.animate-spin, [class*="animate-spin"], [role="progressbar"], [class*="loading"], [class*="progress"]'
      );
      const sendBtn = findSendButton();
      const sendReady = isSendButtonReady(sendBtn);

      // If no upload spinner is present AND the send button is ready, the attachment is 100% processed!
      if (!hasSpinner && sendReady) {
        await new Promise((r) => setTimeout(r, 400));
        console.log('[BOLTHAVEN] ✓ Attachment upload fully complete and Send button is active!');
        return true;
      }

      await new Promise((r) => setTimeout(r, 350));
    }
    console.warn('[BOLTHAVEN] Attachment upload wait timeout reached, proceeding to send attempt...');
    return false;
  }

  // Find stop button (indicates generation is actively running)
  function findStopButton() {
    // 1. Common attributes
    const byAttr = document.querySelector(
      'button[data-testid="stop-button"], ' +
      'button[data-testid*="stop"], ' +
      'button[aria-label*="Stop generating"], ' +
      'button[aria-label*="Stop streaming"], ' +
      'button[aria-label*="Stop message"], ' +
      'button[aria-label*="Stop"], ' +
      'button[aria-label*="stop"]'
    );
    if (byAttr) return byAttr;

    // 2. Button with SVG containing a square <rect> (the universal stop icon in ChatGPT)
    const rects = document.querySelectorAll('button svg rect');
    for (const r of rects) {
      const btn = r.closest('button');
      if (btn && !btn.disabled) return btn;
    }

    // 3. Prompt composer button with square icon
    const composer = document.querySelector('form, div[class*="composer"], div[id*="composer"]');
    if (composer) {
      const buttons = composer.querySelectorAll('button');
      for (const b of buttons) {
        if (b.querySelector('svg rect') || (b.getAttribute('aria-label') || '').toLowerCase().includes('stop')) {
          return b;
        }
      }
    }

    return null;
  }

  // Detect whether ChatGPT is actively thinking, reasoning, or generating
  // Detect whether ChatGPT is actively thinking, reasoning, or generating
  function isThinkingOrGenerating() {
    // 1. Stop button present
    if (findStopButton()) return true;

    // 2. Active "Working for Xs" text or thinking indicators (notice "Working" in present continuous, not "Worked")
    const bodyText = document.body.innerText || '';
    if (/\bWorking for \d+s\b/i.test(bodyText) || /\bThinking\.\.\./i.test(bodyText) || /\bGenerating\b/i.test(bodyText)) {
      return true;
    }

    // 3. Pulsing dots, spinning loader, or reasoning container
    const thinkingEls = document.querySelectorAll(
      'div[class*="thinking"], ' +
      'div[class*="reasoning"], ' +
      'div[data-testid*="thinking"], ' +
      '.result-thinking, ' +
      'svg.animate-spin, ' +
      '.animate-pulse, ' +
      'div[class*="animate-spin"]'
    );
    for (const el of thinkingEls) {
      if (el.textContent && /Working for/i.test(el.textContent)) {
        return true;
      }
      if (el.classList && (el.classList.contains('animate-pulse') || el.classList.contains('animate-spin'))) {
        return true;
      }
    }

    return false;
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
        inputEl.closest('form') ||
        inputEl.closest('div[class*="composer"]') ||
        inputEl.closest('div[id*="composer"]') ||
        inputEl.parentElement?.parentElement?.parentElement ||
        document.querySelector('form')
      );
    }
    return document.querySelector('form, div[class*="composer"], div[id*="composer"]');
  }

  // Find the attachment (+) button on the ChatGPT composer
  function findAttachmentButton(composer) {
    const root = composer || getComposerContainer() || document;
    
    // 1. Explicit aria-label or data-testid
    const explicit = root.querySelector(
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

  // Find thumbnail preview img element strictly inside the ChatGPT composer
  function getComposerAttachmentThumbnail(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return null;

    // Search strictly within composer, never outside (ignore conversation turns, history, nav)
    const imgs = composer.querySelectorAll('img');
    for (const img of imgs) {
      if (img.closest('article, [data-message-author-role], nav, header')) continue;

      const src = img.src || img.getAttribute('src') || '';
      if (!src) continue;
      if (
        src.includes('avatar') ||
        src.includes('profile') ||
        src.includes('icon') ||
        src.includes('emoji') ||
        src.includes('logo') ||
        src.includes('user')
      ) {
        continue;
      }

      if (
        src.startsWith('blob:') ||
        src.startsWith('data:image/') ||
        src.includes('oaiusercontent.com') ||
        src.includes('file-service')
      ) {
        const rect = img.getBoundingClientRect();
        if (rect.width >= 20 && rect.height >= 20) {
          return img;
        }
      }
    }
    return null;
  }

  // Get all individual attachment thumbnail card containers in the composer (located above prompt textarea)
  function getAttachmentThumbnailCards(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];
    const promptArea = composer.querySelector('#prompt-textarea') || inputEl;
    const promptTop = promptArea ? promptArea.getBoundingClientRect().top : Infinity;

    const allDescendants = Array.from(composer.querySelectorAll('div, li, span')).filter((el) => {
      if (el.closest('#prompt-textarea, [contenteditable="true"], article, [data-message-author-role], nav, header')) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      // Must be above or at the very top of prompt area and have thumbnail-like size
      if (rect.bottom > promptTop + 15 || rect.width < 25 || rect.height < 25 || rect.width > 260 || rect.height > 260) {
        return false;
      }
      const hasImg = el.querySelector('img') !== null;
      const hasCanvas = el.querySelector('canvas') !== null;
      const hasSpinner = el.querySelector('circle, svg, [role="progressbar"], [class*="spin"]') !== null;
      const hasBg = (el.getAttribute('style') || '').includes('url(');

      return (hasImg || hasCanvas || hasSpinner || hasBg);
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
      if (btn.closest('article, [data-message-author-role], nav, header, #prompt-textarea')) return false;

      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const testid = (btn.getAttribute('data-testid') || '').toLowerCase();

      // STRICT EXCLUSIONS: Never confuse the attach (+) button, send button, mic, etc. with a remove button!
      if (
        aria.includes('attach') ||
        aria.includes('upload') ||
        aria.includes('add') ||
        aria.includes('send') ||
        aria.includes('voice') ||
        aria.includes('mic') ||
        aria.includes('dictate') ||
        aria.includes('search') ||
        aria.includes('reason') ||
        aria.includes('more') ||
        aria.includes('tool') ||
        aria.includes('model') ||
        aria.includes('canvas') ||
        testid.includes('attach') ||
        testid.includes('send') ||
        testid.includes('voice') ||
        testid.includes('mic')
      ) {
        return false;
      }

      // Check if button has explicit remove label
      if (
        aria.includes('remove') ||
        aria.includes('delete') ||
        aria.includes('close') ||
        testid.includes('remove') ||
        testid.includes('close') ||
        testid.includes('delete')
      ) {
        return true;
      }

      // Any small button located ABOVE the prompt textarea (thumbnail close buttons live here!)
      const rect = btn.getBoundingClientRect();
      if (rect.bottom <= promptTop + 15 && rect.width <= 44 && rect.height <= 44) {
        return true;
      }

      return false;
    });
  }

  // Count distinct image attachment cards or remove buttons in the composer
  function getAttachedImagesCount(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return 0;

    const cards = getAttachmentThumbnailCards(inputEl);
    if (cards.length > 0) return cards.length;

    const removeBtns = findAttachmentRemoveButtons(composer);
    if (removeBtns.length > 0) return removeBtns.length;

    const thumb = getComposerAttachmentThumbnail(inputEl);
    return thumb ? 1 : 0;
  }

  // Detect whether an image thumbnail/attachment is actively present in the ChatGPT composer
  function isImageAttachedInComposer(inputEl) {
    return getAttachedImagesCount(inputEl) > 0;
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
  async function waitForImageAttached(inputEl, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (activeJobAborted) return false;
      if (isImageAttachedInComposer(inputEl)) {
        await new Promise((r) => setTimeout(r, 350));
        return true;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return isImageAttachedInComposer(inputEl);
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
  async function attachImageFileToComposer(inputEl, file) {
    const composer = getComposerContainer(inputEl);

    // If an image is already attached, prune down to exactly 1 and do NOT attach another!
    if (getAttachedImagesCount(inputEl) >= 1) {
      console.log('[BOLTHAVEN] Image already attached in composer. Pruning to exactly 1...');
      await pruneExcessAttachments(inputEl, 1);
      return true;
    }

    // Channel 1: Native <input type="file"> (PRIMARY - targets EXACTLY ONE input)
    try {
      console.log('[BOLTHAVEN] Channel 1: Searching for single input[type="file"]...');
      let fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));

      if (fileInputs.length === 0) {
        const plusBtn = findAttachmentButton(composer);
        if (plusBtn) {
          console.log('[BOLTHAVEN] Clicking attachment (+) button to mount file input or open menu...');
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
            console.log('[BOLTHAVEN] Clicking upload menu item:', uploadMenuItem.textContent.trim());
            clickElementSafely(uploadMenuItem);
            await new Promise((r) => setTimeout(r, 300));
          }

          fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
        }
      }

      if (fileInputs.length > 0) {
        // PICK EXACTLY ONE FILE INPUT (the first one) - NEVER LOOP OVER MULTIPLE INPUTS!
        const targetInput = fileInputs[0];
        console.log('[BOLTHAVEN] Injecting File into ONE file input via DataTransfer...');
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

        targetInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

        console.log('[BOLTHAVEN] Dispatched file change event to single file input');
        await new Promise((r) => setTimeout(r, 350));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

        // Wait up to 5s to confirm attachment
        const attached = await waitForImageAttached(inputEl, 5000);
        if (attached) {
          console.log('[BOLTHAVEN] ✓ Image attachment confirmed via single file input');
          await pruneExcessAttachments(inputEl, 1);
          return true;
        }
      }
    } catch (e) {
      console.warn('[BOLTHAVEN] Channel 1 file input notice:', e.message);
    }

    // If an image appeared during or after Channel 1, STOP! Do NOT run subsequent channels!
    if (getAttachedImagesCount(inputEl) >= 1) {
      await pruneExcessAttachments(inputEl, 1);
      return true;
    }

    // Channel 2: Drag & Drop (ONLY on #prompt-textarea, NEVER on multiple targets!)
    try {
      console.log('[BOLTHAVEN] Channel 2: Dispatching DragEvent drop fallback on #prompt-textarea only...');
      const dt = new DataTransfer();
      dt.items.add(file);
      const target = document.querySelector('#prompt-textarea') || inputEl;

      target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt }));

      const attached = await waitForImageAttached(inputEl, 4000);
      if (attached) {
        console.log('[BOLTHAVEN] ✓ Image attachment confirmed via DragEvent drop');
        await pruneExcessAttachments(inputEl, 1);
        return true;
      }
    } catch (e) {
      console.warn('[BOLTHAVEN] Channel 2 DragEvent notice:', e.message);
    }

    // If an image appeared, STOP!
    if (getAttachedImagesCount(inputEl) >= 1) {
      await pruneExcessAttachments(inputEl, 1);
      return true;
    }

    // Channel 3: ClipboardEvent paste on #prompt-textarea ONLY
    try {
      console.log('[BOLTHAVEN] Channel 3: Dispatching ClipboardEvent paste on #prompt-textarea only...');
      inputEl.focus();
      const dt = new DataTransfer();
      dt.items.add(file);
      let pasteEvent;
      try {
        pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          composed: true,
          clipboardData: dt,
        });
      } catch (e) {
        pasteEvent = new Event('paste', { bubbles: true, cancelable: true, composed: true });
      }
      try {
        Object.defineProperty(pasteEvent, 'clipboardData', {
          value: dt,
          writable: false,
          configurable: true,
        });
      } catch (e) {}

      inputEl.dispatchEvent(pasteEvent);

      const attached = await waitForImageAttached(inputEl, 3000);
      if (attached) {
        console.log('[BOLTHAVEN] ✓ Image attachment confirmed via ClipboardEvent paste');
        await pruneExcessAttachments(inputEl, 1);
        return true;
      }
    } catch (e) {
      console.warn('[BOLTHAVEN] Channel 3 ClipboardEvent notice:', e.message);
    }

    // Final check and pruning
    if (getAttachedImagesCount(inputEl) >= 1) {
      await pruneExcessAttachments(inputEl, 1);
      return true;
    }

    return false;
  }

  // Attach image via data URL or web URL cleanly
  async function attachImageViaPaste(inputEl, imgUrl, fileName = 'attachment.png') {
    if (!imgUrl) return false;
    try {
      const blob = await fetchImageBlob(imgUrl, '');
      const mimeType = blob.type || 'image/png';
      const file = new File([blob], fileName, { type: mimeType });
      return await attachImageFileToComposer(inputEl, file);
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
      throw new Error('Could not locate ChatGPT prompt input textarea');
    }

    if (activeJobAborted) {
      clearPromptText(input);
      throw new Error('Job stopped by user');
    }

    // 0. RESET COMPOSER: Clean out any leftover attachments and text from previous runs completely
    console.log('[BOLTHAVEN] Resetting composer: removing all leftover attachments and residual text...');
    await pruneExcessAttachments(input, 0);
    clearPromptText(input);
    await new Promise((r) => setTimeout(r, 400));

    // Snapshot pre-existing assistant images currently in this chat history before send
    const preExistingImageUrls = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || '';
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
    if (!attached) {
      console.warn('[BOLTHAVEN] ⚠️ Image failed to attach. Aborting to avoid sending text without image.');
      clearPromptText(input);
      return {
        success: false,
        error: `Image #${job.original_position || 1} could not be attached to ChatGPT composer. Aborting to avoid sending text without photo.`,
      };
    }

    if (activeJobAborted) {
      clearPromptText(input);
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
      return { success: false, error: 'Job stopped by user' };
    }

    // Guarantee that exactly 1 image is STILL present before sending!
    await pruneExcessAttachments(input, 1);
    if (!isImageAttachedInComposer(input)) {
      console.warn('[BOLTHAVEN] ⚠️ Image disappeared from composer after setting prompt text. Aborting send!');
      clearPromptText(input);
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
    preExistingImageUrls.clear();
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
      if (activeJobAborted) return { success: false, error: 'Job stopped by user' };

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
        console.log('[BOLTHAVEN] ✓ Message confirmed sent to ChatGPT! (composer cleared / generation actively running)');
        break;
      }
    }

    if (!messageSent) {
      console.log('[BOLTHAVEN] ⚠️ Message could not be sent after 25s. Composer still holds prompt/image. Aborting.');
      return {
        success: false,
        error: `Image #${job.original_position || 1} failed to send to ChatGPT (message remained in composer).`,
      };
    }

    // 5. Monitor for generation to COMPLETELY FINISH (poll every 1.5s, up to 5 min)
    console.log('[BOLTHAVEN] Waiting for ChatGPT generation of Image #' + (job.original_position || 1) + ' to complete...');
    const startTime = Date.now();
    const maxWaitMs = 300000;
    let consecutiveCalmChecks = 0;
    let detectedNewImage = null;
    let streamRetryCount = 0;
    const MAX_STREAM_RETRIES = 3;
    let lastRetryClickTime = 0;

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        if (activeJobAborted) {
          clearInterval(checkInterval);
          return resolve({ success: false, error: 'Job stopped by user' });
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > maxWaitMs) {
          clearInterval(checkInterval);
          return resolve({ success: false, error: 'ChatGPT image generation timed out (5 min)' });
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

        // Locate the NEW assistant turn (must be strictly after preAssistantCount)
        const allAssistantTurns = document.querySelectorAll(
          'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"]'
        );

        if (allAssistantTurns.length <= preAssistantCount) {
          // New turn hasn't appeared yet
          consecutiveCalmChecks = 0;
          return;
        }

        const latestTurn = allAssistantTurns[allAssistantTurns.length - 1];

        // Search ONLY inside the latest assistant turn for a newly created image!
        const turnImgs = Array.from(latestTurn.querySelectorAll('img')).filter((img) => {
          const src = img.src || img.getAttribute('src') || '';
          if (!src || preExistingImageUrls.has(src)) return false;
          const s = src.toLowerCase();
          if (
            s.includes('avatar') ||
            s.includes('profile') ||
            s.includes('user') ||
            s.includes('emoji') ||
            s.includes('favicon')
          ) {
            return false;
          }
          return true;
        });

        // If STILL thinking or generating: do NOT complete, reset calm counter!
        if (currentlyGenerating) {
          consecutiveCalmChecks = 0;
          return;
        }

        // ChatGPT is NOT generating. If a new image is present in the latest turn, mark it!
        if (turnImgs.length > 0) {
          const bestImg = turnImgs[turnImgs.length - 1];
          const finalUrl = bestImg.src || bestImg.getAttribute('src') || '';
          if (finalUrl) {
            detectedNewImage = { img: bestImg, url: finalUrl };
            consecutiveCalmChecks++;
          }
        }

        // Once ChatGPT is done and new image is detected
        if (consecutiveCalmChecks >= 1 && detectedNewImage) {
          clearInterval(checkInterval);
          const finalUrl = detectedNewImage.url;
          console.log('[BOLTHAVEN] ✓ Generation fully finished! New image detected in latest turn:', finalUrl);

          preExistingImageUrls.add(finalUrl);
          const fileName = `enhanced_${job.original_position}_${job.job_id}.png`;

          // Trigger single download via background chrome.downloads API
          chrome.runtime.sendMessage(
            {
              action: 'DOWNLOAD_IMAGE',
              url: finalUrl,
              filename: fileName,
            },
            (resp) => {
              if (chrome.runtime.lastError || (resp && !resp.success)) {
                try {
                  const a = document.createElement('a');
                  a.href = finalUrl;
                  a.download = fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } catch (e) {}
              } else {
                console.log('[BOLTHAVEN] ✓ Successfully initiated download for image #' + job.original_position);
              }
            }
          );

          // Wait 2s for download to start and chat to fully settle BEFORE resolving
          await new Promise((r) => setTimeout(r, 2000));

          resolve({
            success: true,
            job_id: job.job_id,
            original_position: job.original_position,
            result_url: finalUrl,
          });
        }
      }, 1500);
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

  // ── Two-Stage Staging: Tab 2 (Image Pasting + Final Assembly) ─────────────
  // 1. Pastes manual reference image FIRST
  // 2. Pastes condo images 1.png, 2.png, 3.png SECOND
  // 3. Pastes extracted prompt BELOW the images
  // 4. Sends in Tab 2
  async function executeStage2Staging({ extractedPrompt, referenceImage, condoImages }) {
    activeJobAborted = false;
    console.log('[BOLTHAVEN] Stage 2: Assembling reference image, condo images, and prompt in Tab 2...');

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], textarea', 25000);
    if (!input) throw new Error('Could not locate ChatGPT prompt input textarea in Tab 2');

    let totalImagesPasted = 0;

    // 1. Paste manual reference / example image FIRST
    if (referenceImage) {
      console.log('[BOLTHAVEN] Stage 2: Pasting manual reference / example image FIRST...');
      const refOk = await attachImageViaPaste(input, referenceImage, '0_example_reference.png');
      if (refOk) {
        totalImagesPasted++;
        await new Promise((r) => setTimeout(r, 1600)); // allow thumbnail to settle
      }
    }

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // 2. Paste condo images 1, 2, 3 SECOND in order
    if (Array.isArray(condoImages) && condoImages.length > 0) {
      console.log(`[BOLTHAVEN] Stage 2: Pasting ${condoImages.length} condo building images (1, 2, 3)...`);
      for (const img of condoImages) {
        if (activeJobAborted) throw new Error('Stage 2 aborted by user');
        const imgUrl = img.data_url || img.url || img.full_path;
        const fileName = img.filename || `${img.index}.png`;
        const ok = await attachImageViaPaste(input, imgUrl, fileName);
        if (ok) totalImagesPasted++;
        await new Promise((r) => setTimeout(r, 1400));
      }
    }

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // 3. Set the prompt text extracted from Tab 1 BELOW all the attached images
    console.log('[BOLTHAVEN] Stage 2: Setting extracted prompt text below attached images...');
    setPromptText(input, extractedPrompt || 'Create facebook advertisement from the attached reference and building photos');
    await new Promise((r) => setTimeout(r, 1000));

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // 4. Wait for send button and click send
    let sendBtn = findSendButton();
    let attempts = 0;
    while ((!sendBtn || sendBtn.disabled) && attempts < 25) {
      if (activeJobAborted) throw new Error('Stage 2 aborted by user');
      await new Promise((r) => setTimeout(r, 300));
      sendBtn = findSendButton();
      attempts++;
    }

    if (!sendBtn) throw new Error('Send button could not be activated in Tab 2');
    sendBtn.click();
    console.log(`[BOLTHAVEN] ✓ Stage 2: Sent with ${totalImagesPasted} images and prompt!`);

    return {
      success: true,
      imagesAttached: totalImagesPasted,
    };
  }

  // Listen for commands from background worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'STOP_TAB_JOB' || request.action === 'ABORT_TAB_JOB') {
      activeJobAborted = true;
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
      })
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === 'INSPECT_CHATGPT') {
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
      sendResponse({ fileInputs, buttons, url: window.location.href });
      return true;
    }

    if (request.action === 'PING_TAB') {
      sendResponse({ status: 'ready', url: window.location.href });
      return true;
    }
  });
})();
