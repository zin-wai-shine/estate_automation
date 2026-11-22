document.addEventListener('DOMContentLoaded', async () => {
  const profileSelect = document.getElementById('profile-select');
  const groupsContainer = document.getElementById('groups-container');
  const syncBtn = document.getElementById('sync-btn');
  const openWorkersBtn = document.getElementById('open-workers-btn');
  const beaconText = document.getElementById('beacon-text');
  const companionBeacon = document.getElementById('companion-beacon');
  const tabsSummary = document.getElementById('tabs-summary');

  const COMPANION_URL = 'http://127.0.0.1:9224';

  // 1. Detect current Chrome profile name or fallback
  const stored = await chrome.storage.local.get(['profileName', 'profileKey', 'bolthavenMemorizedTabsV2']);
  let profileKey = stored.profileKey || '';

  if (profileSelect && profileKey) {
    profileSelect.value = profileKey;
  }

  // Check Mac Companion Health
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

  // Fetch available profiles from companion to populate options
  fetch(`${COMPANION_URL}/profiles`)
    .then((r) => r.json())
    .then((data) => {
      if (data && data.status === 'success' && Array.isArray(data.profiles)) {
        profileSelect.innerHTML = '<option value="">Auto-Detect Profile</option>';
        data.profiles.forEach((p) => {
          const opt = document.createElement('option');
          opt.value = p.profile_key;
          opt.textContent = `${p.display_name} (${p.profile_key})`;
          if (p.profile_key === profileKey) {
            opt.selected = true;
          }
          profileSelect.appendChild(opt);
        });
      }
    })
    .catch(() => {});

  // Handle profile change
  if (profileSelect) {
    profileSelect.addEventListener('change', async () => {
      const selectedKey = profileSelect.value;
      const selectedText = profileSelect.options[profileSelect.selectedIndex]?.text || selectedKey;
      if (selectedKey) {
        await chrome.storage.local.set({
          profileKey: selectedKey,
          profileName: selectedText,
          userExplicit: true,
        });
      }
    });
  }

  // Render tab groups & memorized tabs
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
            <button class="focus-btn" data-tab-id="${t.id}" title="Focus tab in Chrome">
              <span>Focus</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
          `;

          // Focus button handler
          const focusBtn = row.querySelector('.focus-btn');
          if (focusBtn && t.id) {
            focusBtn.addEventListener('click', () => {
              chrome.runtime.sendMessage({ action: 'FOCUS_TAB', tabId: t.id });
            });
          }

          listEl.appendChild(row);
        });
      } else {
        listEl.innerHTML = '<div style="color: #64748B; font-size: 10px; font-style: italic;">No tabs assigned yet</div>';
      }

      groupsContainer.appendChild(section);
    });

    if (tabsSummary) {
      tabsSummary.textContent = `${totalTabs} Memorized Tabs`;
    }
  };

  // Request tab groups from background script
  chrome.runtime.sendMessage({ action: 'GET_GROUPS' }, (response) => {
    if (response && Array.isArray(response.groups)) {
      renderGroups(response.groups);
    }
  });

  // Sync button handler
  if (syncBtn) {
    const syncLabel = document.getElementById('sync-btn-label');
    syncBtn.addEventListener('click', () => {
      if (syncLabel) syncLabel.textContent = 'Syncing memory...';
      else syncBtn.textContent = 'Syncing memory...';

      chrome.runtime.sendMessage({ action: 'SYNC_NOW' }, (res) => {
        if (res && res.success) {
          if (syncLabel) syncLabel.textContent = 'Memory Synchronized';
          setTimeout(() => {
            if (syncLabel) syncLabel.textContent = 'Sync Memory to BoltHaven Workflow';
          }, 2000);
        } else {
          if (syncLabel) syncLabel.textContent = 'Sync Failed';
          setTimeout(() => {
            if (syncLabel) syncLabel.textContent = 'Sync Memory to BoltHaven Workflow';
          }, 2000);
        }
      });
    });
  }

  // Open & Focus Worker Tabs button
  if (openWorkersBtn) {
    const openLabel = document.getElementById('open-btn-label');
    openWorkersBtn.addEventListener('click', async () => {
      if (openLabel) openLabel.textContent = 'Focusing Tabs...';
      chrome.runtime.sendMessage({
        action: 'FOCUS_GROUP',
        payload: {
          groupName: 'Enhance IMG',
          workerCount: 4,
          reuseSessionTabs: true,
        },
      });
      setTimeout(() => {
        if (openLabel) openLabel.textContent = 'Focus Active Worker Tabs';
        chrome.runtime.sendMessage({ action: 'GET_GROUPS' }, (response) => {
          if (response && Array.isArray(response.groups)) {
            renderGroups(response.groups);
          }
        });
      }, 1000);
    });
  }
});
