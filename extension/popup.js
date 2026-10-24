document.addEventListener('DOMContentLoaded', async () => {
  const profileNameEl = document.getElementById('profile-name');
  const groupsContainer = document.getElementById('groups-container');
  const syncBtn = document.getElementById('sync-btn');

  // Detect current Chrome profile name or fallback
  const stored = await chrome.storage.local.get(['profileName']);
  let profileName = stored.profileName || 'Active Chrome Profile';
  profileNameEl.textContent = profileName;

  // Request tab groups from background script
  chrome.runtime.sendMessage({ action: 'GET_GROUPS' }, (response) => {
    if (!response || !response.groups || response.groups.length === 0) {
      groupsContainer.innerHTML = '<div style="color: #64748b; font-size: 11px;">No active tab groups found. Open or create groups like "Raw", "FB Hero", or "Bolt-Tiktok".</div>';
      return;
    }

    groupsContainer.innerHTML = '';
    response.groups.forEach((g) => {
      const item = document.createElement('div');
      item.className = 'group-item';

      const colorMap = {
        grey: '#64748b',
        blue: '#3b82f6',
        red: '#ef4444',
        yellow: '#f59e0b',
        green: '#10b981',
        pink: '#ec4899',
        purple: '#8b5cf6',
        cyan: '#06b6d4',
        orange: '#f97316',
      };

      const dotColor = colorMap[g.color] || '#64748b';
      item.innerHTML = `
        <div class="group-tag">
          <span class="group-color" style="background-color: ${dotColor}"></span>
          <span>${g.title}</span>
        </div>
        <span style="color: #94a3b8; font-size: 11px;">${g.tabsCount} tabs</span>
      `;
      groupsContainer.appendChild(item);
    });
  });

  // Sync button handler
  syncBtn.addEventListener('click', () => {
    syncBtn.textContent = 'Syncing...';
    chrome.runtime.sendMessage({ action: 'SYNC_NOW' }, (res) => {
      if (res && res.success) {
        syncBtn.textContent = '✓ Synchronized';
        setTimeout(() => {
          syncBtn.textContent = 'Sync to BoltHaven';
        }, 2000);
      } else {
        syncBtn.textContent = 'Sync Failed';
        setTimeout(() => {
          syncBtn.textContent = 'Sync to BoltHaven';
        }, 2000);
      }
    });
  });
});
