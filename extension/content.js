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

  // Find ChatGPT send button
  function findSendButton() {
    return (
      document.querySelector('button[data-testid="send-button"]') ||
      document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
      document.querySelector('button[aria-label="Send prompt"]') ||
      document.querySelector('button[aria-label="Send message"]')
    );
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

  // Set prompt text inside ProseMirror contenteditable or textarea without duplicating
  function setPromptText(inputEl, text) {
    if (!inputEl || !text) return;
    inputEl.focus();

    // 1. Wipe out any pre-existing residual text
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(inputEl);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('delete', false, null);
    } catch (e) {}

    const p = inputEl.querySelector('p');
    if (p) p.textContent = '';

    const cleanText = text.trim();
    const startSnippet = cleanText.slice(0, 20);
    const endSnippet = cleanText.slice(-20);

    // 2. Primary: DataTransfer ClipboardEvent paste
    // In ChatGPT's ProseMirror composer, ClipboardEvent paste cleanly preserves all
    // multiline text, bullet points, line breaks, and paragraphs without truncation.
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

    // Verify if full text was inserted
    let content = (inputEl.textContent || '').trim();
    if (content.includes(startSnippet) && content.includes(endSnippet) && content.length >= cleanText.length * 0.7) {
      console.log(`[BOLTHAVEN] Inserted full prompt via ClipboardEvent paste (${cleanText.length} chars)`);
      return;
    }

    // 3. Fallback: Native execCommand insertText
    try {
      document.execCommand('insertText', false, cleanText);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {}

    content = (inputEl.textContent || '').trim();
    if (content.includes(startSnippet) && content.includes(endSnippet) && content.length >= cleanText.length * 0.7) {
      console.log('[BOLTHAVEN] Inserted full prompt via execCommand');
      return;
    }

    // 4. Fallback: ProseMirror DOM paragraphs injection
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
      console.log('[BOLTHAVEN] Inserted full prompt via paragraph structure fallback');
    }
  }

  // Attach a single image via DataTransfer paste event on prompt input
  async function attachImageViaPaste(inputEl, imageUrl, filename = 'image.jpg') {
    try {
      let blob;
      if (imageUrl && imageUrl.startsWith('data:')) {
        const resp = await fetch(imageUrl);
        blob = await resp.blob();
      } else {
        // Fetch via background service worker to bypass ChatGPT CSP & Mixed Content restrictions
        const b64DataUrl = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'FETCH_IMAGE_BASE64', url: imageUrl }, (response) => {
            if (response && response.success && response.dataUrl) {
              resolve(response.dataUrl);
            } else {
              reject(new Error(response?.error || 'Failed to fetch image via background'));
            }
          });
        });
        const resp = await fetch(b64DataUrl);
        blob = await resp.blob();
      }

      const mimeType = blob.type || 'image/jpeg';
      const file = new File([blob], filename, { type: mimeType });

      // Create DataTransfer with EXACTLY ONE image file
      const dt = new DataTransfer();
      dt.items.add(file);

      // Primary: Dispatch ClipboardEvent paste on prompt input (ChatGPT attaches exactly 1 image)
      let attached = false;
      try {
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        });
        inputEl.focus();
        inputEl.dispatchEvent(pasteEvent);
        attached = true;
        console.log('[BOLTHAVEN] Attached single image via ClipboardEvent paste');
      } catch (e) {
        console.warn('[BOLTHAVEN] ClipboardEvent paste error:', e);
      }

      // Fallback only if ClipboardEvent failed completely
      if (!attached) {
        let fileInputs = document.querySelectorAll('input[type="file"]');
        if (fileInputs.length === 0) {
          const plusBtn = document.querySelector('button[aria-label*="Attach"], button[data-testid*="attachment"], button[aria-label*="Upload"], button[aria-label*="Add photos"]') ||
            Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '+' || b.querySelector('svg.icon-plus'));
          if (plusBtn) {
            plusBtn.click();
            await new Promise((r) => setTimeout(r, 200));
            fileInputs = document.querySelectorAll('input[type="file"]');
          }
        }
        if (fileInputs.length > 0) {
          fileInputs[0].files = dt.files;
          fileInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[BOLTHAVEN] Attached single image via fallback file input');
        }
      }

      return true;
    } catch (err) {
      console.warn('[BOLTHAVEN] Image attachment warning:', err);
      return false;
    }
  }

  // Process a single job in this tab
  async function processJobInTab(job) {
    activeJobAborted = false;
    console.log('[BOLTHAVEN] Starting job in tab:', job.job_id, 'Image #' + job.original_position);

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], textarea', 25000);
    if (!input) {
      throw new Error('Could not locate ChatGPT prompt input textarea');
    }

    if (activeJobAborted) throw new Error('Job stopped by user');

    // 0. Snapshot ALL existing images currently in this chat tab BEFORE doing anything
    const preExistingImageUrls = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || '';
      if (src) preExistingImageUrls.add(src);
    });
    console.log(`[BOLTHAVEN] Pre-existing images in chat before send: ${preExistingImageUrls.size}`);

    // 1. Attach single image FIRST so the thumbnail is placed above the prompt
    const imgUrl = job.source_file_url || job.source_file_path;
    if (imgUrl) {
      await attachImageViaPaste(input, imgUrl, `property_image_${job.original_position}.jpg`);
      // Wait for image thumbnail card to mount into the chat box
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (activeJobAborted) throw new Error('Job stopped by user');

    // 2. Set the clean prompt text BELOW the attached image (clearing any old text)
    setPromptText(input, job.resolved_prompt || 'Enhance the attached architectural photo');
    await new Promise((r) => setTimeout(r, 800));

    if (activeJobAborted) throw new Error('Job stopped by user');

    // 3. Wait until Send button is enabled and click Send
    let sendBtn = findSendButton();
    let attempts = 0;
    while ((!sendBtn || sendBtn.disabled) && attempts < 25) {
      if (activeJobAborted) throw new Error('Job stopped by user');
      await new Promise((r) => setTimeout(r, 400));
      sendBtn = findSendButton();
      attempts++;
    }

    if (activeJobAborted) throw new Error('Job stopped by user');

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
      console.log('[BOLTHAVEN] Clicked ChatGPT Send button');
    } else {
      // Fallback: press Enter on the input
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      console.log('[BOLTHAVEN] Dispatched Enter key on prompt input');
    }

    // 4. Wait for generation to actively START (ChatGPT takes 1-5s to switch from input to thinking)
    console.log('[BOLTHAVEN] Waiting for ChatGPT generation to start...');
    let generationStarted = false;
    const startDeadline = Date.now() + 15000;
    while (Date.now() < startDeadline) {
      if (activeJobAborted) throw new Error('Job stopped by user');
      if (isThinkingOrGenerating()) {
        generationStarted = true;
        console.log('[BOLTHAVEN] Generation actively running (thinking/generating confirmed)!');
        break;
      }
      const earlyRetryBtn = findRetryButton();
      if (earlyRetryBtn) {
        console.log('[BOLTHAVEN] ⚠️ Error banner detected before generation started. Auto-clicking "Retry"...');
        earlyRetryBtn.click();
        await new Promise((r) => setTimeout(r, 2000));
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // 5. Monitor for generation to COMPLETELY FINISH (poll every 1.5s)
    const startTime = Date.now();
    const maxWaitMs = 300000; // 5 minutes timeout per image
    let consecutiveCalmChecks = 0;
    let detectedNewImage = null;
    let streamRetryCount = 0;
    const MAX_STREAM_RETRIES = 3;
    let lastRetryClickTime = 0;

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        if (activeJobAborted) {
          clearInterval(checkInterval);
          return reject(new Error('Job stopped by user'));
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > maxWaitMs) {
          clearInterval(checkInterval);
          return reject(new Error('ChatGPT image generation timed out (5 min)'));
        }

        const currentlyGenerating = isThinkingOrGenerating();

        // ── AUTO-RETRY DETECTION ──────────────────────────────────────────
        // If ChatGPT displays "Error in message stream", automatically click "Retry"
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
              return reject(new Error('ChatGPT generation failed: "Error in message stream" persisted after 3 retries.'));
            }
          }
        }

        // Search for ANY image on the page that was NOT present before send
        let candidateImg = null;
        let candidateUrl = '';

        const allImgs = Array.from(document.querySelectorAll('img'));
        for (let i = allImgs.length - 1; i >= 0; i--) {
          const img = allImgs[i];
          const src = img.src || img.currentSrc || img.getAttribute('src') || '';
          if (!src || preExistingImageUrls.has(src)) continue;

          const s = src.toLowerCase();
          if (
            s.includes('avatar') ||
            s.includes('profile') ||
            s.includes('user') ||
            s.includes('emoji') ||
            s.includes('favicon')
          ) {
            continue;
          }

          candidateImg = img;
          candidateUrl = src;
          break;
        }

        // If STILL thinking or generating: do NOT complete, reset calm counter!
        if (currentlyGenerating) {
          consecutiveCalmChecks = 0;
          return;
        }

        // ChatGPT is NOT generating. If candidate image found, mark it!
        if (candidateImg && candidateUrl) {
          detectedNewImage = { img: candidateImg, url: candidateUrl };
          consecutiveCalmChecks++;
        } else if (!currentlyGenerating) {
          // If not generating, check if the latest assistant turn contains an image
          const lastTurn = document.querySelector(
            'article:last-of-type, div[data-message-author-role="assistant"]:last-of-type, div.agent-turn:last-of-type'
          );
          if (lastTurn) {
            const turnImg = lastTurn.querySelector('img');
            if (turnImg && turnImg.src && !preExistingImageUrls.has(turnImg.src)) {
              detectedNewImage = { img: turnImg, url: turnImg.src };
              consecutiveCalmChecks++;
            }
          }
        }

        // Once ChatGPT is done and new image is detected (no waiting too long!)
        if (consecutiveCalmChecks >= 1 && detectedNewImage) {
          clearInterval(checkInterval);
          const finalUrl = detectedNewImage.url;
          console.log('[BOLTHAVEN] ✓ Generation fully finished! New image detected:', finalUrl);

          // Add this new image URL to preExistingImageUrls so future turns won't mistake it
          preExistingImageUrls.add(finalUrl);

          const fileName = `enhanced_${job.original_position}_${job.job_id}.png`;

          // Trigger single download via background chrome.downloads API (with fallback only on error)
          chrome.runtime.sendMessage(
            {
              action: 'DOWNLOAD_IMAGE',
              url: finalUrl,
              filename: fileName,
            },
            (resp) => {
              if (chrome.runtime.lastError || (resp && !resp.success)) {
                console.warn('[BOLTHAVEN] Background download error, trying direct fallback:', chrome.runtime.lastError);
                try {
                  const a = document.createElement('a');
                  a.href = finalUrl;
                  a.download = fileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } catch (e) {}
              } else {
                console.log('[BOLTHAVEN] ✓ Successfully initiated single download for image #' + job.original_position);
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

    if (request.action === 'PING_TAB') {
      sendResponse({ status: 'ready', url: window.location.href });
      return true;
    }
  });
})();
