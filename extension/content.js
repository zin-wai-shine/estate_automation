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

  // ── Auto-Recover from Cloudflare / Envoy Upstream Error ──
  const checkUpstreamError = () => {
    const text = (document.body ? document.body.innerText || '' : '').toLowerCase();
    return (
      text.includes('upstream connect error') ||
      text.includes('remote connection failure') ||
      text.includes('502 bad gateway') ||
      text.includes('504 gateway time-out')
    );
  };

  if (checkUpstreamError()) {
    console.warn('[BOLTHAVEN] Detected ChatGPT upstream gateway error. Auto-reloading tab in 2s...');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    return;
  }

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
      try {
        chrome.runtime.sendMessage({ action: 'WAKE_UP_AND_POLL', url: window.location.href }, () => {
          if (chrome.runtime.lastError) {}
        });
      } catch (e) {}
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

  // Safe sendMessage helper that always accesses chrome.runtime.lastError to avoid extension errors
  function safeSendMessage(msg, callback) {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        const err = chrome.runtime.lastError;
        if (typeof callback === 'function') callback(res, err);
      });
    } catch (e) {
      if (typeof callback === 'function') callback(null, e);
    }
  }

  // Safely click send button using native pointer, mouse, submit, and keyboard Enter events
  async function clickSendButton(btn) {
    if (!btn || isAudioOrSpeechButton(btn) || isStopButton(btn)) return false;
    try {
      btn.focus();

      // 1. Direct React Fiber onClick execution (if available in current scope)
      try {
        const reactKey = Object.keys(btn).find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
        if (reactKey && btn[reactKey] && typeof btn[reactKey].onClick === 'function') {
          btn[reactKey].onClick({ preventDefault: () => {}, stopPropagation: () => {}, target: btn, currentTarget: btn, bubbles: true });
        }
      } catch (e) {}

      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      // Pointer & Mouse down: button 0, buttons 1
      const downOpts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 };
      btn.dispatchEvent(new PointerEvent('pointerdown', { ...downOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
      btn.dispatchEvent(new MouseEvent('mousedown', downOpts));

      // Pointer & Mouse up + click: button 0, buttons 0 (CRITICAL: React drops clicks if buttons !== 0)
      const upOpts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: 0 };
      btn.dispatchEvent(new PointerEvent('pointerup', { ...upOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
      btn.dispatchEvent(new MouseEvent('mouseup', upOpts));
      btn.dispatchEvent(new MouseEvent('click', upOpts));
      btn.click();

      // Also trigger form.requestSubmit if button belongs to a form
      const form = btn.closest('form') || btn.form || document.querySelector('form');
      if (form && typeof form.requestSubmit === 'function') {
        try {
          form.requestSubmit(btn);
        } catch (e) {
          try { form.requestSubmit(); } catch (e2) {}
        }
      }

      // Also dispatch Enter key on prompt input if it has text
      const promptTarget = findPromptInput();
      if (promptTarget && getComposerText(promptTarget).trim().length > 0) {
        promptTarget.focus();
        const kOpts = {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, charCode: 13,
          bubbles: true, cancelable: true, composed: true, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false
        };
        promptTarget.dispatchEvent(new KeyboardEvent('keydown', kOpts));
        promptTarget.dispatchEvent(new KeyboardEvent('keypress', kOpts));
        promptTarget.dispatchEvent(new KeyboardEvent('keyup', kOpts));
      }

      // Synchronously execute and await click in MAIN world context
      await new Promise((resolve) => {
        safeSendMessage({ action: 'CLICK_SEND_MAIN_WORLD' }, (res) => resolve(res));
      });

      return true;
    } catch (e) {
      try {
        if (!isAudioOrSpeechButton(btn) && !isStopButton(btn)) btn.click();
      } catch (e2) {}
      return false;
    }
  }

  // Strictly identify any audio / microphone / speech / dictation button in ChatGPT
  function isAudioOrSpeechButton(el) {
    if (!el) return false;
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const tid = (el.getAttribute('data-testid') || '').toLowerCase();
    const title = (el.getAttribute('title') || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    const audioKeywords = [
      'speech',
      'voice',
      'mic',
      'dictat',
      'audio',
      'record',
      'sound',
      'listen',
      'waveform',
    ];
    for (const kw of audioKeywords) {
      if (aria.includes(kw) || tid.includes(kw) || title.includes(kw) || cls.includes(kw)) {
        return true;
      }
    }
    return false;
  }

  // Dismiss or cancel ChatGPT audio / speech recording mode if it was accidentally triggered
  function dismissVoiceOrAudioModeIfActive() {
    try {
      const cancelBtn = (
        document.querySelector('button[aria-label*="Cancel speech" i]') ||
        document.querySelector('button[aria-label*="Cancel voice" i]') ||
        document.querySelector('button[aria-label*="Cancel" i]') ||
        document.querySelector('button[aria-label*="cancel" i]') ||
        document.querySelector('button[aria-label*="Exit voice" i]') ||
        document.querySelector('button[aria-label*="Close voice" i]') ||
        document.querySelector('button[data-testid*="cancel-speech" i]') ||
        document.querySelector('button[data-testid*="close-speech" i]')
      );
      if (cancelBtn) {
        console.log('[BOLTHAVEN] Detected active audio/voice recording mode. Dismissing...');
        cancelBtn.click();
        return true;
      }

      // If voice waveform or voice mode stop button is present, dispatch Escape
      const isVoiceActive = Boolean(
        document.querySelector('button[aria-label*="stop voice" i], button[data-testid*="stop-speech" i], button[aria-label*="Stop recording" i]') ||
        document.querySelector('[data-testid*="speech-mode" i], [data-testid*="voice-mode" i]')
      );
      if (isVoiceActive) {
        console.log('[BOLTHAVEN] Voice recording active. Dispatching Escape to exit...');
        const escOpts = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true };
        window.dispatchEvent(new KeyboardEvent('keydown', escOpts));
        window.dispatchEvent(new KeyboardEvent('keyup', escOpts));
        document.dispatchEvent(new KeyboardEvent('keydown', escOpts));
        document.dispatchEvent(new KeyboardEvent('keyup', escOpts));
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Find ChatGPT send button (strictly excluding desktop app, model pickers, files, mic, audio, speech, etc.)
  function findSendButton() {
    // 1. Explicit modern attributes & submit buttons
    const explicit = (
      document.querySelector('button[data-testid="send-button"]') ||
      document.querySelector('button[data-testid="composer-send-button"]') ||
      document.querySelector('button[data-testid*="send" i]') ||
      document.querySelector('button[aria-label="Send"]') ||
      document.querySelector('button[aria-label="Send prompt"]') ||
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[aria-label*="Send" i]') ||
      document.querySelector('form button[type="submit"]') ||
      document.querySelector('button[type="submit"]')
    );
    if (explicit && isSendButtonReady(explicit) && !isStopButton(explicit) && !isAudioOrSpeechButton(explicit)) return explicit;

    // 2. Search composer toolbar for the send button (circular button with SVG up-arrow)
    const composer = getComposerContainer() || document.querySelector('form') || document;
    const buttons = Array.from(composer.querySelectorAll('button:not(:disabled)')).filter((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const testid = (b.getAttribute('data-testid') || '').toLowerCase();
      const text = (b.innerText || b.textContent || '').trim().toLowerCase();

      // STRICT RULE: The send button NEVER has text!
      if (text.length > 0) return false;

      // STRICT RULE: Never match the stop button or any audio/speech/voice button!
      if (isStopButton(b) || isAudioOrSpeechButton(b)) return false;

      // Exclude model picker, desktop app, attachments, mic, voice, speech, audio, reason, files, projects, plugins, editor, copy, share
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
        aria.includes('dictat') ||
        aria.includes('speech') ||
        aria.includes('audio') ||
        aria.includes('record') ||
        aria.includes('sound') ||
        aria.includes('listen') ||
        aria.includes('waveform') ||
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
        testid.includes('mic') ||
        testid.includes('speech') ||
        testid.includes('dictat') ||
        testid.includes('audio') ||
        testid.includes('record')
      ) {
        return false;
      }

      // Send button is always a small circular button with an SVG icon
      const rect = b.getBoundingClientRect();
      if (rect.width > 60 || rect.height > 60 || rect.width < 18 || rect.height < 18) {
        return false;
      }

      return Boolean(b.querySelector('svg'));
    });

    if (buttons.length > 0) {
      buttons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
      return buttons[0];
    }

    return (explicit && !isStopButton(explicit) && !isAudioOrSpeechButton(explicit)) ? explicit : null;
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
    if (isStopButton(btn)) return false;
    if (isAudioOrSpeechButton(btn)) return false;
    return true;
  }

  // Find thumbnail card containers in composer
  function getAttachmentThumbnailCards(inputEl) {
    const composer = getComposerContainer(inputEl);
    if (!composer) return [];
    return Array.from(composer.querySelectorAll('[class*="attachment" i], [class*="thumbnail" i], [data-testid*="attachment" i]'));
  }

  // Wait for the attachment thumbnail in composer to finish uploading to OpenAI server
  async function waitForAttachmentUploadComplete(composerEl, maxWaitMs = 15000) {
    const deadline = Date.now() + maxWaitMs;
    console.log('[BOLTHAVEN] Checking attachment upload status in composer...');
    while (Date.now() < deadline) {
      if (activeJobAborted) return false;
      const composer = composerEl || getComposerContainer() || document;

      // Check if any thumbnail card still has an active circular progress ring / spinner
      const cards = Array.from(composer.querySelectorAll('[class*="attachment" i], [class*="thumbnail" i], div[class*="rounded"]'));
      let hasActiveUploadRing = false;
      for (const card of cards) {
        const ring = card.querySelector('svg circle[stroke-dasharray], svg circle[stroke-dashoffset], svg.animate-spin, [class*="progress" i]');
        if (ring) {
          const r = ring.getBoundingClientRect();
          if (r.width >= 10 && r.height >= 10) {
            hasActiveUploadRing = true;
            break;
          }
        }
      }

      const sendBtn = findSendButton();
      const sendReady = isSendButtonReady(sendBtn);

      if (!hasActiveUploadRing) {
        await new Promise((r) => setTimeout(r, 400));
        console.log('[BOLTHAVEN] ✓ Attachment upload fully complete (no active upload rings in composer)!');
        return true;
      }

      await new Promise((r) => setTimeout(r, 250));
    }
    console.log('[BOLTHAVEN] Attachment upload settle window closed, proceeding...');
    return true;
  }

  // Find stop button (indicates generation is actively running).
  // Strictly locate the active stop button in the composer
  function findStopButton() {
    const composer = getComposerContainer() || document.querySelector('form') || document;
    if (!composer) return null;

    // 1. Explicit stop buttons
    const byAttr = composer.querySelector(
      'button[data-testid="stop-button"], ' +
      'button[aria-label*="Stop generating" i], ' +
      'button[aria-label*="Stop streaming" i], ' +
      'button[aria-label="Stop" i], ' +
      'button[aria-label*="Stop" i]'
    );
    if (byAttr && !byAttr.disabled && byAttr.getAttribute('aria-disabled') !== 'true') return byAttr;

    // 2. Button with aria-label or testid containing "stop" (excluding voice/mic/speech)
    const composerButtons = Array.from(composer.querySelectorAll('button:not(:disabled)'));
    for (const b of composerButtons) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const testid = (b.getAttribute('data-testid') || '').toLowerCase();
      if ((aria.includes('stop') || testid.includes('stop')) && !aria.includes('voice') && !aria.includes('speech')) {
        return b;
      }
      // Check for square stop icon (SVG rect or square path)
      const rect = b.querySelector('rect, [class*="square"]');
      if (rect) return b;
    }

    return null;
  }

  // Detect whether ChatGPT is actively thinking, reasoning, or generating
  function isThinkingOrGenerating() {
    // 1. Stop button present anywhere in composer or page -> actively generating!
    if (findStopButton()) return true;

    const anyStopBtn = Array.from(document.querySelectorAll('button')).some((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const testid = (b.getAttribute('data-testid') || '').toLowerCase();
      return (aria.includes('stop') || testid.includes('stop')) && !aria.includes('voice') && !aria.includes('speech');
    });
    if (anyStopBtn) return true;

    // 2. Only check inside assistant conversation turns (never whole page / sidebar)
    const assistantTurns = document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"]'
    );
    if (assistantTurns.length === 0) return false;

    const lastTurn = assistantTurns[assistantTurns.length - 1];
    // Active animated spinner, shimmer, or pulsing element in last turn
    if (lastTurn.querySelector('svg.animate-spin, div[class*="spin"], .result-thinking, .animate-pulse, div[class*="shimmer"], [data-testid*="thinking"], [data-testid*="generating"], div[class*="loading"]')) {
      return true;
    }

    const lastTurnText = (lastTurn.textContent || '').toLowerCase();
    if (lastTurnText.includes('creating image') || lastTurnText.includes('generating image') || lastTurnText.includes('drawing image')) {
      return true;
    }

    return false;
  }

  // Set to prevent duplicate downloads of the exact same image/filename in this tab session
  const downloadedFileNames = new Set();

  // Auto-skip ChatGPT RLHF / image comparison prompt ("Which image do you like more?")
  function autoSkipComparisonPrompt() {
    const buttons = Array.from(document.querySelectorAll('button'));
    // 1. Look for explicit "Skip" button (top right of comparison banner)
    const skipBtn = buttons.find((b) => {
      const txt = (b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return (txt === 'skip' || aria === 'skip') && !b.disabled;
    });

    if (skipBtn) {
      console.log('[BOLTHAVEN] ⏩ Detected "Which image do you like more?" prompt! Auto-clicking "Skip"...');
      clickElementSafely(skipBtn);
      return true;
    }

    // 2. Fallback: If "Image 1 is better" choice button is present
    const choice1Btn = buttons.find((b) => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return txt.includes('image 1 is better') && !b.disabled;
    });
    if (choice1Btn) {
      console.log('[BOLTHAVEN] ⏩ Auto-selecting "Image 1 is better" to clear comparison prompt...');
      clickElementSafely(choice1Btn);
      return true;
    }

    return false;
  }

  // Periodic background listener: auto-skip comparison prompt whenever it pops up
  setInterval(autoSkipComparisonPrompt, 1500);

  // Trigger reliable native ChatGPT download actions:
  // 1. Direct Download button on card
  // 2. Lightbox / Preview Download button -> Select "Download image" (downloads single image, skips series)
  // 3. Share icon [ ↑ ] on image card -> Opens Share Modal -> Clicks "Download" button inside modal
  // 4. "Copy image" button in assistant turn footer
  async function triggerNativeChatGPTDownload(imgEl) {
    if (!imgEl) return false;
    const card = imgEl.closest('div[class*="group"], div[class*="relative"], article, section') || imgEl.parentElement;

    // 0. Check if a download series dropdown menu is currently visible on screen (Image 3)
    // When ChatGPT generates 2 images in a series, clicking download shows:
    // "Download image" vs "Download 2 images in this series".
    // We strictly click "Download image" to download just ONE image!
    const seriesMenuOption = Array.from(document.querySelectorAll('[role="menuitem"], [role="menu"] button, div[class*="popover"] button, div[class*="menu"] button, div[class*="dropdown"] button, button')).find((b) => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return txt === 'download image' || (txt.startsWith('download image') && !txt.includes('series') && !txt.includes('all'));
    });
    if (seriesMenuOption) {
      console.log('[BOLTHAVEN] ✓ Found "Download image" dropdown option, downloading just one image...');
      clickElementSafely(seriesMenuOption);
      await new Promise((r) => setTimeout(r, 800));
      return true;
    }

    // 0.5. Check for topbar Download button in ChatGPT full image viewer (Image 3)
    const lightboxDownloadBtn = Array.from(document.querySelectorAll('button')).find((b) => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const title = (b.getAttribute('title') || '').toLowerCase();
      const txt = (b.textContent || '').trim().toLowerCase();
      if (b.closest('form, div[class*="composer"]')) return false;
      const isDownload = aria.includes('download') || title.includes('download') || txt.includes('download');
      const r = b.getBoundingClientRect();
      return isDownload && r.top <= 100 && r.right >= window.innerWidth - 300;
    });

    if (lightboxDownloadBtn) {
      console.log('[BOLTHAVEN] Found topbar lightbox download button, clicking...');
      clickElementSafely(lightboxDownloadBtn);
      await new Promise((r) => setTimeout(r, 400));
      // Now check if the dropdown menu appeared: "Download image" vs "Download 2 images in this series"
      const singleOption = Array.from(document.querySelectorAll('[role="menuitem"], [role="menu"] button, div[class*="popover"] button, div[class*="menu"] button, button')).find((b) => {
        const txt = (b.textContent || '').trim().toLowerCase();
        return txt === 'download image' || (txt.startsWith('download image') && !txt.includes('series'));
      });
      if (singleOption) {
        console.log('[BOLTHAVEN] ✓ Selecting "Download image" (single image from series)...');
        clickElementSafely(singleOption);
        await new Promise((r) => setTimeout(r, 800));
        return true;
      }
    }

    // 1. Check for a direct download button on the image card
    const directBtn = findGeneratedImageDownloadButton(imgEl);
    if (directBtn) {
      console.log('[BOLTHAVEN] Clicking direct native download button on card...');
      clickElementSafely(directBtn);
      await new Promise((r) => setTimeout(r, 400));
      // Check if clicking this opened a series dropdown ("Download image" vs "Download 2 images in this series")
      const singleOption = Array.from(document.querySelectorAll('[role="menuitem"], [role="menu"] button, div[class*="popover"] button, div[class*="menu"] button, button')).find((b) => {
        const txt = (b.textContent || '').trim().toLowerCase();
        return txt === 'download image' || (txt.startsWith('download image') && !txt.includes('series'));
      });
      if (singleOption) {
        console.log('[BOLTHAVEN] ✓ Selecting "Download image" from card dropdown...');
        clickElementSafely(singleOption);
      }
      await new Promise((r) => setTimeout(r, 800));
      return true;
    }

    // 2. Locate the Share button [ ↑ ] on the image card (ChatGPT modern UI)
    // In ChatGPT modern UI, the circular button with an upward arrow inside a tray is positioned in the bottom right corner
    if (card) {
      const cardButtons = Array.from(card.querySelectorAll('button'));
      const shareBtn = cardButtons.find((b) => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const title = (b.getAttribute('title') || '').toLowerCase();
        if (aria.includes('share') || title.includes('share') || aria.includes('export') || title.includes('export')) {
          return true;
        }
        const svg = b.querySelector('svg');
        if (svg) {
          const html = svg.innerHTML.toLowerCase();
          if (html.includes('m12') || html.includes('arrow') || html.includes('share') || html.includes('upload')) {
            return true;
          }
        }
        // Circular overlay button in bottom-right corner of image
        const imgR = imgEl.getBoundingClientRect();
        const bR = b.getBoundingClientRect();
        if (bR.width >= 24 && bR.width <= 60 && bR.height >= 24 && bR.height <= 60) {
          if (bR.right >= imgR.right - 80 && bR.bottom >= imgR.bottom - 80) {
            return true;
          }
        }
        return false;
      });

      if (shareBtn) {
        console.log('[BOLTHAVEN] 🚀 Found Share button on image card, opening Download modal...');
        clickElementSafely(shareBtn);
        // Wait for the modal dialog ("Share a public link to this image") to appear
        await new Promise((r) => setTimeout(r, 650));

        const modal = document.querySelector('[role="dialog"], div[class*="modal"], div[class*="popover"]');
        if (modal) {
          const modalBtns = Array.from(modal.querySelectorAll('button, a'));
          const modalDownloadBtn = modalBtns.find((b) => {
            const txt = (b.textContent || '').trim().toLowerCase();
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            return txt.includes('download') || aria.includes('download');
          });

          if (modalDownloadBtn) {
            console.log('[BOLTHAVEN] ✓ Found "Download" button inside Share modal! Clicking to trigger native download...');
            clickElementSafely(modalDownloadBtn);
            await new Promise((r) => setTimeout(r, 800));

            // Close the modal dialog so user screen remains clean
            const closeBtn = modal.querySelector('button[aria-label*="close" i], button[aria-label*="Close"]') ||
                             modalBtns.find((b) => {
                               const t = (b.textContent || '').trim();
                               return t === '✕' || t === '×' || t === 'Close';
                             });
            if (closeBtn) {
              clickElementSafely(closeBtn);
            } else {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
            }
            return true;
          }
        }
      }
    }

    // 3. Fallback: "Copy image" button in turn toolbar below the image
    const turn = imgEl.closest('article, [data-message-author-role="assistant"], div[class*="agent-turn"]') || (card && card.parentElement);
    if (turn) {
      const turnBtns = Array.from(turn.querySelectorAll('button'));
      const copyImgBtn = turnBtns.find((b) => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const title = (b.getAttribute('title') || '').toLowerCase();
        return aria.includes('copy image') || title.includes('copy image') || aria === 'copy' || title === 'copy';
      });
      if (copyImgBtn) {
        console.log('[BOLTHAVEN] 📋 Found "Copy image" button on assistant turn, triggering copy...');
        clickElementSafely(copyImgBtn);
        await new Promise((r) => setTimeout(r, 400));
        return true;
      }
    }

    return false;
  }

  // ── Locate the latest generated/enhanced image rendered in this ChatGPT tab ──
  function findLatestGeneratedImageInTab() {
    // 1. Inspect the latest assistant turn
    const assistantTurns = Array.from(document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"], article'
    )).filter((turn) => {
      if (turn.getAttribute('data-message-author-role') === 'user') return false;
      return !turn.querySelector('[data-message-author-role="user"]');
    });

    if (assistantTurns.length > 0) {
      const latestTurn = assistantTurns[assistantTurns.length - 1];

      // If latest turn is currently generating or spinning, don't grab incomplete image
      if (latestTurn.querySelector('svg.animate-spin, div[class*="spin"], .result-thinking, .animate-pulse, div[class*="shimmer"], [data-testid*="thinking"], [data-testid*="generating"], div[class*="loading"]')) {
        return null;
      }

      const imgs = Array.from(latestTurn.querySelectorAll('img')).filter((img) => {
        const s = (img.src || img.getAttribute('src') || '').toLowerCase();
        if (!s || s.includes('avatar') || s.includes('icon') || s.includes('profile') || s.includes('logo')) return false;
        if (img.closest('form, div[class*="composer"], header, nav')) return false;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        return img.complete && w >= 200 && h >= 200;
      });

      if (imgs.length > 0) return imgs[imgs.length - 1];
    }

    return null;
  }

  // Trigger reliable multi-tier image download to disk and browser downloads directory
  async function downloadEnhancedImage(imgEl, finalUrl, fileName) {
    if (!finalUrl || !fileName) return false;

    console.log('[BOLTHAVEN] ⬇️ Triggering reliable multi-tier download:', fileName, finalUrl);

    // Extract position from filename e.g. "code-2.png" or "enhanced_2_..."
    const posMatch = fileName.match(/[-_](\d+)\./);
    const position = posMatch ? parseInt(posMatch[1], 10) : undefined;
    const threadUrl = window.location.href;

    // Memorize image thread immediately
    if (position && threadUrl && (threadUrl.includes('chatgpt.com') || threadUrl.includes('chat.openai.com'))) {
      chrome.runtime.sendMessage({
        action: 'MEMORIZE_IMAGE_THREAD',
        position,
        threadUrl,
        filename: fileName,
      }, () => { if (chrome.runtime.lastError) {} });
    }

    // Render image element to canvas to get high-fidelity base64 data URL
    let companionUrl = finalUrl;
    if (imgEl && (imgEl.naturalWidth > 50 || imgEl.width > 50)) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth || imgEl.width;
        canvas.height = imgEl.naturalHeight || imgEl.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0);
        companionUrl = canvas.toDataURL('image/png');
        console.log('[BOLTHAVEN] ✓ Rendered image to canvas data URL for 100% reliable local save');
      } catch (canvasErr) {
        console.log('[BOLTHAVEN] Canvas render note (CORS tainted):', canvasErr.message);
      }
    }

    // Convert remote (e.g. files.oaiusercontent.com) or blob: URL to data: URL in tab context with credentials
    if (!companionUrl.startsWith('data:') && finalUrl) {
      try {
        const bResp = await fetch(finalUrl, { credentials: 'include' });
        if (bResp.ok) {
          const bBlob = await bResp.blob();
          companionUrl = await new Promise((res) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result);
            reader.readAsDataURL(bBlob);
          });
          console.log('[BOLTHAVEN] ✓ Converted image to data URL via in-tab fetch');
        }
      } catch (e) {
        console.warn('[BOLTHAVEN] In-tab fetch to data URL note:', e.message);
      }
    }

    // Secondary fallback: test with anonymous Image element to export data URL
    if (!companionUrl.startsWith('data:') && finalUrl && (finalUrl.startsWith('http:') || finalUrl.startsWith('https:'))) {
      try {
        const dataUrlFromImg = await new Promise((resolve) => {
          const testImg = new Image();
          testImg.crossOrigin = 'anonymous';
          testImg.onload = () => {
            try {
              const c = document.createElement('canvas');
              c.width = testImg.naturalWidth;
              c.height = testImg.naturalHeight;
              const cx = c.getContext('2d');
              cx.drawImage(testImg, 0, 0);
              resolve(c.toDataURL('image/png'));
            } catch (_) {
              resolve(null);
            }
          };
          testImg.onerror = () => resolve(null);
          testImg.src = finalUrl;
        });
        if (dataUrlFromImg) {
          companionUrl = dataUrlFromImg;
          console.log('[BOLTHAVEN] ✓ Converted image via anonymous Image element to data URL');
        }
      } catch (_) {}
    }

    // Tier 1: Primary Serialized Background Download (fetches via extension host permissions + saves via Node Companion + chrome.downloads)
    try {
      const dlUrl = companionUrl.startsWith('data:') ? companionUrl : finalUrl;
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'DOWNLOAD_IMAGE_SERIAL', url: dlUrl, filename: fileName, position, threadUrl },
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
        console.log('[BOLTHAVEN] ✓ Downloaded cleanly via serialized background download:', fileName);
        return true;
      }
      console.log('[BOLTHAVEN] Serial background download note, trying next tier...', response?.error);
    } catch (e) {
      console.log('[BOLTHAVEN] Serial background download failed:', e.message);
    }

    // Tier 2: Direct Node.js Companion download and disk write (fallback)
    try {
      console.log('[BOLTHAVEN] Tier 2: Requesting Node companion save for:', fileName);
      const compResp = await fetch('http://127.0.0.1:9224/save-generated-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: companionUrl, filename: fileName }),
      });
      if (compResp.ok) {
        console.log('[BOLTHAVEN] ✓ Companion wrote image directly to disk:', fileName);
        return true;
      }
    } catch (e) {
      console.log('[BOLTHAVEN] Companion direct save note:', e.message);
    }

    // Tier 3: Native ChatGPT UI Download (Direct button OR Share -> Modal -> Download OR Copy Image)
    try {
      const nativeTriggered = await triggerNativeChatGPTDownload(imgEl);
      if (nativeTriggered) {
        console.log('[BOLTHAVEN] ✓ Native ChatGPT download triggered for:', fileName);
        return true;
      }
    } catch (e) {
      console.log('[BOLTHAVEN] Native trigger download notice:', e.message);
    }

    // Tier 4: Direct in-tab blob anchor download (fallback)
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

    // 3. Fallback: Any button with download or share SVG icon in card
    for (const b of buttons) {
      if ((b.textContent || '').trim().toLowerCase() === 'edit') continue;
      const svg = b.querySelector('svg');
      if (svg) {
        const svgHtml = svg.innerHTML.toLowerCase();
        if (svgHtml.includes('download') || svgHtml.includes('m19 9') || svgHtml.includes('m12 15')) {
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

    // 0.1. Inspect newest assistant turn directly for output image
    const assistantTurns = Array.from(document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"], article'
    )).filter((turn) => {
      if (turn.getAttribute('data-message-author-role') === 'user') return false;
      if (turn.querySelector('[data-message-author-role="user"]')) return false;
      const c = (turn.className || '').toLowerCase();
      return !c.includes('user-turn') && !c.includes('user-message');
    });

    if (assistantTurns.length > preAssistantCount) {
      const latestTurn = assistantTurns[assistantTurns.length - 1];
      const turnImgs = Array.from(latestTurn.querySelectorAll('img')).filter((img) => {
        const src = img.src || img.getAttribute('src') || '';
        if (!src || preUrls.has(src)) return false;
        const s = src.toLowerCase();
        if (s.includes('avatar') || s.includes('profile') || s.includes('icon') || s.includes('emoji') || s.includes('logo')) return false;
        if (img.closest('form, div[class*="composer"], [data-message-author-role="user"], header, nav')) return false;
        const rect = img.getBoundingClientRect();
        const hasSize = (rect.width >= 100 && rect.height >= 100) || (img.naturalWidth >= 100 && img.naturalHeight >= 100);
        return (hasSize || s.includes('oaiusercontent.com') || s.includes('file-service') || s.startsWith('blob:')) && img.complete;
      });
      if (turnImgs.length > 0) {
        return turnImgs[turnImgs.length - 1];
      }
    }

    // 0.5. Locate image card that has a share/export button (ChatGPT new UI: Edit button is hover-only or absent)
    // These cards have a small circular share button (⬆) in bottom-right corner of the image
    const allImgCards = Array.from(document.querySelectorAll('img')).filter((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (!src || preUrls.has(src)) return false;
      const s = src.toLowerCase();
      if (s.includes('avatar') || s.includes('profile') || s.includes('icon') || s.includes('emoji') || s.includes('favicon') || s.includes('logo')) return false;
      if (img.closest('form, div[class*="composer"], nav, header, [data-message-author-role="user"]')) return false;
      const rect = img.getBoundingClientRect();
      const hasSize = (rect.width >= 100 && rect.height >= 100) || (img.naturalWidth >= 100 && img.naturalHeight >= 100);
      const isOai = s.includes('oaiusercontent.com') || s.includes('file-service') || s.startsWith('blob:');
      return (hasSize || isOai) && img.complete;
    });
    // Prefer images that have a nearby share/download button (confirms it's a generated image card)
    for (let i = allImgCards.length - 1; i >= 0; i--) {
      const img = allImgCards[i];
      const card = img.closest('div[class*="group"], div[class*="relative"], article, section') || img.parentElement;
      if (card) {
        const btns = Array.from(card.querySelectorAll('button, a[download]'));
        const hasActionBtn = btns.some((b) => {
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const title = (b.getAttribute('title') || '').toLowerCase();
          return aria.includes('share') || aria.includes('download') || aria.includes('export') ||
                 title.includes('share') || title.includes('download') || title.includes('export') ||
                 (b.textContent || '').trim() === 'Edit';
        });
        if (hasActionBtn) return img;
      }
    }
    // Final fallback: any new fully-loaded large image in the document (not in user/composer areas)
    if (allImgCards.length > 0) return allImgCards[allImgCards.length - 1];

    // 1. Assistant turns (from newest to oldest)
    const allAssistantTurns = Array.from(document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"], article'
    ));

    for (let i = allAssistantTurns.length - 1; i >= 0; i--) {
      const turn = allAssistantTurns[i];
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

  // Find newly generated enhanced photo for the Enhance IMG pipeline (strictly NEW images in turns generated AFTER preAssistantCount!)
  function findGeneratedEnhancedImage(preExistingUrls, preAssistantCount = 0) {
    const preUrls = preExistingUrls || new Set();

    // 1. Assistant turns (strictly excluding user turns)
    const allAssistantTurns = Array.from(
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

    // STRICT REQUIREMENT: Only look at turns generated AFTER preAssistantCount!
    // A generated image for the current prompt CANNOT exist in turns prior to preAssistantCount!
    if (allAssistantTurns.length <= preAssistantCount) {
      // ChatGPT has not finished or rendered the new assistant turn yet
      return null;
    }

    const newTurns = allAssistantTurns.slice(preAssistantCount);

    // Inspect new turns from newest to oldest
    for (let i = newTurns.length - 1; i >= 0; i--) {
      const turn = newTurns[i];

      // Check if this turn is still actively thinking, generating, or rendering
      const hasActiveProgress = turn.querySelector(
        'svg.animate-spin, div[class*="spin"], .result-thinking, .animate-pulse, div[class*="shimmer"], [data-testid*="thinking"], [data-testid*="generating"], div[class*="loading"]'
      );
      const turnText = (turn.textContent || '').toLowerCase();
      const isGeneratingText =
        turnText.includes('creating image') ||
        turnText.includes('generating image') ||
        turnText.includes('drawing image') ||
        turnText.includes('thinking');

      if (hasActiveProgress || isGeneratingText) {
        // Still generating in this turn! Wait for completion.
        return null;
      }

      // Find valid generated image strictly inside this new assistant turn
      const imgs = Array.from(turn.querySelectorAll('img')).filter((img) => {
        const src = img.src || img.getAttribute('src') || '';
        if (!src) return false;
        const cleanSrc = src.split('?')[0];
        if (preUrls.has(src) || preUrls.has(cleanSrc)) return false;

        const s = src.toLowerCase();
        if (s.includes('avatar') || s.includes('profile') || s.includes('icon') || s.includes('emoji') || s.includes('logo')) {
          return false;
        }
        if (img.closest('form, div[class*="composer"], [data-message-author-role="user"], header, nav')) {
          return false;
        }

        // Must be complete and have realistic generated image dimensions (>= 200px)
        if (!img.complete) return false;
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        return w >= 200 && h >= 200;
      });

      if (imgs.length > 0) {
        return imgs[imgs.length - 1];
      }
    }

    // Never search outside the new turns! If no complete image exists in new turns, it's still generating!
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
      const explicit = document.querySelector('[class*="ComposerLayoutBody" i], [class*="ComposerLayoutRoot" i], #composer-background, form, main');
      return explicit || null;
    }

    // Modern ChatGPT structure:
    // Level 0: ProseMirror (#prompt-textarea)
    // Level 2: ComposerLayoutInput
    // Level 6+: ComposerLayoutBody, form, #composer-background
    let cur = input.parentElement;
    let best = null;
    for (let depth = 0; depth < 12 && cur && cur !== document.body && cur !== document.documentElement; depth++) {
      if (
        cur.id === 'composer-background' ||
        cur.tagName === 'FORM' ||
        (cur.className && typeof cur.className === 'string' && (cur.className.includes('ComposerLayout') || cur.className.includes('composer')))
      ) {
        best = cur;
        break;
      }
      if (cur.querySelector('button[data-testid*="send" i], button[aria-label*="Send" i], button[data-testid*="fruitjuice-send-button"]')) {
        best = cur;
      }
      cur = cur.parentElement;
    }
    if (best) return best;

    const fallback = document.querySelector('#composer-background, form, [class*="ComposerLayoutBody" i]');
    if (fallback) return fallback;

    return input.parentElement && input.parentElement.parentElement ? input.parentElement.parentElement : document;
  }

  // Robust element clicker that dispatches full pointer + mouse event sequence (for React Fiber / Radix UI buttons)
  function clickElementRobustly(el) {
    if (!el) return false;
    try { el.focus(); } catch (e) {}
    try {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const downOpts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
      el.dispatchEvent(new PointerEvent('pointerdown', { ...downOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mousedown', downOpts));
      const upOpts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 0 };
      el.dispatchEvent(new PointerEvent('pointerup', { ...upOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mouseup', upOpts));
      el.dispatchEvent(new MouseEvent('click', upOpts));
      el.click();
      const svg = el.querySelector('svg');
      if (svg) {
        svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
      return true;
    } catch (e) {
      try { el.click(); return true; } catch (e2) {}
    }
    return false;
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

  // Find thumbnail delete / remove buttons strictly inside the composer (excluding attach/plus button!)
  function findAttachmentRemoveButtons(inputEl) {
    const composer = getComposerContainer(inputEl) || document.querySelector('#composer-background, form, main') || document;
    if (!composer) return [];

    const searchRoots = [composer, document.querySelector('#composer-background'), document.querySelector('form')].filter(Boolean);
    const seen = new Set();
    const result = [];

    for (const root of searchRoots) {
      // 1. Buttons, role="button", and interactive elements inside composer
      const candidates = Array.from(root.querySelectorAll('button, [role="button"], div[class*="close" i], div[class*="remove" i], div[class*="dismiss" i]'));

      for (const btn of candidates) {
        if (seen.has(btn)) continue;
        if (btn.disabled) continue;

        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const testid = (btn.getAttribute('data-testid') || '').toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();
        const text = (btn.textContent || '').trim().toLowerCase();

        // If this is an explicit remove / delete / dismiss / close button:
        const isExplicitRemove = (
          aria.includes('remove') ||
          aria.includes('delete') ||
          aria.includes('dismiss') ||
          aria.includes('close') ||
          testid.includes('remove') ||
          testid.includes('delete') ||
          testid.includes('dismiss') ||
          testid.includes('close') ||
          title.includes('remove') ||
          title.includes('delete') ||
          title.includes('close')
        );

        if (isExplicitRemove) {
          seen.add(btn);
          result.push(btn);
          continue;
        }

        // Strictly exclude Send, Attach (+), Model, Voice, Upload ONLY IF NOT an explicit remove button!
        const isMainAction = (
          aria.includes('send') || aria.includes('plus') || aria.includes('add') ||
          aria === 'attach' || aria === 'attach files' || aria.startsWith('attach ') ||
          aria.includes('upload') ||
          aria.includes('voice') || aria.includes('mic') || aria.includes('dictate') ||
          aria.includes('model') || text === 'files' || text === 'send' ||
          testid.includes('send') || testid === 'attach-button' || testid.includes('upload') ||
          testid.includes('model') || testid.includes('plus')
        );
        if (isMainAction) {
          continue;
        }

        const parentThumb = btn.closest(
          '[class*="thumbnail" i], [class*="file-tile" i], [data-testid*="attachment" i], [data-testid*="file-tile" i], div[class*="relative"][class*="rounded"], div[class*="relative"]:has(img), div[class*="rounded"]:has(img)'
        );
        if (parentThumb && (btn.querySelector('svg') || text.includes('✕') || text.includes('×') || text === 'x')) {
          seen.add(btn);
          result.push(btn);
          continue;
        }
      }
    }

    return result;
  }

  // Count distinct genuine image attachments present in the composer
  function getAttachedImagesCount(inputEl) {
    const composer = getComposerContainer(inputEl) || document.querySelector('form, div#composer-background, [class*="composer" i]') || document;

    // 1. Thumbnail cards / tiles in ChatGPT composer (including active upload cards with spinners!)
    if (composer) {
      const cardSelectors = [
        '[data-testid*="attachment" i]',
        '[data-testid*="file-tile" i]',
        '[class*="attachment-tile" i]',
        '[class*="file-tile" i]',
        'div[class*="relative"][class*="rounded"]:has(img, canvas)',
        'div[class*="relative"]:has(img[src*="blob:"], img[src*="data:"], img[src*="oaiusercontent"])'
      ].join(', ');

      const cards = Array.from(composer.querySelectorAll(cardSelectors)).filter((el) => {
        if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return false;
        if (el.closest('button, nav, header, [data-message-author-role="assistant"], [data-message-author-role="user"]')) return false;
        const r = el.getBoundingClientRect();
        const isCardSize = r.width >= 30 && r.width <= 260 && r.height >= 30 && r.height <= 260;
        if (!isCardSize) return false;
        const hasImg = el.querySelector('img, canvas');
        const hasSpinner = el.querySelector('svg, circle, [class*="spin" i]');
        const hasBgImg = (el.style?.backgroundImage || '').includes('blob:') || (el.style?.backgroundImage || '').includes('data:');
        return Boolean(hasImg || hasSpinner || hasBgImg);
      });
      // Filter out nested child cards to count each thumbnail card strictly once
      const topCards = cards.filter((c) => !cards.some((other) => other !== c && other.contains(c)));
      if (topCards.length > 0) return topCards.length;

      // 2. Remove buttons strictly inside composer or document
      const removeBtns = findAttachmentRemoveButtons(composer);
      if (removeBtns.length > 0) return removeBtns.length;

      // 3. Thumbnail images strictly inside composer (excluding icons/avatars)
      const thumbImgs = Array.from(composer.querySelectorAll('img')).filter((img) => {
        if (img.closest('nav, header, [data-message-author-role="assistant"], [data-message-author-role="user"]')) return false;
        const src = img.src || img.getAttribute('src') || '';
        if (!src) return false;
        const lower = src.toLowerCase();
        if (lower.includes('avatar') || lower.includes('profile') || lower.includes('icon') || lower.includes('logo') || lower.includes('svg')) return false;
        if (lower.startsWith('blob:') || lower.startsWith('data:') || lower.includes('oaiusercontent') || lower.includes('files')) return true;
        const rect = img.getBoundingClientRect();
        return (rect.width >= 24 && rect.height >= 24 && rect.width <= 300);
      });
      if (thumbImgs.length > 0) return thumbImgs.length;

      // 4. Any upload spinners / progress rings in composer (image actively uploading)
      const spinners = Array.from(composer.querySelectorAll('svg circle, [class*="animate-spin" i], [class*="progress" i]')).filter((s) => {
        if (s.closest('nav, header, [data-message-author-role="assistant"]')) return false;
        const r = s.getBoundingClientRect();
        return r.width >= 14 && r.height >= 14;
      });
      if (spinners.length > 0) return spinners.length;
    }

    // 5. Send button active while textarea is empty (in ChatGPT, Send button only enables with 0 text if image is attached!)
    const composerText = getComposerText(inputEl);
    if (!composerText || composerText.length === 0) {
      const sendBtn = findComposerSendButton() || findSendButton();
      if (sendBtn && isSendButtonReady(sendBtn) && !isAudioOrSpeechButton(sendBtn)) {
        return 1;
      }
    }

    return 0;
  }

  // Detect whether an image thumbnail/attachment is actively present in the ChatGPT composer
  function isImageAttachedInComposer(inputEl, minCount = 1) {
    return getAttachedImagesCount(inputEl) >= minCount;
  }

  // Clear any leftover attachments before starting a new job
  async function pruneExcessAttachments(inputEl, maxExpected = 0) {
    const composer = getComposerContainer(inputEl) || document.querySelector('form, #composer-background, main') || document;
    if (!composer) return;

    let attempts = 0;
    while (getAttachedImagesCount(composer) > maxExpected && attempts < 8) {
      attempts++;
      console.log(`[BOLTHAVEN] Pruning attachments (attempt ${attempts}, count: ${getAttachedImagesCount(composer)}, maxExpected: ${maxExpected})...`);
      const removeBtns = findAttachmentRemoveButtons(composer);
      if (removeBtns.length === 0) {
        // Try clicking on thumbnail cards directly
        const cards = composer.querySelectorAll(
          '[data-testid*="attachment" i], [data-testid*="file-tile" i], [class*="attachment" i], [class*="file-tile" i], [class*="thumbnail" i], div:has(> img)'
        );
        for (const c of cards) {
          const btn = c.querySelector('button, [role="button"], svg');
          if (btn) clickElementRobustly(btn);
        }
      } else {
        const toRemove = removeBtns.length - maxExpected;
        for (let i = 0; i < (maxExpected === 0 ? removeBtns.length : Math.max(1, toRemove)); i++) {
          if (removeBtns[i]) {
            clickElementRobustly(removeBtns[i]);
            await new Promise((r) => setTimeout(r, 120));
          }
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Thoroughly and aggressively wipes out ALL text, drafts, chips, and attached images from ChatGPT composer
  async function cleanComposerInputCompletely(inputEl) {
    const promptArea = inputEl || findPromptInput();
    const composer = getComposerContainer(promptArea) || document.querySelector('form, #composer-background, main') || document;

    console.log('[BOLTHAVEN] 🧹 Executing complete chat input & attachment cleanup...');

    // 1. Reset any native file inputs to release file handles
    document.querySelectorAll('input[type="file"]').forEach((fi) => {
      try {
        fi.value = '';
        if (fi._valueTracker) fi._valueTracker.setValue('');
        fi.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    });

    // 1b. Hover over all attachment cards to reveal any hover-only remove buttons
    try {
      const cards = composer.querySelectorAll('[data-testid*="attachment" i], [data-testid*="file-tile" i], [class*="file-tile" i], div[class*="relative"]:has(img)');
      cards.forEach((card) => {
        card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      });
    } catch (e) {}

    // 2. Click all attachment remove buttons with robust pointer/mouse sequence
    for (let loop = 0; loop < 5; loop++) {
      const removeBtns = findAttachmentRemoveButtons(composer);
      if (removeBtns.length === 0) break;
      for (const btn of removeBtns) {
        clickElementRobustly(btn);
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    // 3. Clear prompt area text cleanly without destroying the ProseMirror <p> element
    if (promptArea) {
      try {
        promptArea.focus();
        if (promptArea.tagName === 'TEXTAREA') {
          promptArea.value = '';
          promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          promptArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        } else {
          const ps = Array.from(promptArea.querySelectorAll('p'));
          if (ps.length > 0) {
            ps.forEach((p, idx) => {
              if (idx === 0) {
                p.textContent = '';
              } else {
                p.remove();
              }
            });
          } else {
            promptArea.textContent = '';
          }
          promptArea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward' }));
          promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          promptArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        }
      } catch (e) {}
    }

    // 4. If attachments are still detected, dispatch Backspace/Delete keys on empty promptArea to delete preceding attachment chip
    if (getAttachedImagesCount(promptArea) > 0 && promptArea) {
      try {
        promptArea.focus();
        const backspaceOpts = { key: 'Backspace', code: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true, composed: true };
        for (let i = 0; i < 3; i++) {
          promptArea.dispatchEvent(new KeyboardEvent('keydown', backspaceOpts));
          promptArea.dispatchEvent(new KeyboardEvent('keyup', backspaceOpts));
          await new Promise((r) => setTimeout(r, 100));
        }
      } catch (e) {}
    }

    // 5. Final check of remove buttons
    const remainingBtns = findAttachmentRemoveButtons(composer);
    for (const btn of remainingBtns) {
      clickElementRobustly(btn);
    }

    await new Promise((r) => setTimeout(r, 250));
    const finalCount = getAttachedImagesCount(promptArea);
    const finalText = getComposerText(promptArea);
    console.log(`[BOLTHAVEN] 🧹 Clean input result: attachments=${finalCount}, textChars=${finalText.length}`);
    return finalCount === 0 && finalText.length === 0;
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
    if (!current || current.trim().length < 3) return false;
    // Any prompt over 12 characters is genuinely accepted text
    if (current.trim().length >= 12) return true;
    if (expectedText) {
      const cleanExpected = expectedText.trim().toLowerCase();
      const firstChunk = cleanExpected.slice(0, Math.min(15, cleanExpected.length));
      if (current.toLowerCase().includes(firstChunk)) return true;
    }
    return current.trim().length > 3;
  }

  // Safely clear ONLY prompt text (strictly preserving all attached images!)
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
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(promptArea);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('delete', false, null);
      } catch (e) {}

      promptArea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward' }));
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

    // Target the specific text paragraph <p> inside promptArea, NEVER the container itself!
    let targetP = promptArea.querySelector('p');
    if (!targetP) {
      targetP = document.createElement('p');
      promptArea.appendChild(targetP);
    }

    // Method 0: Select ONLY targetP and execute insertText (preserves attachments outside <p>!)
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(targetP);
      sel.removeAllRanges();
      sel.addRange(range);
      const inserted = document.execCommand('insertText', false, cleanText);
      if (inserted && isPromptActuallyInserted(cleanText, promptArea)) {
        promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        console.log(`[BOLTHAVEN] setPromptText: Method 0 (execCommand insertText on <p>) succeeded (${getComposerText(promptArea).length} chars)`);
        return true;
      }
    } catch (e) {}

    // Method 1: Synthetic beforeinput on targetP
    try {
      targetP.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', cleanText);
      targetP.dispatchEvent(new InputEvent('beforeinput', {
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

    // Method 2: Synthetic paste event on targetP
    try {
      targetP.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', cleanText);
      const pasteEv = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      Object.defineProperty(pasteEv, 'clipboardData', { value: dt });
      targetP.dispatchEvent(pasteEv);
    } catch (e) {}

    if (isPromptActuallyInserted(cleanText, promptArea)) {
      promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      console.log(`[BOLTHAVEN] setPromptText: Method 2 (native paste) succeeded (${getComposerText(promptArea).length} chars)`);
      return true;
    }

    // Method 3: Line-by-line insertion on targetP
    try {
      targetP.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(targetP);
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

    // Method 4: Target paragraph textContent (preserves sibling attachments!)
    try {
      targetP.classList.remove('placeholder');
      targetP.removeAttribute('data-placeholder');
      targetP.textContent = cleanText;
      targetP.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: cleanText }));
    } catch (e) {}

    promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    promptArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

    let ready = isPromptActuallyInserted(cleanText, promptArea);
    if (ready) {
      console.log(`[BOLTHAVEN] setPromptText: Method 4 (targetP textContent) succeeded (${getComposerText(promptArea).length} chars)`);
      return true;
    }

    // Method 5: MAIN world async injection via background script (bypasses Chrome isolated world for ProseMirror)
    try {
      console.log('[BOLTHAVEN] Triggering INSERT_PROMPT_MAIN_WORLD via background script...');
      chrome.runtime.sendMessage({ action: 'INSERT_PROMPT_MAIN_WORLD', text: cleanText }, () => {});
    } catch (e) {}

    // NOTE: MAIN world is async — caller must wait and re-check isPromptActuallyInserted
    console.log(`[BOLTHAVEN] setPromptText: Method 5 (MAIN world) queued — caller must await confirmation`);
    return false; // signal caller that verification needed
  }

  // Async wrapper: set prompt text and WAIT until it is actually readable back, or timeout
  async function setPromptTextAsync(inputEl, text, timeoutMs = 4000) {
    // First try the sync methods
    const syncResult = setPromptText(inputEl, text);
    if (syncResult && isPromptActuallyInserted(text, inputEl || findPromptInput())) {
      return true;
    }

    // Wait for MAIN world injection to take effect
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
      if (isPromptActuallyInserted(text, inputEl || findPromptInput())) {
        const pm = inputEl || findPromptInput();
        console.log(`[BOLTHAVEN] setPromptTextAsync: confirmed inserted (${getComposerText(pm).length} chars)`);
        return true;
      }
      // Re-trigger MAIN world injection if still not inserted
      try {
        chrome.runtime.sendMessage({ action: 'INSERT_PROMPT_MAIN_WORLD', text }, () => {});
      } catch (e) {}
    }
    return isPromptActuallyInserted(text, inputEl || findPromptInput());
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
            const lastErr = chrome.runtime.lastError;
            if (lastErr) {
              reject(new Error(lastErr.message || 'Background fetch port closed'));
              return;
            }
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
        if (u.startsWith('data:')) {
          const b = dataUrlToBlob(u);
          if (b) return b;
        }
        try {
          const resp = await fetch(u);
          if (resp.ok) {
            return await resp.blob();
          }
        } catch (e) {}
      }
      throw lastError || new Error('Could not fetch image blob from candidate URLs');
    }

    const b = dataUrlToBlob(b64DataUrl);
    if (b) return b;
    const resp = await fetch(b64DataUrl);
    return await resp.blob();
  }

  // Helper to convert File/Blob to Base64 data URL
  function fileToDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  // Robustly locate or mount ChatGPT's native file input
  async function ensureChatGPTFileInput() {
    let fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
    let targetInput = fileInputs.find((i) => (i.accept || '').includes('image')) ||
                      fileInputs[fileInputs.length - 1] ||
                      fileInputs[0];
    if (targetInput) return targetInput;

    const plusBtn = findAttachmentButton();
    if (plusBtn) {
      console.log('[BOLTHAVEN] Clicking plus button to reveal upload menu...');
      clickElementSafely(plusBtn);
      await new Promise((r) => setTimeout(r, 250));

      const menuItems = Array.from(
        document.querySelectorAll('[role="menuitem"], [role="menu"] button, div[class*="popover"] button, div[role="dialog"] button, [data-radix-collection-item]')
      );
      const uploadItem = menuItems.find((el) => {
        const t = (el.textContent || '').toLowerCase();
        return t.includes('upload') || t.includes('computer') || t.includes('photo') || t.includes('file');
      });
      if (uploadItem) {
        console.log('[BOLTHAVEN] Clicking upload menu item:', uploadItem.textContent?.trim());
        clickElementSafely(uploadItem);
        await new Promise((r) => setTimeout(r, 250));
      }

      fileInputs = Array.from(document.querySelectorAll('input[type="file"], input[accept*="image"]'));
      targetInput = fileInputs.find((i) => (i.accept || '').includes('image')) ||
                    fileInputs[fileInputs.length - 1] ||
                    fileInputs[0];
    }
    return targetInput || null;
  }

  // Attach a single image File into the ChatGPT composer cleanly with multi-method fallbacks
  async function attachImageFileToComposer(inputEl, file, maxExpected = 1, minExpected = 1, dataUrlHint = null) {
    const targetInputArea = inputEl || findPromptInput();

    if (activeJobAborted) return false;

    // Convert file to DataURL if not provided, ensuring MAIN world script has valid data
    let effectiveDataUrl = dataUrlHint;
    if ((!effectiveDataUrl || typeof effectiveDataUrl !== 'string' || !effectiveDataUrl.startsWith('data:')) && file) {
      try {
        effectiveDataUrl = await fileToDataUrl(file);
      } catch (e) {}
    }

    const dt = new DataTransfer();
    dt.items.add(file);

    // METHOD A: Native input[type="file"]
    const targetInput = await ensureChatGPTFileInput();
    if (targetInput) {
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

      try {
        const reactPropsKey = Object.keys(targetInput).find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
        if (reactPropsKey && targetInput[reactPropsKey]?.onChange) {
          targetInput[reactPropsKey].onChange({ target: targetInput, currentTarget: targetInput });
        }
      } catch (e) {}

      targetInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

      // Close popover if opened
      await new Promise((r) => setTimeout(r, 150));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

      // Wait up to 3 seconds for attachment to register
      const attachedMethodA = await waitForImageAttached(inputEl, 3000, minExpected);
      if (attachedMethodA || getAttachedImagesCount(inputEl) >= minExpected) {
        console.log(`[BOLTHAVEN] ✓ Attached image successfully via Method A (${getAttachedImagesCount(inputEl)} attached)`);
        return true;
      }
    }

    // METHOD B: Synthetic Drag & Drop on composer target
    const pm = document.querySelector('#prompt-textarea, .ProseMirror, textarea') || targetInputArea || document.querySelector('form');
    if (pm) {
      pm.focus();
      try {
        const dragEnter = new DragEvent('dragenter', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
        const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
        const dropEv = new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
        pm.dispatchEvent(dragEnter);
        pm.dispatchEvent(dragOver);
        pm.dispatchEvent(dropEv);
      } catch (e) {}

      const attachedMethodB = await waitForImageAttached(inputEl, 2500, minExpected);
      if (attachedMethodB || getAttachedImagesCount(inputEl) >= minExpected) {
        console.log(`[BOLTHAVEN] ✓ Attached image successfully via Method B (Drop) (${getAttachedImagesCount(inputEl)} attached)`);
        return true;
      }

      // METHOD C: Synthetic Clipboard Paste
      try {
        const pasteEv = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          composed: true,
          clipboardData: dt,
        });
        pm.dispatchEvent(pasteEv);
      } catch (e) {}

      const attachedMethodC = await waitForImageAttached(inputEl, 2500, minExpected);
      if (attachedMethodC || getAttachedImagesCount(inputEl) >= minExpected) {
        console.log(`[BOLTHAVEN] ✓ Attached image successfully via Method C (Paste) (${getAttachedImagesCount(inputEl)} attached)`);
        return true;
      }
    }

    // METHOD D: MAIN world injection (handles React Fiber & ProseMirror context without sandbox barriers)
    if (effectiveDataUrl && typeof effectiveDataUrl === 'string' && effectiveDataUrl.startsWith('data:')) {
      try {
        console.log('[BOLTHAVEN] Method D: Injecting ATTACH_IMAGE_MAIN_WORLD into MAIN world context...');
        await new Promise((res) => {
          chrome.runtime.sendMessage({
            action: 'ATTACH_IMAGE_MAIN_WORLD',
            dataUrl: effectiveDataUrl,
            filename: file.name || 'property_image.jpg',
          }, (mRes) => {
            if (chrome.runtime.lastError) {}
            res(mRes?.success ?? false);
          });
        });

        const attachedMethodD = await waitForImageAttached(inputEl, 6000, minExpected);
        if (attachedMethodD || getAttachedImagesCount(inputEl) >= minExpected) {
          console.log(`[BOLTHAVEN] ✓ Attached image via Method D (MAIN world) (${getAttachedImagesCount(inputEl)} attached)`);
          return true;
        }
      } catch (e) {
        console.warn('[BOLTHAVEN] Method D error:', e);
      }
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

  // ── Watch ChatGPT Generation & Auto-Download Enhanced Result ────────────
  async function watchGenerationAndDownload(job, preExistingImageUrls, preAssistantCount) {
    console.log(`[BOLTHAVEN] [Generation Phase] Monitoring ChatGPT generation for Image #${job.original_position || 1}...`);

    // Wait 2s for prompt dispatch
    await new Promise((r) => setTimeout(r, 2000));

    const startTime = Date.now();
    const maxWaitMs = 360000; // 6 minutes max
    const MIN_GENERATION_WAIT_MS = 20000; // Must wait at least 20s (AI image generation takes 30-75s)
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
          }, () => { if (chrome.runtime.lastError) {} });
          return resolve({ success: false, error: 'Job stopped by user' });
        }

        const elapsed = Date.now() - startTime;
        if (elapsed > maxWaitMs) {
          clearInterval(checkInterval);
          chrome.runtime.sendMessage({
            action: 'JOB_GENERATION_FAILED',
            jobId: job.job_id,
            error: 'ChatGPT image generation timed out (6 min)',
          }, () => { if (chrome.runtime.lastError) {} });
          return resolve({ success: false, error: 'ChatGPT image generation timed out (6 min)' });
        }

        const currentlyGenerating = isThinkingOrGenerating();

        // ── Auto-skip "Which image do you like more?" comparison prompt ──
        autoSkipComparisonPrompt();

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
              }, () => { if (chrome.runtime.lastError) {} });
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

        // 2. Strict image search: ONLY inspect the newly created assistant turn for this exact job
        // NEVER search outside the new assistant turn and NEVER fall back to whole-page queries,
        // which previously caused grabbing older photos from previous runs!
        let enhancedImg = findGeneratedEnhancedImage(preExistingImageUrls, preAssistantCount);

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
          const pos = job.original_position || 1;
          const rawCode = job.listing_code || (job.property_metadata && job.property_metadata.listing_code) || '';
          const cleanCode = rawCode ? rawCode.replace(/[\/\\?%*:|"<>]/g, '').trim() : '';
          const fileName = cleanCode
            ? `${cleanCode}-${pos}.png`
            : `enhanced_${pos}_${job.job_id || Date.now()}.png`;

          // Memorize the ChatGPT chat thread URL for this exact image position
          const currentChatUrl = window.location.href;
          if (currentChatUrl && (currentChatUrl.includes('chatgpt.com') || currentChatUrl.includes('chat.openai.com'))) {
            chrome.runtime.sendMessage({
              action: 'MEMORIZE_IMAGE_THREAD',
              position: pos,
              threadUrl: currentChatUrl,
              filename: fileName,
              listingCode: cleanCode,
            }, () => { if (chrome.runtime.lastError) {} });
          }

          // Download using serialized multi-tier downloader
          await downloadEnhancedImage(enhancedImg, finalUrl, fileName);
          await new Promise((r) => setTimeout(r, 2000));

          // Notify background that generation & download succeeded
          chrome.runtime.sendMessage({
            action: 'JOB_GENERATION_COMPLETE',
            jobId: job.job_id,
            original_position: job.original_position,
            result_url: finalUrl,
          }, () => { if (chrome.runtime.lastError) {} });

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

  // Navigate to New Chat cleanly (guarantees empty composer with 0 attachments)
  function startNewChatSmoothly(forceReload = false) {
    if (forceReload) {
      window.location.href = 'https://chatgpt.com/';
      window.location.reload();
      return true;
    }
    const newChatBtn = (
      document.querySelector('a[href="/"]') ||
      document.querySelector('button[data-testid="create-new-chat-button"]') ||
      document.querySelector('a[data-testid="create-new-chat-button"]') ||
      document.querySelector('button[aria-label*="New chat" i]') ||
      document.querySelector('a[aria-label*="New chat" i]') ||
      document.querySelector('button[data-testid="fruitjuice-new-chat-button"]')
    );
    if (newChatBtn && window.location.pathname.startsWith('/c/')) {
      try { newChatBtn.click(); return true; } catch (e) {}
    }
    if (window.location.pathname !== '/' || window.location.search) {
      window.location.href = 'https://chatgpt.com/';
      return true;
    }
    window.location.reload();
    return true;
  }

  // Clear prompt input cleanly (removes all text and chips without touching the attached image)
  function clearPromptInputCleanly(inputEl) {
    const promptArea = inputEl || findPromptInput();
    const composer = getComposerContainer(promptArea) || document.querySelector('form');

    // Dismiss any text/pill chips in composer (excluding image attachment)
    if (composer) {
      const dismissBtns = Array.from(composer.querySelectorAll('button')).filter((b) => {
        const chip = b.closest('[class*="pill" i], [class*="chip" i], [class*="badge" i], div[class*="rounded"]');
        if (!chip) return false;
        if (chip.querySelector('img, canvas')) return false; // strictly preserve image!
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const text = (b.textContent || '').trim().toLowerCase();
        return aria.includes('remove') || aria.includes('close') || aria.includes('dismiss') || text.includes('✕') || Boolean(b.querySelector('svg'));
      });
      for (const btn of dismissBtns) {
        try { btn.click(); } catch (e) {}
      }
    }

    if (promptArea) {
      promptArea.focus();
      if (promptArea.tagName === 'TEXTAREA') {
        promptArea.value = '';
      } else {
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(promptArea);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('delete', false, null);
        } catch (e) {}
        promptArea.innerHTML = '<p><br></p>';
      }
      promptArea.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward' }));
      promptArea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      promptArea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }
  }

  // Purge composer completely (removes all text, chips, pills, and attachments)
  async function purgeComposerCleanly(inputEl) {
    return await cleanComposerInputCompletely(inputEl);
  }

  // Reliable prompt inserter that keeps ProseMirror document model in sync
  async function insertPromptCleanly(promptEl, promptText) {
    if (!promptEl || !promptText) return false;
    const cleanText = promptText.trim();
    promptEl.focus();

    // Select ENTIRE editor contents (all paragraphs) and replace cleanly
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(promptEl);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete', false, null);
    } catch (e) {}

    let p = promptEl.querySelector('p');
    if (!p) {
      p = document.createElement('p');
      promptEl.appendChild(p);
    }
    p.focus();

    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, cleanText);
    } catch (e) {}

    if (!inserted || (promptEl.innerText || promptEl.textContent || '').trim().length < 5) {
      p.textContent = cleanText;
      p.classList.remove('placeholder');
      p.removeAttribute('data-placeholder');
    }

    promptEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: cleanText }));
    promptEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    promptEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 200));

    return true;
  }

  // Find the exact send button inside the composer
  function findComposerSendButton() {
    const composer = getComposerContainer() || document.querySelector('form') || document;

    const byTestId = composer.querySelector('button[data-testid="send-button"], button[data-testid="composer-send-button"]');
    if (byTestId && !byTestId.disabled && isSendButtonReady(byTestId) && !isAudioOrSpeechButton(byTestId)) return byTestId;

    const byAria = composer.querySelector('button[aria-label="Send prompt"], button[aria-label="Send message"], button[aria-label="Send"]');
    if (byAria && !byAria.disabled && isSendButtonReady(byAria) && !isAudioOrSpeechButton(byAria)) return byAria;

    const bySubmit = composer.querySelector('form button[type="submit"], button[type="submit"]');
    if (bySubmit && !bySubmit.disabled && isSendButtonReady(bySubmit) && !isAudioOrSpeechButton(bySubmit)) return bySubmit;

    const btns = Array.from(composer.querySelectorAll('button:not(:disabled)')).filter((b) => {
      if (!isSendButtonReady(b) || isAudioOrSpeechButton(b) || isStopButton(b)) return false;
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const tid = (b.getAttribute('data-testid') || '').toLowerCase();
      if (aria.includes('attach') || aria.includes('plus')) return false;
      if (tid.includes('attach') || tid.includes('plus')) return false;
      return Boolean(b.querySelector('svg'));
    });

    if (btns.length > 0) {
      btns.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
      return btns[0];
    }

    return null;
  }

  // Robust ChatGPT Send dispatcher (clicks button, requests form submit, and fires Enter key)
  async function triggerSendRobustly(promptEl) {
    console.log('[BOLTHAVEN] Triggering ChatGPT Send...');

    const deadline = Date.now() + 25000;
    let attempt = 0;

    while (Date.now() < deadline) {
      if (activeJobAborted) return false;
      attempt++;

      // Make sure any accidental audio/speech recording mode is dismissed immediately
      dismissVoiceOrAudioModeIfActive();

      // 1. If generation has already started or stop button is visible, success!
      if (isThinkingOrGenerating() || Boolean(findStopButton())) {
        console.log('[BOLTHAVEN] ✓ Generation is active!');
        return true;
      }

      const input = promptEl || findPromptInput();
      const currentComposerText = getComposerText(input);
      const currentAttachments = getAttachedImagesCount(input);

      // CRITICAL: If the composer is already empty and has no attachments,
      // the prompt has ALREADY been submitted! Do NOT click any button!
      // When composer is empty, ChatGPT displays the audio/microphone button in place of Send!
      if (attempt > 1 && currentComposerText.length === 0 && currentAttachments === 0) {
        console.log('[BOLTHAVEN] Composer is already empty (prompt was submitted). Waiting for ChatGPT generation...');
        await new Promise((r) => setTimeout(r, 1000));
        dismissVoiceOrAudioModeIfActive();
        if (isThinkingOrGenerating() || Boolean(findStopButton())) {
          return true;
        }
        continue;
      }

      // 2. Dispatch native Enter keydown on prompt textarea (ProseMirror's default submit trigger)
      if (input && currentComposerText.length > 0) {
        input.focus();
        const enterOpts = {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          charCode: 13,
          bubbles: true,
          cancelable: true,
          composed: true,
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
        };
        input.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
        input.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
        input.dispatchEvent(new KeyboardEvent('keyup', enterOpts));

        // Check if Enter immediately submitted the text
        await new Promise((r) => setTimeout(r, 300));
        const afterEnterText = getComposerText(input);
        if (afterEnterText.length === 0 && getAttachedImagesCount(input) === 0) {
          console.log('[BOLTHAVEN] Enter key submitted prompt successfully! Waiting for generation...');
          await new Promise((r) => setTimeout(r, 1000));
          dismissVoiceOrAudioModeIfActive();
          if (isThinkingOrGenerating() || Boolean(findStopButton())) {
            return true;
          }
          continue;
        }
      }

      // 3. Dispatch full pointer/mouse sequence on Send button ONLY if it is a valid Send button (strictly never audio/mic/speech!)
      const sendBtn = findComposerSendButton() || findSendButton();
      if (sendBtn && isSendButtonReady(sendBtn) && !isAudioOrSpeechButton(sendBtn)) {
        sendBtn.focus();
        const rect = sendBtn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const downOpts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
        sendBtn.dispatchEvent(new PointerEvent('pointerdown', { ...downOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
        sendBtn.dispatchEvent(new MouseEvent('mousedown', downOpts));

        const upOpts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 0 };
        sendBtn.dispatchEvent(new PointerEvent('pointerup', { ...upOpts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
        sendBtn.dispatchEvent(new MouseEvent('mouseup', upOpts));
        sendBtn.dispatchEvent(new MouseEvent('click', upOpts));
        sendBtn.click();

        const svg = sendBtn.querySelector('svg');
        if (svg) {
          svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }

        const form = sendBtn.closest('form') || document.querySelector('form');
        if (form && typeof form.requestSubmit === 'function') {
          try { form.requestSubmit(sendBtn); } catch (e) {
            try { form.requestSubmit(); } catch (e2) {}
          }
        }

        // 4. Dispatch in MAIN world context (bypasses isolated world for React Fiber onClick)
        safeSendMessage({ action: 'CLICK_SEND_MAIN_WORLD' });
      }

      await new Promise((r) => setTimeout(r, 1200));
      dismissVoiceOrAudioModeIfActive();

      const generating = isThinkingOrGenerating();
      const hasStop = Boolean(findStopButton());
      const composerTextNow = getComposerText(input);
      const attachmentsNow = getAttachedImagesCount(input);
      const sendBtnNow = findComposerSendButton() || findSendButton();
      const sendGone = !sendBtnNow || !isSendButtonReady(sendBtnNow);

      if (generating || hasStop || (composerTextNow.length === 0 && attachmentsNow === 0) || sendGone) {
        console.log(`[BOLTHAVEN] ✓ Send verified dispatched on attempt ${attempt}!`);
        return true;
      }
      console.log(`[BOLTHAVEN] Send attempt ${attempt} waiting for ChatGPT generation...`);
    }

    return isThinkingOrGenerating() || Boolean(findStopButton());
  }

  async function _setupAndSendJobInternal(job) {
    activeJobAborted = false;
    dismissVoiceOrAudioModeIfActive();
    console.log(`[BOLTHAVEN] [Setup Phase] Setting up Image #${job.original_position || 1} (Job ${job.job_id})...`);

    // Detect Temporary Chat mode — image generation is blocked by ChatGPT in temporary chat!
    if (window.location.search.includes('temporary-chat') || window.location.href.includes('temporary-chat')) {
      console.warn('[BOLTHAVEN] ⚠️ Temporary Chat detected! Redirecting to standard chat...');
      window.location.href = 'https://chatgpt.com/';
      await new Promise((r) => setTimeout(r, 2000));
      throw new Error('Tab was in Temporary Chat mode. Redirected to standard chat — retrying.');
    }

    let input = await waitForElement('#prompt-textarea, div[contenteditable="true"], .ProseMirror, textarea', 25000);
    if (!input) {
      throw new Error('Could not locate ChatGPT prompt input textarea');
    }

    if (activeJobAborted) {
      clearPromptText(input);
      throw new Error('Job stopped by user');
    }

    // Snapshot pre-existing images currently in chat history (include query-stripped CDN URLs)
    const preExistingImageUrls = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (src) {
        preExistingImageUrls.add(src);
        try {
          const clean = src.split('?')[0];
          if (clean) preExistingImageUrls.add(clean);
        } catch (_) {}
      }
    });

    // 0. CLEAN INPUT AT FIRST TIME: Clean out any leftover attachments and residual text from previous runs once
    console.log(`[BOLTHAVEN] Step 0: Cleaning chat input at first time for Image #${job.original_position || 1}...`);
    await cleanComposerInputCompletely(input);
    await new Promise((r) => setTimeout(r, 400));

    // 1. Fetch and attach strictly single image
    const localPath = job.source_file_path || '';
    const remoteUrl = job.source_file_url || '';
    let primaryUrl = job.image_data_url || '';
    let fallbackUrl = '';

    if (!primaryUrl) {
      if (localPath && localPath.startsWith('/storage/')) {
        primaryUrl = `http://localhost:8085${localPath}`;
        fallbackUrl = remoteUrl;
      } else if (remoteUrl) {
        primaryUrl = remoteUrl;
        fallbackUrl = localPath ? `http://localhost:8085${localPath}` : '';
      } else {
        primaryUrl = localPath;
      }
    }

    const filename = `property_image_${job.original_position || 1}.jpg`;
    console.log(`[BOLTHAVEN] Fetching image for attachment: ${primaryUrl ? primaryUrl.slice(0, 40) : fallbackUrl}`);
    const blob = await fetchImageBlob(primaryUrl, fallbackUrl);
    const mimeType = blob.type || 'image/jpeg';
    const file = new File([blob], filename, { type: mimeType });

    console.log(`[BOLTHAVEN] Attaching single image #${job.original_position || 1}...`);
    let attachOk = await attachImageFileToComposer(input, file, 1, 1, job.image_data_url || (primaryUrl.startsWith('data:') ? primaryUrl : null));

    // Wait for the image upload to fully complete BEFORE typing the prompt (up to 15s)
    const composerEl = getComposerContainer(input) || document;
    await waitForAttachmentUploadComplete(composerEl, 15000);

    // Verify image is attached; if not, retry once
    let curAttached = getAttachedImagesCount(input);
    if (curAttached === 0) {
      console.warn(`[BOLTHAVEN] ⚠️ Image #${job.original_position || 1} not detected after first pass. Retrying attachment...`);
      attachOk = await attachImageFileToComposer(input, file, 1, 1, job.image_data_url || (primaryUrl.startsWith('data:') ? primaryUrl : null));
      await waitForAttachmentUploadComplete(composerEl, 15000);
      curAttached = getAttachedImagesCount(input);
    }

    if (curAttached === 0) {
      throw new Error(`Failed to attach image #${job.original_position || 1} to ChatGPT composer. Aborting to prevent sending prompt without photo.`);
    }

    // Verify strictly 1 image is attached before pasting prompt
    if (curAttached > 1) {
      console.warn(`[BOLTHAVEN] ⚠️ Multiple images (${curAttached}) detected in composer! Re-cleaning and attaching only image #${job.original_position || 1}...`);
      await cleanComposerInputCompletely(input);
      await new Promise((r) => setTimeout(r, 400));
      await attachImageFileToComposer(input, file, 1, 1, job.image_data_url || (primaryUrl.startsWith('data:') ? primaryUrl : null));
      await waitForAttachmentUploadComplete(composerEl, 15000);
    }

    console.log(`[BOLTHAVEN] ✓ Step 1 Done: Single image #${job.original_position || 1} attached and verified!`);

    if (activeJobAborted) {
      clearPromptText(input);
      throw new Error('Job stopped by user');
    }

    // 3. Paste prompt text cleanly and verify insertion (MUST INCLUDE PROMPT EVERY TIME)
    const promptText = (job.resolved_prompt || 'Enhance the attached architectural photo').trim();
    console.log(`[BOLTHAVEN] Setting prompt text (${promptText.length} chars)...`);

    const liveInput = findPromptInput() || input;
    await setPromptTextAsync(liveInput, promptText, 5000);
    await new Promise((r) => setTimeout(r, 300));

    // Mandatory prompt verification: verify prompt text is genuinely present in composer!
    let composerText = getComposerText(liveInput);
    if (!composerText || composerText.length < 10) {
      console.warn(`[BOLTHAVEN] ⚠️ Prompt text not detected in composer (${composerText ? composerText.length : 0} chars). Retrying via MAIN world injection...`);
      try {
        await new Promise((res) => {
          chrome.runtime.sendMessage({ action: 'INSERT_PROMPT_MAIN_WORLD', text: promptText }, () => {
            if (chrome.runtime.lastError) {}
            res();
          });
        });
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 1000));
      composerText = getComposerText(liveInput);
    }

    if (!composerText || composerText.length < 10) {
      throw new Error(`CRITICAL: Prompt text was not pasted into ChatGPT composer (${composerText ? composerText.length : 0} chars). Aborting send to guarantee prompt is always included.`);
    }
    console.log(`[BOLTHAVEN] ✓ Prompt verified inserted into ChatGPT (${composerText.length} chars)`);

    // Record pre-existing assistant turn count before sending (strictly exclude user turns)
    const preAssistantCount = Array.from(document.querySelectorAll(
      'div[data-message-author-role="assistant"], article[data-testid*="conversation-turn"], article'
    )).filter((turn) => {
      if (turn.getAttribute('data-message-author-role') === 'user') return false;
      if (turn.querySelector('[data-message-author-role="user"]')) return false;
      const c = (turn.className || '').toLowerCase();
      return !c.includes('user-turn') && !c.includes('user-message');
    }).length;

    // 4. Click Send button and wait for generation
    console.log(`[BOLTHAVEN] Sending prompt + single image #${job.original_position || 1} to ChatGPT...`);
    const sendSuccess = await triggerSendRobustly(liveInput);
    console.log(`[BOLTHAVEN] Send triggered (status: ${sendSuccess}). Launching watcher...`);

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

    // Set the prompt text (async version waits for MAIN world injection to settle)
    await setPromptTextAsync(input, promptText || 'Analyze property details and formulate facebook ad prompt', 4000);
    await new Promise((r) => setTimeout(r, 400));

    if (activeJobAborted) throw new Error('Stage 1 aborted by user');

    // Wait for send button and click send
    let sendBtn = findSendButton();
    let attempts = 0;
    while ((!sendBtn || sendBtn.disabled || isAudioOrSpeechButton(sendBtn)) && attempts < 25) {
      if (activeJobAborted) throw new Error('Stage 1 aborted by user');
      await new Promise((r) => setTimeout(r, 300));
      sendBtn = findSendButton();
      attempts++;
    }

    if (!sendBtn || isAudioOrSpeechButton(sendBtn)) throw new Error('Send button could not be activated in Tab 1');
    await clickSendButton(sendBtn);
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

        // ── Auto-skip "Which image do you like more?" comparison prompt ──
        autoSkipComparisonPrompt();

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
  // 1. Thoroughly resets composer: empties prompt text, chips, and residual attachments
  // 2. Pastes manual reference design image FIRST (1 image)
  // 3. Pastes condo images 1, 2, 3 SECOND (STRICTLY at most 3 images, total strictly 4 images!)
  // 4. Pastes selected hero prompt cleanly below the attachments
  // 5. Waits for upload rings to complete & clicks Send
  // 6. Responds immediately to background script to avoid message port timeouts
  // 7. Monitors ChatGPT in background for finished Hero image & triggers download
  let activeHeroJobId = null;

  async function executeStage2Staging({ heroJobId, extractedPrompt, referenceImage, condoImages, enhancedImages, condoName }) {
    if (activeHeroJobId && activeHeroJobId === heroJobId) {
      console.log('[BOLTHAVEN] Hero staging already in progress for job:', heroJobId);
      return { success: true, heroJobId, status: 'already_running' };
    }
    activeHeroJobId = heroJobId || `hero_${Date.now()}`;
    activeJobAborted = false;
    console.log('[BOLTHAVEN] Stage 2: Starting Hero staging (Job:', activeHeroJobId, ')...');

    const input = await waitForElement('#prompt-textarea, div[contenteditable="true"], .ProseMirror, textarea', 25000);
    if (!input) throw new Error('Could not locate ChatGPT prompt input textarea');

    // Snapshot existing images on page BEFORE sending so we only detect the newly generated Hero image
    const preExistingImageUrls = new Set(
      Array.from(document.querySelectorAll('img'))
        .map((img) => img.src || img.getAttribute('src') || '')
        .filter(Boolean)
    );

    // 0. RESET COMPOSER: Completely purge any residual text, chips, and leftover attachments
    console.log('[BOLTHAVEN] Resetting composer: thoroughly purging any leftover text, chips, and attachments...');
    await purgeComposerCleanly(input);
    await pruneExcessAttachments(input, 0);
    await new Promise((r) => setTimeout(r, 400));

    // Verify composer is clean
    if (getAttachedImagesCount(input) > 0) {
      await pruneExcessAttachments(input, 0);
    }
    clearPromptInputCleanly(input);
    await new Promise((r) => setTimeout(r, 200));

    // Prepare files in the exact sequence requested:
    // 1st: Reference design image (0_reference_design.png)
    // 2nd, 3rd, 4th: Condo building photos 1, 2, 3 (strictly at most 3, total strictly at most 4!)
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
      console.log(`[BOLTHAVEN] Stage 2: Preparing ${condoImages.length} condo building images (2nd)...`);
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

    if (Array.isArray(enhancedImages) && enhancedImages.length > 0) {
      console.log(`[BOLTHAVEN] Stage 2: Preparing ${enhancedImages.length} enhanced/interior images (3rd)...`);
      for (let i = 0; i < enhancedImages.length; i++) {
        const img = enhancedImages[i];
        const imgUrl = img.data_url || img.url || img.full_path;
        if (!imgUrl) continue;
        try {
          const blob = await fetchImageBlob(imgUrl, '');
          const mimeType = blob.type || 'image/png';
          const fname = img.filename || `interior_photo_${img.index || (i + 1)}.png`;
          filesToAttach.push(new File([blob], fname, { type: mimeType }));
        } catch (e) {
          console.warn(`[BOLTHAVEN] Failed to prepare enhanced image #${i + 1}:`, e);
        }
      }
    }

    const targetTotalImages = filesToAttach.length;
    console.log(`[BOLTHAVEN] Stage 2: Target total images to attach: ${targetTotalImages} (${referenceImage ? '1 Ref + ' : ''}${condoImages?.length || 0} Folder + ${enhancedImages?.length || 0} Enhanced)`);

    let totalImagesPasted = 0;

    if (targetTotalImages > 0) {
      // Step A: Inject all 4 files into ChatGPT file input at once
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

      let targetInput = fileInputs.find((i) => (i.accept || '').includes('image')) ||
                        fileInputs[fileInputs.length - 1] ||
                        fileInputs[0];

      if (targetInput) {
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
        try {
          const reactPropsKey = Object.keys(targetInput).find((k) => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
          if (reactPropsKey && targetInput[reactPropsKey]?.onChange) {
            targetInput[reactPropsKey].onChange({ target: targetInput, currentTarget: targetInput });
          }
        } catch (e) {}

        targetInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        targetInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));

        // Wait up to 5s for the batch input attachments to register in composer
        await waitForImageAttached(input, 5000, targetTotalImages);
      }

      // If batch injection did not attach all images, attach sequentially with multi-method fallbacks
      if (getAttachedImagesCount(input) < targetTotalImages) {
        console.log(`[BOLTHAVEN] Batch attachment yielded ${getAttachedImagesCount(input)} of ${targetTotalImages}. Attaching sequentially with multi-method fallbacks...`);
        for (let i = 0; i < filesToAttach.length; i++) {
          if (activeJobAborted) throw new Error('Stage 2 aborted by user');
          if (getAttachedImagesCount(input) >= targetTotalImages) break;
          const file = filesToAttach[i];
          await attachImageFileToComposer(input, file, targetTotalImages, i + 1);
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      // If more than targetTotalImages (4) are in composer, strictly prune excess attachments down to targetTotalImages
      if (getAttachedImagesCount(input) > targetTotalImages) {
        console.log(`[BOLTHAVEN] Pruning excess attachments down to ${targetTotalImages}...`);
        await pruneExcessAttachments(input, targetTotalImages);
      }

      totalImagesPasted = getAttachedImagesCount(input);
    }

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // STRICT ATTACHMENT VERIFICATION:
    const confirmedCount = getAttachedImagesCount(input);
    if (targetTotalImages > 0 && confirmedCount === 0) {
      throw new Error(`Failed to attach images: expected ${targetTotalImages} images (1 Reference + 3 Condo Photos), but 0 were attached to ChatGPT. Aborting to prevent sending prompt without photos.`);
    }

    // 3. Clear prompt input first, then insert prompt text cleanly
    const liveInput = findPromptInput() || input;
    clearPromptInputCleanly(liveInput);
    await new Promise((r) => setTimeout(r, 200));

    const promptText = (extractedPrompt || 'Generate a hero real estate listing image based on condo unit context and reference styling. Maintain realistic architectural aesthetics, high dynamic range, and authentic materials.').trim();
    console.log(`[BOLTHAVEN] Stage 2: Setting prompt text (${promptText.length} chars)...`);
    await insertPromptCleanly(liveInput, promptText);
    await new Promise((r) => setTimeout(r, 400));

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // 4. Wait for attachment uploads to complete
    const composer = getComposerContainer(input) || document;
    await waitForAttachmentUploadComplete(composer, 20000);

    if (activeJobAborted) throw new Error('Stage 2 aborted by user');

    // 5. Submit prompt + 4 attached images using robust submit
    console.log(`[BOLTHAVEN] Stage 2: Submitting ${totalImagesPasted} images + prompt to ChatGPT...`);
    const sendSuccess = await triggerSendRobustly(liveInput);
    console.log(`[BOLTHAVEN] ✓ Stage 2: Send triggered (status: ${sendSuccess}). Launching background generation watcher...`);

    // Give ChatGPT 2s to accept input and begin streaming
    await new Promise((r) => setTimeout(r, 2000));

    // Snapshot all images on page now (includes uploaded/pasted images in user bubble)
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('src') || '';
      if (src) preExistingImageUrls.add(src);
    });

    // Launch background generation monitor (does NOT block sendMessage response!)
    watchHeroGenerationAndNotify({
      heroJobId: activeHeroJobId,
      preExistingImageUrls,
      totalImagesPasted,
      condoName,
    });

    // Return immediately to background script so message port never closes early!
    return {
      success: true,
      heroJobId: activeHeroJobId,
      imagesAttached: totalImagesPasted,
    };
  }

  // Monitor ChatGPT in background for finished Hero image & download it
  async function watchHeroGenerationAndNotify({ heroJobId, preExistingImageUrls, totalImagesPasted, condoName }) {
    console.log(`[BOLTHAVEN] Background monitoring started for Hero Image generation (Job: ${heroJobId})...`);
    const startTime = Date.now();
    const maxWaitMs = 360000; // 6 minutes max
    const MIN_HERO_WAIT_MS = 15000;
    let consecutiveCalmChecks = 0;
    const REQUIRED_CALM_CHECKS = 3;
    let streamRetryCount = 0;
    const MAX_STREAM_RETRIES = 3;
    let lastRetryClickTime = 0;

    const checkInterval = setInterval(async () => {
      if (activeJobAborted) {
        clearInterval(checkInterval);
        activeHeroJobId = null;
        safeSendMessage({
          action: 'HERO_GENERATION_FAILED',
          heroJobId,
          error: 'Hero image generation stopped by user',
        });
        return;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > maxWaitMs) {
        clearInterval(checkInterval);
        activeHeroJobId = null;
        safeSendMessage({
          action: 'HERO_GENERATION_FAILED',
          heroJobId,
          error: 'ChatGPT Hero image generation timed out (6 min)',
        });
        return;
      }

      const currentlyGenerating = isThinkingOrGenerating();

      // Auto-skip "Which image do you like more?" comparison prompt
      autoSkipComparisonPrompt();

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
            activeHeroJobId = null;
            safeSendMessage({
              action: 'HERO_GENERATION_FAILED',
              heroJobId,
              error: 'ChatGPT Hero generation failed after 3 stream retries',
            });
            return;
          }
        }
      }

      // 1. Locate newly generated Hero image (Multi-method escalation)
      let heroImg = findGeneratedHeroImage(preExistingImageUrls);

      if (!heroImg && elapsed > MIN_HERO_WAIT_MS + 10000) {
        const oaiImgs = Array.from(document.querySelectorAll('img')).filter((img) => {
          const src = img.src || img.getAttribute('src') || '';
          if (!src || preExistingImageUrls.has(src)) return false;
          if (img.closest('form, div[class*="composer"], nav, header, [data-message-author-role="user"]')) return false;
          const s = src.toLowerCase();
          return (s.includes('oaiusercontent.com') || s.includes('file-service') || s.startsWith('blob:')) && img.complete;
        });
        if (oaiImgs.length > 0) {
          heroImg = oaiImgs[oaiImgs.length - 1];
          console.log('[BOLTHAVEN] Hero Method B (oaiusercontent): detected image:', heroImg.src);
        }
      }

      if (!heroImg && elapsed > MIN_HERO_WAIT_MS + 20000) {
        const anyLargeImgs = Array.from(document.querySelectorAll('img')).filter((img) => {
          const src = img.src || img.getAttribute('src') || '';
          if (!src || preExistingImageUrls.has(src)) return false;
          if (img.closest('form, div[class*="composer"], nav, header, [data-message-author-role="user"]')) return false;
          const s = src.toLowerCase();
          if (s.includes('avatar') || s.includes('icon') || s.includes('logo') || s.includes('favicon')) return false;
          const rect = img.getBoundingClientRect();
          const hasSize = (rect.width >= 100 && rect.height >= 100) || (img.naturalWidth >= 100 && img.naturalHeight >= 100);
          return hasSize && img.complete;
        });
        if (anyLargeImgs.length > 0) {
          heroImg = anyLargeImgs[anyLargeImgs.length - 1];
          console.log('[BOLTHAVEN] Hero Method C (any large img): detected image:', heroImg.src);
        }
      }

      const generating = isThinkingOrGenerating();
      const isImageReady = heroImg && (heroImg.complete || (heroImg.naturalWidth && heroImg.naturalWidth >= 100) || (heroImg.width && heroImg.width >= 100));

      if (generating || !isImageReady || elapsed < MIN_HERO_WAIT_MS) {
        consecutiveCalmChecks = 0;
        return;
      }

      if (isImageReady) {
        consecutiveCalmChecks++;
        console.log(`[BOLTHAVEN] Hero image detected on screen (calm check ${consecutiveCalmChecks}/${REQUIRED_CALM_CHECKS})...`);
        if (consecutiveCalmChecks >= REQUIRED_CALM_CHECKS) {
          clearInterval(checkInterval);
          activeHeroJobId = null;
          const finalUrl = heroImg.src || heroImg.getAttribute('src') || '';
          console.log('[BOLTHAVEN] ✓ Hero Image generation complete! Downloading:', finalUrl);

          preExistingImageUrls.add(finalUrl);
          const safeCondoSlug = String(condoName || 'hero')
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 40) || 'hero';
          const fileName = `fb_hero_${safeCondoSlug}_${Date.now()}.png`;

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

          await downloadEnhancedImage(heroImg, finalUrl, fileName);
          await new Promise((r) => setTimeout(r, 1500));

          chrome.runtime.sendMessage({
            action: 'HERO_GENERATION_COMPLETE',
            heroJobId,
            result_url: finalUrl,
            filename: fileName,
            imagesAttached: totalImagesPasted,
          }).catch(() => {});
        }
      }
    }, 1000);
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

    if (request.action === 'RESET_TAB_CHAT' || request.action === 'RESET_COMPOSER') {
      (async () => {
        try {
          startNewChatSmoothly();
          await new Promise((r) => setTimeout(r, 400));
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
        heroJobId: request.heroJobId,
        extractedPrompt: request.extractedPrompt,
        referenceImage: request.referenceImage,
        condoImages: request.condoImages,
        enhancedImages: request.enhancedImages,
        condoName: request.condoName,
      })
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === 'INSPECT_CHATGPT') {
      (async () => {
        const pm = document.querySelector('.ProseMirror, #prompt-textarea');
        const debugSteps = [];
        if (pm && request.tryClick) {
          pm.focus();
          debugSteps.push('focused pm');
          const res = await setPromptTextAsync(pm, 'Hello test prompt from Bolthaven Automation', 3000);
          debugSteps.push(`setPromptTextAsync result: ${res}, composerText: "${getComposerText(pm).slice(0, 80)}"`);
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

        const pta = document.querySelector('#prompt-textarea');
        sendResponse({
          url: window.location.href,
          hasPm: Boolean(pm),
          pmHtml: pm ? pm.outerHTML.slice(0, 500) : null,
          debugSteps,
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
      })();
      return true;
    }

    // On-demand recovery: download enhanced image currently displayed in this tab
    if (request.action === 'DOWNLOAD_CURRENT_ENHANCED_IMAGE') {
      (async () => {
        try {
          const pos = request.position || 1;
          const cleanCode = (request.listingCode || '').trim();
          const fileName = request.filename || (cleanCode ? `${cleanCode}-${pos}.png` : `enhanced_${pos}_${Date.now()}.png`);
          console.log(`[BOLTHAVEN] 📥 Received on-demand recovery download request for Image #${pos} (${fileName})...`);

          let img = findLatestGeneratedImageInTab();
          if (!img) {
            for (let retry = 0; retry < 12; retry++) {
              await new Promise((r) => setTimeout(r, 500));
              img = findLatestGeneratedImageInTab();
              if (img) break;
            }
          }
          if (!img) {
            console.warn(`[BOLTHAVEN] No enhanced image element found in this tab for Image #${pos}`);
            return sendResponse({ success: false, error: 'No enhanced image element found on this tab' });
          }

          const finalUrl = img.src || img.getAttribute('src') || '';
          console.log(`[BOLTHAVEN] ✓ Located enhanced image element for #${pos}:`, finalUrl.slice(0, 80));

          // Memorize this thread URL immediately
          const threadUrl = window.location.href;
          if (threadUrl && (threadUrl.includes('chatgpt.com') || threadUrl.includes('chat.openai.com'))) {
            chrome.runtime.sendMessage({
              action: 'MEMORIZE_IMAGE_THREAD',
              position: pos,
              threadUrl,
              filename: fileName,
              listingCode: cleanCode,
            }, () => { if (chrome.runtime.lastError) {} });
          }

          // Trigger serialized multi-tier download
          const downloaded = await downloadEnhancedImage(img, finalUrl, fileName);
          sendResponse({ success: Boolean(downloaded), url: finalUrl, filename: fileName });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (request.action === 'PING_TAB') {
      sendResponse({ status: 'ready', url: window.location.href });
      return true;
    }
  };

  chrome.runtime.onMessage.addListener(window.__bolthaven_msg_listener);
})();
