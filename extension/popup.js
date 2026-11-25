document.addEventListener('DOMContentLoaded', async () => {
  const COMPANION_URL = 'http://127.0.0.1:9224';

  // Nav tabs
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanels = document.querySelectorAll('.tab-panel');
  navTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      navTabs.forEach((b) => b.classList.toggle('active', b === btn));
      tabPanels.forEach((p) => p.classList.toggle('active', p.id === `tab-${target}`));
    });
  });

  // Elements
  const profileSelect = document.getElementById('profile-select');
  const boxSelect = document.getElementById('box-select');
  const beaconText = document.getElementById('beacon-text');
  const companionBeacon = document.getElementById('companion-beacon');

  const syncDispatchBtn = document.getElementById('sync-dispatch-btn');
  const syncDispatchLabel = document.getElementById('sync-dispatch-label');
  const pullSiteBtn = document.getElementById('pull-site-btn');
  const pullSiteLabel = document.getElementById('pull-site-label');

  const queueSelectWrap = document.getElementById('queue-select-wrap');
  const queueSelect = document.getElementById('queue-select');
  const platformBadge = document.getElementById('platform-badge');
  const imageGrid = document.getElementById('image-grid');
  const selectedImgCountEl = document.getElementById('selected-img-count');
  const totalImgCountEl = document.getElementById('total-img-count');
  const toggleAllImgsBtn = document.getElementById('toggle-all-imgs-btn');

  const tiktokBatchBar = document.getElementById('tiktok-batch-bar');
  const tiktokTitleWrap = document.getElementById('tiktok-title-wrap');
  const descLabelText = document.getElementById('desc-label-text');
  const batchSizeSelect = document.getElementById('batch-size-select');
  const batchProgressText = document.getElementById('batch-progress-text');
  const resetBatchBtn = document.getElementById('reset-batch-btn');

  const previewTitle = document.getElementById('preview-title');
  const previewDesc = document.getElementById('preview-desc');
  const titleCounter = document.getElementById('title-counter');
  const descCounter = document.getElementById('desc-counter');
  const fillBtn = document.getElementById('fill-btn');
  const fillBtnLabel = document.getElementById('fill-btn-label');

  // Worker tabs elements
  const groupsContainer = document.getElementById('groups-container');
  const syncBtn = document.getElementById('sync-btn');
  const openWorkersBtn = document.getElementById('open-workers-btn');
  const tabsSummary = document.getElementById('tabs-summary');

  // State
  let dispatchItems = [];
  let activeItem = null;
  let batchStart = 0;
  let selectedBoxId = '';

  // 1. Load saved profile, box assignment, and cached dispatch items
  const stored = await chrome.storage.local.get([
    'profileKey',
    'assignedBoxId',
    'bolthavenDispatchItems',
    'bolthavenBatchSize',
  ]);
  let profileKey = stored.profileKey || '';
  selectedBoxId = stored.assignedBoxId || '';
  if (batchSizeSelect && stored.bolthavenBatchSize) {
    batchSizeSelect.value = String(stored.bolthavenBatchSize);
  }
  if (Array.isArray(stored.bolthavenDispatchItems)) {
    dispatchItems = stored.bolthavenDispatchItems;
  }

  // Detect active tab platform for badge hint
  let detectedTabPlatform = 'auto';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = (tab?.url || '').toLowerCase();
    if (url.includes('business.facebook.com') || url.includes('facebook.com')) {
      detectedTabPlatform = 'meta';
    } else if (url.includes('tiktok.com')) {
      detectedTabPlatform = 'tiktok';
    }
  } catch (_) {}

  // 2. Check Companion Health
  fetch(`${COMPANION_URL}/status`)
    .then((r) => r.json())
    .then((data) => {
      if (data && data.status === 'online') {
        beaconText.textContent = 'Port :9224';
        companionBeacon.style.background = 'rgba(16, 185, 129, 0.08)';
        companionBeacon.style.color = '#10B981';
        companionBeacon.style.borderColor = 'rgba(16, 185, 129, 0.22)';
      }
    })
    .catch(() => {
      beaconText.textContent = 'Offline (:9224)';
      companionBeacon.style.background = 'rgba(239, 68, 68, 0.08)';
      companionBeacon.style.color = '#EF4444';
      companionBeacon.style.borderColor = 'rgba(239, 68, 68, 0.22)';
    });

  // 3. Populate Chrome Profiles
  fetch(`${COMPANION_URL}/profiles`)
    .then((r) => r.json())
    .then((data) => {
      if (data && data.status === 'success' && Array.isArray(data.profiles)) {
        profileSelect.innerHTML = '<option value="">Auto-Detect Profile</option>';
        data.profiles.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.profile_key;
          opt.textContent = `${p.display_name} (${p.profile_key})`;
          if (p.profile_key === profileKey) opt.selected = true;
          profileSelect.appendChild(opt);
        });
      }
    })
    .catch(() => {});

  profileSelect?.addEventListener('change', async () => {
    const selectedKey = profileSelect.value;
    const selectedText = profileSelect.options[profileSelect.selectedIndex]?.text || selectedKey;
    profileKey = selectedKey;
    await chrome.storage.local.set({
      profileKey: selectedKey,
      profileName: selectedText,
      userExplicit: true,
    });
    syncDispatchQueue();
  });

  boxSelect?.addEventListener('change', async () => {
    selectedBoxId = boxSelect.value;
    await chrome.storage.local.set({ assignedBoxId: selectedBoxId });
    const matching = selectedBoxId
      ? dispatchItems.filter((x) => (x.boxId || x.id) === selectedBoxId)
      : dispatchItems;
    activeItem = matching[0] || dispatchItems[0] || null;
    batchStart = activeItem?.nextBatchStart || 0;
    renderQueueSelector(matching);
  });

  batchSizeSelect?.addEventListener('change', async () => {
    await chrome.storage.local.set({ bolthavenBatchSize: Number(batchSizeSelect.value) || 5 });
    updateBatchSummary();
  });

  function updateCounters() {
    if (titleCounter) titleCounter.textContent = `${(previewTitle.value || '').length}/90`;
    if (descCounter) descCounter.textContent = `${(previewDesc.value || '').length} chars`;
  }
  previewTitle?.addEventListener('input', () => {
    if (activeItem) activeItem.title = previewTitle.value;
    updateCounters();
  });
  previewDesc?.addEventListener('input', () => {
    if (activeItem) activeItem.description = previewDesc.value;
    updateCounters();
  });

  function updatePlatformBadge(itemPlatform) {
    const p = (itemPlatform && itemPlatform !== 'auto') ? itemPlatform : detectedTabPlatform;
    platformBadge.className = 'platform-pill';
    if (p === 'meta') {
      platformBadge.classList.add('meta');
      platformBadge.textContent = 'Meta Business';
      if (tiktokTitleWrap) tiktokTitleWrap.style.display = 'none';
      if (tiktokBatchBar) tiktokBatchBar.style.display = 'none';
      if (descLabelText) descLabelText.textContent = 'Description';
    } else if (p === 'tiktok') {
      platformBadge.classList.add('tiktok');
      platformBadge.textContent = 'TikTok Studio';
      if (tiktokTitleWrap) tiktokTitleWrap.style.display = 'block';
      if (tiktokBatchBar) tiktokBatchBar.style.display = 'flex';
      if (descLabelText) descLabelText.textContent = 'Description & #Hashtags';
    } else {
      platformBadge.textContent = 'Auto Detect';
      if (tiktokTitleWrap) tiktokTitleWrap.style.display = 'block';
      if (tiktokBatchBar) tiktokBatchBar.style.display = 'flex';
      if (descLabelText) descLabelText.textContent = 'Description & #Hashtags';
    }
  }

  function updateBatchSummary() {
    if (!activeItem || !Array.isArray(activeItem.images)) {
      batchProgressText.textContent = 'Ready';
      return;
    }
    const selected = activeItem.images.filter((img) => img.selected !== false);
    const total = selected.length;
    selectedImgCountEl.textContent = String(total);
    totalImgCountEl.textContent = String(activeItem.images.length);

    if (total === 0) {
      batchProgressText.textContent = '0 selected';
      return;
    }

    const size = Number(batchSizeSelect.value) || 5;
    if (batchStart >= total) batchStart = 0;
    const end = Math.min(batchStart + size, total);
    const totalBatches = Math.ceil(total / size);
    const currentBatch = Math.floor(batchStart / size) + 1;
    batchProgressText.textContent = `Batch ${currentBatch}/${totalBatches} (#${batchStart + 1}–${end})`;
  }

  function renderActiveItem() {
    if (!activeItem) {
      imageGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No staged post for this profile/box yet. Click <strong>Sync Queue</strong> or <strong>Input from Site</strong>.</div>';
      selectedImgCountEl.textContent = '0';
      totalImgCountEl.textContent = '0';
      previewTitle.value = '';
      previewDesc.value = '';
      updatePlatformBadge('auto');
      updateCounters();
      updateBatchSummary();
      return;
    }

    updatePlatformBadge(activeItem.platform);
    previewTitle.value = activeItem.title || '';
    const tags = Array.isArray(activeItem.hashtags) && activeItem.hashtags.length > 0
      ? activeItem.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
      : '';
    const descVal = activeItem.description || '';
    previewDesc.value = tags && !descVal.includes(tags) ? `${descVal}\n\n${tags}`.trim() : descVal;
    updateCounters();

    const imgs = Array.isArray(activeItem.images) ? activeItem.images : [];
    if (imgs.length === 0) {
      imageGrid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">Text-only post (no photos attached).</div>';
    } else {
      imageGrid.innerHTML = '';
      imgs.forEach((img, idx) => {
        const tile = document.createElement('div');
        tile.className = `img-tile ${img.selected !== false ? 'selected' : ''}`;
        const src = img.dataUrl || img.url || '';
        tile.innerHTML = `
          <img src="${src}" alt="Photo ${idx + 1}" />
          <span class="img-idx">${idx + 1}</span>
          <span class="img-check">${img.selected !== false ? '✓' : ''}</span>
        `;
        tile.addEventListener('click', () => {
          img.selected = img.selected === false;
          batchStart = 0;
          renderActiveItem();
        });
        imageGrid.appendChild(tile);
      });
    }
    updateBatchSummary();
  }

  function populateBoxSelector() {
    if (!boxSelect) return;
    const seen = new Map();
    dispatchItems.forEach((item) => {
      const key = item.boxId || item.id;
      if (!key || seen.has(key)) return;
      const platTag = item.platform === 'meta' ? 'Meta' : item.platform === 'tiktok' ? 'TikTok' : 'Auto';
      const label = item.boxLabel && item.boxId
        ? `${item.boxId} · ${item.boxLabel} (${platTag})`
        : (item.boxLabel || key);
      seen.set(key, label);
    });

    boxSelect.innerHTML = '';
    if (seen.size === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No Boxes Synced Yet';
      boxSelect.appendChild(opt);
      return;
    }

    if (seen.size > 1) {
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = `All Boxes (${seen.size})`;
      boxSelect.appendChild(allOpt);
    }

    seen.forEach((label, key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = label;
      boxSelect.appendChild(opt);
    });

    // Auto-select saved boxId if present, or the only box if size === 1
    if (selectedBoxId && seen.has(selectedBoxId)) {
      boxSelect.value = selectedBoxId;
    } else if (seen.size === 1) {
      const onlyKey = Array.from(seen.keys())[0];
      selectedBoxId = onlyKey;
      boxSelect.value = onlyKey;
      chrome.storage.local.set({ assignedBoxId: onlyKey });
    } else {
      boxSelect.value = '';
    }
  }

  function renderQueueSelector(filteredList) {
    const list = Array.isArray(filteredList)
      ? filteredList
      : (selectedBoxId
          ? dispatchItems.filter((x) => (x.boxId || x.id) === selectedBoxId)
          : dispatchItems);

    if (list.length > 1) {
      queueSelectWrap.style.display = 'block';
      queueSelect.innerHTML = '';
      list.forEach((item, idx) => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = `${item.boxLabel || item.boxId || 'Post'} (${(item.images || []).length} photos)`;
        if (activeItem && activeItem.id === item.id) opt.selected = true;
        else if (!activeItem && idx === 0) opt.selected = true;
        queueSelect.appendChild(opt);
      });
    } else {
      queueSelectWrap.style.display = 'none';
    }

    if ((!activeItem || !list.some((x) => x.id === activeItem.id)) && list.length > 0) {
      activeItem = list[0];
      batchStart = activeItem.nextBatchStart || 0;
    } else if (list.length === 0) {
      activeItem = null;
    }
    renderActiveItem();
  }

  queueSelect?.addEventListener('change', () => {
    const found = dispatchItems.find((x) => x.id === queueSelect.value);
    if (found) {
      activeItem = found;
      batchStart = found.nextBatchStart || 0;
      renderActiveItem();
    }
  });

  toggleAllImgsBtn?.addEventListener('click', () => {
    if (!activeItem || !Array.isArray(activeItem.images) || activeItem.images.length === 0) return;
    const allSelected = activeItem.images.every((i) => i.selected !== false);
    activeItem.images.forEach((i) => { i.selected = !allSelected; });
    batchStart = 0;
    renderActiveItem();
  });

  resetBatchBtn?.addEventListener('click', () => {
    batchStart = 0;
    updateBatchSummary();
  });

  // Sync Queue from Mac Companion
  async function syncDispatchQueue() {
    if (syncDispatchLabel) syncDispatchLabel.textContent = 'Syncing...';
    chrome.runtime.sendMessage(
      {
        action: 'SYNC_DISPATCH',
        profileKey: profileSelect?.value || profileKey,
        boxId: selectedBoxId || '',
        all: true,
      },
      (res) => {
        if (res && res.success) {
          dispatchItems = res.items || [];
          populateBoxSelector();
          const matching = selectedBoxId
            ? dispatchItems.filter((x) => (x.boxId || x.id) === selectedBoxId)
            : dispatchItems;
          activeItem = matching[0] || dispatchItems[0] || null;
          batchStart = activeItem?.nextBatchStart || 0;
          renderQueueSelector(matching);
          if (syncDispatchLabel) syncDispatchLabel.textContent = `Synced (${dispatchItems.length})`;
        } else {
          if (syncDispatchLabel) syncDispatchLabel.textContent = 'Sync Failed';
        }
        setTimeout(() => {
          if (syncDispatchLabel) syncDispatchLabel.textContent = 'Sync Queue';
        }, 1800);
      }
    );
  }

  syncDispatchBtn?.addEventListener('click', syncDispatchQueue);

  // Pull / Input from Active Site
  pullSiteBtn?.addEventListener('click', () => {
    if (pullSiteLabel) pullSiteLabel.textContent = 'Reading...';
    chrome.runtime.sendMessage({ action: 'PULL_FROM_SITE' }, (res) => {
      if (res && res.success) {
        if (!activeItem) {
          activeItem = {
            id: `site_${Date.now()}`,
            boxLabel: 'Pulled from Site',
            platform: res.platform || 'auto',
            title: res.title || '',
            description: res.description || '',
            hashtags: res.hashtags || [],
            images: [],
          };
          dispatchItems = [activeItem];
        } else {
          if (res.title) activeItem.title = res.title;
          if (res.description) activeItem.description = res.description;
          if (res.hashtags?.length) activeItem.hashtags = res.hashtags;
        }
        renderQueueSelector();
        if (pullSiteLabel) pullSiteLabel.textContent = 'Loaded ✓';
      } else {
        if (pullSiteLabel) pullSiteLabel.textContent = 'Nothing Found';
      }
      setTimeout(() => {
        if (pullSiteLabel) pullSiteLabel.textContent = 'Input from Site';
      }, 1800);
    });
  });

  // Fill Active Page (Meta Business Suite or TikTok Studio)
  fillBtn?.addEventListener('click', () => {
    const effectivePlatform = detectedTabPlatform !== 'auto' ? detectedTabPlatform : (activeItem?.platform || 'auto');
    const titleVal = effectivePlatform === 'meta' ? '' : previewTitle.value.trim();
    const descVal = previewDesc.value.trim();
    const selectedImages = (activeItem?.images || []).filter((img) => img.selected !== false);
    const batchSize = Number(batchSizeSelect.value) || 5;

    let batchImages = [];
    if (selectedImages.length > 0) {
      if (effectivePlatform === 'meta') {
        // Meta Business Suite accepts all selected photos in one fill
        batchImages = selectedImages;
      } else {
        if (batchStart >= selectedImages.length) batchStart = 0;
        batchImages = selectedImages.slice(batchStart, batchStart + batchSize);
      }
    }

    if (!titleVal && !descVal && batchImages.length === 0) {
      fillBtnLabel.textContent = 'Nothing to Fill!';
      setTimeout(() => { fillBtnLabel.textContent = 'Fill Active Page'; }, 1800);
      return;
    }

    fillBtn.disabled = true;
    fillBtnLabel.textContent = batchImages.length > 0
      ? `Filling ${batchImages.length} photo(s) + text...`
      : 'Filling text...';

    chrome.runtime.sendMessage(
      {
        action: 'FILL_ACTIVE_TAB',
        payload: {
          platform: effectivePlatform,
          title: titleVal,
          description: descVal,
          hashtags: [],
          images: batchImages,
        },
      },
      (res) => {
        fillBtn.disabled = false;
        const lastErr = chrome.runtime.lastError?.message;
        if (res && res.success) {
          if (selectedImages.length > 0 && effectivePlatform !== 'meta') {
            batchStart += batchImages.length;
            if (batchStart >= selectedImages.length) {
              batchStart = 0;
              fillBtnLabel.textContent = 'All Batches Filled ✓';
            } else {
              fillBtnLabel.textContent = `Batch Filled ✓ (Next: #${batchStart + 1})`;
            }
            updateBatchSummary();
          } else {
            fillBtnLabel.textContent = 'Filled ✓';
          }
        } else {
          const errMsg = res?.error || lastErr || 'Fill Failed';
          fillBtnLabel.textContent = `Error: ${errMsg.slice(0, 24)}`;
        }
        setTimeout(() => {
          fillBtnLabel.textContent = 'Fill Active Page';
        }, 2500);
      }
    );
  });

  // Initial render & auto-sync on popup open
  populateBoxSelector();
  renderQueueSelector();
  syncDispatchQueue();

  // ══════════════════════════════════════════════════════════════════════════
  // TAB 2: WORKER TABS (Preserved Original Logic)
  // ══════════════════════════════════════════════════════════════════════════
  const renderGroups = (groups) => {
    if (!groups || groups.length === 0) {
      groupsContainer.innerHTML = '<div style="color: #64748B; font-size: 11px; padding: 12px 0; text-align: center;">No active or memorized tabs yet. Open ChatGPT tabs or run a workflow node.</div>';
      if (tabsSummary) tabsSummary.textContent = '0 Tabs';
      return;
    }

    let totalTabs = 0;
    groupsContainer.innerHTML = '';
    groups.forEach((g) => {
      const section = document.createElement('div');
      section.className = 'group-section';
      const tabCount = Array.isArray(g.tabs) ? g.tabs.length : (g.tabsCount || 0);
      totalTabs += tabCount;
      const isHero = (g.title || '').toLowerCase().includes('hero');
      const badgeText = isHero ? `${tabCount} Hero Worker` : `${tabCount} Worker Tabs`;

      section.innerHTML = `
        <div class="group-section-title">
          <span>${g.title}</span>
          <span class="group-badge">${badgeText}</span>
        </div>
        <div class="group-tabs-list"></div>
      `;

      const listEl = section.querySelector('.group-tabs-list');
      if (Array.isArray(g.tabs) && g.tabs.length > 0) {
        g.tabs.forEach((t, idx) => {
          const row = document.createElement('div');
          row.className = 'tab-item';
          const cleanUrl = t.url ? t.url.replace('https://', '') : 'chatgpt.com';
          const truncatedUrl = cleanUrl.length > 32 ? cleanUrl.substring(0, 32) + '...' : cleanUrl;
          const cleanTitle = t.title || `ChatGPT Tab #${idx + 1}`;
          row.innerHTML = `
            <div class="tab-left">
              <span class="tab-idx">${String(idx + 1).padStart(2, '0')}</span>
              <div class="tab-info">
                <div class="tab-title" title="${t.title || ''}">${cleanTitle}</div>
                <div class="tab-url" title="${t.url || ''}">${truncatedUrl}</div>
              </div>
            </div>
            <button class="focus-btn" data-tab-id="${t.id}" title="Focus tab in Chrome">Focus</button>
          `;
          row.querySelector('.focus-btn')?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'FOCUS_TAB', tabId: t.id });
          });
          listEl.appendChild(row);
        });
      } else {
        listEl.innerHTML = '<div style="color: #64748B; font-size: 10px; font-style: italic;">No tabs assigned yet</div>';
      }
      groupsContainer.appendChild(section);
    });

    if (tabsSummary) tabsSummary.textContent = `${totalTabs} Memorized Tabs`;
  };

  chrome.runtime.sendMessage({ action: 'GET_GROUPS' }, (response) => {
    if (response && Array.isArray(response.groups)) renderGroups(response.groups);
  });

  syncBtn?.addEventListener('click', () => {
    const syncLabel = document.getElementById('sync-btn-label');
    if (syncLabel) syncLabel.textContent = 'Syncing memory...';
    chrome.runtime.sendMessage({ action: 'SYNC_NOW' }, (res) => {
      if (syncLabel) syncLabel.textContent = res && res.success ? 'Memory Synchronized' : 'Sync Failed';
      setTimeout(() => {
        if (syncLabel) syncLabel.textContent = 'Sync Memory to BoltHaven Workflow';
      }, 2000);
    });
  });

  openWorkersBtn?.addEventListener('click', () => {
    const openLabel = document.getElementById('open-btn-label');
    if (openLabel) openLabel.textContent = 'Focusing Tabs...';
    chrome.runtime.sendMessage({
      action: 'FOCUS_GROUP',
      payload: { groupName: 'Enhance IMG', workerCount: 4, reuseSessionTabs: true },
    });
    setTimeout(() => {
      if (openLabel) openLabel.textContent = 'Focus Active Worker Tabs';
      chrome.runtime.sendMessage({ action: 'GET_GROUPS' }, (response) => {
        if (response && Array.isArray(response.groups)) renderGroups(response.groups);
      });
    }, 1000);
  });
});
