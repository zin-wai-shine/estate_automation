(() => {
  if (window.__bolthavenSocialAutofillLoaded) return;
  window.__bolthavenSocialAutofillLoaded = true;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function detectPlatform() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('business.facebook.com') || host.includes('facebook.com')) return 'meta';
    if (host.includes('tiktok.com')) return 'tiktok';
    return 'unknown';
  }

  async function dataUrlToFile(dataUrl, filename) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const mime = blob.type || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const safeName = filename && /\.[a-z0-9]+$/i.test(filename) ? filename : `${filename || 'image'}.${ext}`;
    return new File([blob], safeName, { type: mime });
  }

  function showToast(message, type = 'info') {
    const existing = document.getElementById('bolthaven-autofill-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'bolthaven-autofill-toast';
    const bg = type === 'error' ? '#7F1D1D' : type === 'success' ? '#064E3B' : '#0F172A';
    const border = type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#3B82F6';
    toast.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:2147483647',
      `background:${bg}`,
      'color:#F8FAFC',
      `border:1px solid ${border}`,
      'border-radius:10px',
      'padding:10px 14px',
      'font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif',
      'font-size:12px',
      'font-weight:600',
      'box-shadow:0 10px 25px rgba(0,0,0,0.45)',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'max-width:320px',
      'pointer-events:none',
    ].join(';');

    toast.textContent = `BoltHaven: ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 4000);
  }

  function setNativeInputValue(input, value) {
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function hasInsertedText(editor, text) {
    const nonEmptyLines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (nonEmptyLines.length === 0) return true;
    const firstLine = nonEmptyLines[0].slice(0, 20);
    const lastLine = nonEmptyLines[nonEmptyLines.length - 1].slice(0, 20);
    const raw = (editor.innerText || editor.textContent || '');
    const expectedCompact = text.replace(/\s+/g, '').length;
    const actualCompact = raw.replace(/\s+/g, '').length;
    return (
      raw.includes(firstLine) &&
      raw.includes(lastLine) &&
      (expectedCompact === 0 || actualCompact >= Math.floor(expectedCompact * 0.85))
    );
  }

  async function insertTextIntoContentEditable(editor, text, replaceExisting = true) {
    if (!editor) return false;
    editor.focus();
    await sleep(40);

    const contentsRoot = editor.querySelector('[data-contents="true"]') || editor;
    const hasExisting = (editor.textContent || '').trim().length > 0;
    const sel = window.getSelection();
    const range = document.createRange();

    if (replaceExisting && hasExisting) {
      range.selectNodeContents(contentsRoot);
      sel.removeAllRanges();
      sel.addRange(range);
      await sleep(30);
    } else {
      const innerNode = editor.querySelector('[data-block="true"], p, span[data-lexical-text="true"]') || contentsRoot;
      range.selectNodeContents(innerNode);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    // Supported browser editing command (fires real beforeinput + input on Draft.js & Lexical)
    editor.focus();
    document.execCommand('insertText', false, text);
    await sleep(150);
    if (hasInsertedText(editor, text)) {
      return true;
    }

    // Direct DOM fallback ONLY on plain contenteditable (never Draft.js / Lexical)
    const isDraftOrLexical =
      editor.hasAttribute('data-lexical-editor') ||
      editor.classList.contains('notranslate') ||
      Boolean(editor.querySelector('[data-contents="true"]'));
    if (!isDraftOrLexical) {
      editor.textContent = replaceExisting ? text : (editor.textContent || '') + text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      await sleep(60);
      return hasInsertedText(editor, text);
    }

    return hasInsertedText(editor, text);
  }

  function attachFilesToInput(fileInput, files) {
    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function dispatchDropFiles(target, files) {
    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }
    for (const type of ['dragenter', 'dragover', 'drop']) {
      target.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        })
      );
    }
  }

  function findMetaTextEditor() {
    const composerRoot =
      document.querySelector('[data-pagelet="BusinessComposerLayoutContainer"]') ||
      document.querySelector('[data-surface*="bizweb_create_post:left_panel"]') ||
      document;
    const surface = composerRoot.querySelector('[data-surface*="lib:bizweb_create_post:post_details"]') || composerRoot;
    const selectors = [
      'div.notranslate._5rpu[contenteditable="true"]',
      'div.notranslate[contenteditable="true"]',
      'div[data-lexical-editor="true"][contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
    ];
    const seen = new Set();
    const candidates = [];
    for (const sel of selectors) {
      for (const el of surface.querySelectorAll(sel)) {
        if (!seen.has(el)) {
          seen.add(el);
          candidates.push(el);
        }
      }
    }
    const isVisibleEditor = (el) => {
      if (!el || el.closest('[aria-hidden="true"]') || el.closest('[data-surface*="preview"]')) return false;
      if (el.getAttribute('role') === 'combobox') return false;
      if (el.tagName === 'GRAMMARLY-EXTENSION' || el.closest('grammarly-extension')) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 100 && rect.height >= 14;
    };
    return candidates.find(isVisibleEditor) || null;
  }

  // ── Meta Business Suite Autofill ───────────────────────────────────────────
  async function fillMetaBusiness(payload) {
    const { description = '', hashtags = [] } = payload;
    const images = payload.useStagedImages && Array.isArray(window.__bolthavenStagedImages)
      ? window.__bolthavenStagedImages
      : (payload.images || []);
    const fullText = [
      description.trim(),
      hashtags.length > 0 ? hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ') : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // 1. Attach Media FIRST (Meta may rerender the composer after media attaches)
    let attachedCount = 0;
    if (images.length > 0) {
      const files = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.dataUrl) {
          files.push(await dataUrlToFile(img.dataUrl, img.name || `photo_${i + 1}.jpg`));
        }
      }

      if (files.length > 0) {
        const mediaSurface = document.querySelector('[data-surface*="lib:bizweb_create_post:media"]');
        const findMetaMediaInput = () => {
          if (mediaSurface) {
            const surfaceInput = mediaSurface.querySelector('input[type="file"]');
            if (surfaceInput) return surfaceInput;
          }
          const allInputs = Array.from(document.querySelectorAll('input[type="file"]'));
          const multiMedia = allInputs.find((el) => {
            const acc = (el.getAttribute('accept') || '').toLowerCase();
            return el.multiple && acc.includes('image') && acc.includes('video');
          });
          if (multiMedia) return multiMedia;

          const menuInput = document.querySelector('[role="menu"] input[type="file"], [role="dialog"] input[type="file"]');
          if (menuInput) return menuInput;

          return allInputs.find((el) => el.multiple && (el.getAttribute('accept') || '').includes('image')) || null;
        };

        let mediaInput = findMetaMediaInput();

        if (!mediaInput) {
          const searchRoot = mediaSurface || document;
          const addBtn = Array.from(searchRoot.querySelectorAll('div[role="button"], button, span')).find((el) =>
            /^add photo\/video$|^add photos$/i.test((el.textContent || '').trim())
          ) || Array.from(searchRoot.querySelectorAll('div[role="button"], button, span')).find((el) =>
            /add photo\/video|add photos/i.test(el.textContent || '')
          );
          if (addBtn) {
            const btnTarget = addBtn.closest('[role="button"], button') || addBtn;
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evt) => {
              btnTarget.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
            });
            await sleep(500);
            mediaInput = findMetaMediaInput() || Array.from(document.querySelectorAll('input[type="file"]')).find((el) =>
              (el.getAttribute('accept') || '').includes('image')
            ) || null;
          }
        }

        if (mediaInput) {
          attachFilesToInput(mediaInput, files);
          attachedCount = files.length;
        } else {
          const dropTarget =
            mediaSurface ||
            document.querySelector('[data-surface*="bizweb_create_post:left_panel"]') ||
            document.querySelector('[role="main"]') ||
            document.body;
          if (dropTarget) {
            const beforeImgs = dropTarget.querySelectorAll('img, video').length;
            dispatchDropFiles(dropTarget, files);
            await sleep(500);
            const afterImgs = dropTarget.querySelectorAll('img, video').length;
            if (afterImgs > beforeImgs) {
              attachedCount = files.length;
            }
          }
        }
        // Wait for Meta composer to finish rerendering after media upload
        await sleep(500);
      }
    }

    // 2. Re-detect the Text editor AFTER media attachment so the reference is fresh
    let textFilled = false;
    if (fullText) {
      const textEditor = findMetaTextEditor();

      if (textEditor) {
        textFilled = await insertTextIntoContentEditable(textEditor, fullText, true);
      } else {
        const postDetailsSurface = document.querySelector('[data-surface*="lib:bizweb_create_post:post_details"]') || document;
        const textarea = postDetailsSurface.querySelector('textarea');
        if (textarea) {
          setNativeInputValue(textarea, fullText);
          textFilled = (textarea.value || '').includes(fullText.trim().split('\n')[0].trim().slice(0, 12));
        }
      }
    }

    if (!attachedCount && !textFilled) {
      showToast('Could not fill Meta fields — please refresh page & try again', 'error');
      return { success: false, error: 'Could not fill Meta Create Post fields on this page.' };
    }

    const parts = [];
    if (attachedCount > 0) parts.push(`${attachedCount} photo${attachedCount === 1 ? '' : 's'}`);
    if (textFilled) parts.push('caption');
    showToast(`Filled Meta Post (${parts.join(' + ')})`, textFilled ? 'success' : 'info');
    return { success: true, platform: 'meta', attachedCount, textFilled };
  }

  // ── TikTok Studio Autofill (2-Step + Hashtag Tokenization) ─────────────────
  async function waitForSelector(finderFn, timeoutMs = 35000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = finderFn();
      if (found) return found;
      await sleep(400);
    }
    return null;
  }

  function findTikTokDetailsInputs() {
    const titleInput =
      document.querySelector('input[placeholder*="title" i]') ||
      document.querySelector('textarea[placeholder*="title" i]');

    const editors = Array.from(document.querySelectorAll('[contenteditable="true"]')).filter((el) => {
      if (titleInput && (el === titleInput || el.contains(titleInput) || titleInput.contains(el))) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 120 && rect.height >= 16;
    });

    const descEditor =
      editors.find((el) => {
        const containerText = (el.closest('div[class*="editor" i], div[class*="caption" i], div[class*="desc" i]')?.textContent || el.parentElement?.textContent || '').toLowerCase();
        const aria = (el.getAttribute('aria-label') || el.getAttribute('data-placeholder') || '').toLowerCase();
        return containerText.includes('writing a long description') || aria.includes('description') || containerText.includes('hashtags');
      }) ||
      editors.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      })[0] ||
      null;

    if (titleInput || descEditor) {
      return { titleInput, descEditor };
    }
    return null;
  }

  async function typeTikTokDescriptionWithHashtags(editor, description, hashtags = []) {
    editor.click();
    editor.focus();
    await sleep(80);
    // Clear existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false);
    await sleep(80);

    const combinedText = [
      description.trim(),
      hashtags.length > 0 ? hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ') : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!combinedText) return;

    const insertChunk = (text) => {
      const beforeLen = (editor.innerText || editor.textContent || '').length;
      try {
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const pasteEvt = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        });
        editor.dispatchEvent(pasteEvt);
      } catch {}
      const afterPasteLen = (editor.innerText || editor.textContent || '').length;
      if (afterPasteLen <= beforeLen) {
        document.execCommand('insertText', false, text);
        try {
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
        } catch {}
      }
    };

    // Split into plain text and #hashtag tokens (supports Latin, digits, underscores, Thai)
    const tokenRegex = /(#[A-Za-z0-9_\u0E00-\u0E7F]+)/g;
    const parts = combinedText.split(tokenRegex);
    let insertedHashtag = false;

    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('#') && part.length > 1) {
        insertedHashtag = true;
        // Type # + tag via execCommand so TikTok opens its hashtag autocomplete dropdown
        document.execCommand('insertText', false, part);
        try {
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: part, inputType: 'insertText' }));
        } catch {}

        // Poll briefly for TikTok's hashtag suggestion popover and select the top match
        let suggestion = null;
        const popStart = Date.now();
        while (Date.now() - popStart < 850) {
          suggestion = document.querySelector(
            '[class*="hashtag" i] [role="option"], [class*="mention" i] [role="option"], [role="listbox"] [role="option"], div[class*="TagList" i] > div:first-child'
          );
          if (suggestion) break;
          await sleep(100);
        }

        if (suggestion) {
          suggestion.click();
          await sleep(140);
        } else {
          editor.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }));
          document.execCommand('insertText', false, ' ');
          await sleep(80);
        }
      } else {
        insertChunk(part);
        await sleep(40);
      }
    }

    // If no hashtags were present, add a trailing # at the end so TikTok's hashtag picker is ready
    const currentText = (editor.innerText || editor.textContent || '').trimEnd();
    if (!insertedHashtag && !currentText.endsWith('#')) {
      insertChunk('\n');
      await sleep(80);
      const hashtagBtn = Array.from(document.querySelectorAll('button, div[role="button"], span')).find(
        (el) => /^#\s*hashtags$/i.test((el.textContent || '').trim())
      );
      if (hashtagBtn) {
        hashtagBtn.click();
        await sleep(100);
      } else {
        insertChunk('#');
        await sleep(80);
      }
    }
  }

  async function fillTikTokStudio(payload) {
    const { title = '', description = '', hashtags = [] } = payload;
    const images = payload.useStagedImages && Array.isArray(window.__bolthavenStagedImages)
      ? window.__bolthavenStagedImages
      : (payload.images || []);

    let details = findTikTokDetailsInputs();
    const hadDetailsAlready = Boolean(details);
    let attachedCount = 0;

    const findPhotoFileInput = () => {
      const allInputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const isVideoOnly = (el) => {
        const acc = (el.getAttribute('accept') || '').toLowerCase();
        return acc.includes('video') && !/image|jpg|jpeg|png|webp/.test(acc);
      };
      const isImageInput = (el) => {
        const acc = (el.getAttribute('accept') || '').toLowerCase();
        return /image|jpg|jpeg|png|webp/.test(acc);
      };
      const hasVisibleContainer = (el) => {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const st = getComputedStyle(p);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          p = p.parentElement;
        }
        return true;
      };
      const nonVideoInputs = allInputs.filter((el) => !isVideoOnly(el));
      return (
        nonVideoInputs.find((el) => isImageInput(el) && hasVisibleContainer(el)) ||
        nonVideoInputs.find((el) => isImageInput(el)) ||
        nonVideoInputs.find((el) => hasVisibleContainer(el)) ||
        nonVideoInputs[0] ||
        null
      );
    };

    const buildImageFiles = async () => {
      const files = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.dataUrl) {
          files.push(await dataUrlToFile(img.dataUrl, img.name || `tiktok_${i + 1}.jpg`));
        }
      }
      return files;
    };

    // Step 1A: On the initial upload screen (before Details opens)
    if (!details && images.length > 0) {
      const tabs = Array.from(document.querySelectorAll('button, div[role="tab"], span'));
      const photosTab = tabs.find((el) => (el.textContent || '').trim() === 'Photos');
      if (photosTab) {
        photosTab.click();
        await sleep(450);
      }

      const files = await buildImageFiles();
      if (files.length > 0) {
        const fileInput = findPhotoFileInput();
        const findInnermostDropZone = () => {
          const matches = Array.from(document.querySelectorAll('div')).filter((el) => {
            if (!/select photos to upload|drag and drop them here/i.test(el.textContent || '')) return false;
            const r = el.getBoundingClientRect();
            return r.width > 120 && r.height > 80;
          });
          matches.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            return ra.width * ra.height - rb.width * rb.height;
          });
          return matches[0] || null;
        };

        const dropZone = findInnermostDropZone();

        if (fileInput) {
          attachFilesToInput(fileInput, files);
          attachedCount = files.length;
          await sleep(1200);
          if (!findTikTokDetailsInputs() && dropZone && document.contains(dropZone) && dropZone.getBoundingClientRect().height > 80) {
            dispatchDropFiles(dropZone, files);
          }
        } else if (dropZone) {
          dispatchDropFiles(dropZone, files);
          attachedCount = files.length;
        }

        if (attachedCount > 0) {
          showToast(`Uploaded ${attachedCount} photo(s) — waiting for Details screen...`, 'info');
          details = await waitForSelector(findTikTokDetailsInputs, 35000);
        }
      }
    } else if (details && images.length > 0) {
      // Step 1B: Already on /upload/post/photo — append this batch of photos via the + uploader input
      const files = await buildImageFiles();
      if (files.length > 0) {
        const fileInput = findPhotoFileInput();
        if (fileInput) {
          attachFilesToInput(fileInput, files);
          attachedCount = files.length;
          showToast(`Added ${attachedCount} more photo(s) to TikTok post`, 'info');
          await sleep(500);
        }
      }
    }

    if (!details) {
      details = findTikTokDetailsInputs();
    }

    if (!details) {
      showToast('Could not detect TikTok Details screen', 'error');
      return {
        success: attachedCount > 0,
        platform: 'tiktok',
        attachedCount,
        error: 'Timed out waiting for TikTok Details form.',
      };
    }

    // Step 2: Fill Title (0/90); Description & #Hashtags are filled via CDP Input.insertText in background.js.
    // On subsequent batch clicks (Details already open and Title+Description already filled), keep existing text.
    const existingTitle = (details.titleInput?.value || '').trim();
    const existingDesc = (details.descEditor?.innerText || details.descEditor?.textContent || '').trim();
    const skipTextFill = hadDetailsAlready && attachedCount > 0 && existingTitle.length > 0 && existingDesc.length > 20;

    if (!skipTextFill) {
      await sleep(400);
      if (details.titleInput && title) {
        setNativeInputValue(details.titleInput, title.slice(0, 90));
      }
    }

    showToast(
      skipTextFill
        ? `Added ${attachedCount} photo(s) (kept existing text)`
        : `TikTok filled (${attachedCount} photos + title)`,
      'success'
    );
    return { success: true, platform: 'tiktok', attachedCount, textFilled: !skipTextFill, skipTextFill };
  }

  // ── Pull / Input from Current Site ─────────────────────────────────────────
  function pullFromCurrentSite() {
    const platform = detectPlatform();
    let title = '';
    let description = '';

    if (platform === 'tiktok') {
      const titleInput =
        document.querySelector('input[placeholder*="title" i]') ||
        document.querySelector('textarea[placeholder*="title" i]');
      title = titleInput ? titleInput.value || '' : '';
      const editors = Array.from(document.querySelectorAll('[contenteditable="true"]'));
      const descEditor = editors.find((el) => el.getBoundingClientRect().width > 150);
      description = descEditor ? (descEditor.innerText || descEditor.textContent || '').trim() : '';
    } else if (platform === 'meta') {
      const editors = Array.from(document.querySelectorAll('[contenteditable="true"][role="textbox"], div[contenteditable="true"]'));
      const textEditor = editors.find((el) => el.getBoundingClientRect().width > 120);
      description = textEditor ? (textEditor.innerText || textEditor.textContent || '').trim() : '';
    } else {
      const active = document.activeElement;
      if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
        description = active.value || '';
      } else {
        description = (window.getSelection()?.toString() || '').trim();
      }
    }

    const hashtagMatches = description.match(/#[A-Za-z0-9_\u0E00-\u0E7F]+/g) || [];
    return {
      success: true,
      platform,
      title,
      description,
      hashtags: Array.from(new Set(hashtagMatches)),
      pageTitle: document.title,
      pageUrl: window.location.href,
    };
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'BOLTHAVEN_CLEAR_STAGED_IMAGES') {
      window.__bolthavenStagedImages = [];
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'BOLTHAVEN_STAGE_IMAGE') {
      if (!Array.isArray(window.__bolthavenStagedImages)) {
        window.__bolthavenStagedImages = [];
      }
      window.__bolthavenStagedImages.push({
        index: request.index,
        name: request.name,
        dataUrl: request.dataUrl,
      });
      sendResponse({ success: true, count: window.__bolthavenStagedImages.length });
      return true;
    }

    if (request.action === 'BOLTHAVEN_SOCIAL_FILL') {
      const platform = request.payload?.platform && request.payload.platform !== 'auto'
        ? request.payload.platform
        : detectPlatform();

      const runner = platform === 'tiktok' ? fillTikTokStudio : fillMetaBusiness;
      runner(request.payload || {})
        .then((res) => sendResponse(res))
        .catch((err) => {
          showToast(err.message || 'Autofill failed', 'error');
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (request.action === 'BOLTHAVEN_PULL_FROM_SITE') {
      sendResponse(pullFromCurrentSite());
      return true;
    }
  });
})();
