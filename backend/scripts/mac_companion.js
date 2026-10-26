#!/usr/bin/env node

/**
 * BoltHavenProperty — Local macOS Browser Companion Service
 * 
 * Responsibilities:
 * 1. Safe Chrome profile discovery via ~/Library/Application Support/Google/Chrome/Local State
 * 2. Focus and launch specific Chrome profiles using macOS `open -a "Google Chrome" --args --profile-directory="..."`
 * 3. Monitor dedicated processing download directory (e.g. ~/Pictures/BoltHavenProperty/Processing or ~/Downloads)
 * 4. Image file validation (integrity, dimensions, SHA-256)
 * 5. Synchronize state with BoltHavenProperty Go API (http://localhost:8085)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec, spawn, execFile, execSync } = require('child_process');

const PORT = process.env.COMPANION_PORT || 9224;
const BOLTHAVEN_API = process.env.BOLTHAVEN_API || 'http://localhost:8085';

// Default monitored directory on macOS
const defaultProcessingDir = path.join(os.homedir(), 'Pictures', 'BoltHavenProperty', 'Processing');
if (!fs.existsSync(defaultProcessingDir)) {
  try {
    fs.mkdirSync(defaultProcessingDir, { recursive: true });
  } catch (e) {}
}

let activeWatchDir = defaultProcessingDir;
let processedFiles = new Set();
let registeredProfiles = [];   // [{ profileKey, profileName, tabGroups, paired_at }]
let liveTabGroupsByKey = {};   // { 'Profile 14': [...groups] } — pushed by extension on each poll

// Automation engine state (shared across HTTP handlers)
let automationState = {
  is_running: false,
  property_id: null,
  total: 0,
  completed: 0,
  failed: 0,
  remaining: 0,
  started_at: null,
  updated_at: null,
};

// Pending commands queue for extension to pick up via /poll-command
let pendingAutomationCommands = [];

function pushPendingCommand(cmd) {
  if (cmd && cmd.action === 'START_AUTOMATION') {
    // If a START_AUTOMATION command is already queued, replace it with the latest one to prevent duplicate runs
    const beforeCount = pendingAutomationCommands.length;
    pendingAutomationCommands = pendingAutomationCommands.filter((c) => c.action !== 'START_AUTOMATION');
    if (beforeCount !== pendingAutomationCommands.length) {
      console.log('[COMPANION] ℹ️ Replaced previous pending START_AUTOMATION with latest command.');
    }
  }
  pendingAutomationCommands.push(cmd);
}

// 1. Read Chrome profiles directly from macOS Local State
function getLocalChromeProfiles() {
  const localStatePath = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Local State');
  if (!fs.existsSync(localStatePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(localStatePath, 'utf8');
    const data = JSON.parse(raw);
    const infoCache = data.profile && data.profile.info_cache ? data.profile.info_cache : {};
    const results = [];

    for (const [key, val] of Object.entries(infoCache)) {
      results.push({
        profile_key: key,
        display_name: val.name || key,
        email: val.user_name || '',
        avatar_icon: val.avatar_icon || '',
      });
    }
    return results;
  } catch (err) {
    console.error('[COMPANION] Error reading Chrome Local State:', err.message);
    return [];
  }
}

// 1.5. Scan real open tabs & groups from Chrome profile session files
function scanProfileGroups(profileKey, profileName) {
  const chromeDir = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');

  let resolvedKey = profileKey;
  if (!resolvedKey || !fs.existsSync(path.join(chromeDir, resolvedKey))) {
    const profiles = getLocalChromeProfiles();
    const match = profiles.find(
      (p) =>
        (profileName && p.display_name.toLowerCase() === profileName.toLowerCase()) ||
        (profileKey && p.profile_key.toLowerCase() === profileKey.toLowerCase())
    );
    if (match) {
      resolvedKey = match.profile_key;
    } else {
      resolvedKey = 'Profile 14';
    }
  }

  const profileDir = path.join(chromeDir, resolvedKey);
  const ldbDir = path.join(profileDir, 'Sync Data', 'LevelDB');

  const ldbColorMap = {
    0: '#94A3B8',
    1: '#94A3B8', // Grey (Facilities IMG)
    2: '#3B82F6', // Blue (Enhance IMG)
    3: '#EF4444', // Red (Tiktok - BH Hero)
    4: '#F59E0B', // Yellow (FB Hero)
    5: '#10B981', // Green (Tiktok Dot Hero)
    6: '#EC4899',
    7: '#8B5CF6',
    8: '#06B6D4',
  };

  const groups = new Map();
  const chatgptChats = [];
  const seenUrls = new Set();

  if (fs.existsSync(ldbDir)) {
    try {
      const files = fs.readdirSync(ldbDir).filter((f) => f.endsWith('.ldb') || f.endsWith('.log'));
      files.sort().reverse();

      for (const f of files) {
        try {
          const buf = fs.readFileSync(path.join(ldbDir, f));
          for (let i = 0; i < buf.length - 10; i++) {
            if (buf[i] === 0x12) {
              const len = buf[i + 1];
              if (len >= 3 && len <= 35 && i + 2 + len + 2 < buf.length) {
                if (buf[i + 2 + len] === 0x18) {
                  const colorCode = buf[i + 2 + len + 1];
                  const title = buf.subarray(i + 2, i + 2 + len).toString('utf8');
                  if (
                    /^[A-Za-z0-9\s\-_]+$/.test(title) &&
                    !title.startsWith('sync') &&
                    !title.startsWith('client') &&
                    title.toLowerCase() !== 'zin-wai-shine' &&
                    !groups.has(title.toLowerCase())
                  ) {
                    groups.set(title.toLowerCase(), {
                      name: title,
                      color: ldbColorMap[colorCode] || '#06B6D4',
                    });
                  }
                }
              }
            }
          }
        } catch (e) {}
      }

      for (const f of files) {
        try {
          const buf = fs.readFileSync(path.join(ldbDir, f));
          const s = buf.toString('latin1');
          const regex = /https:\/\/chatgpt\.com\/c\/([a-f0-9\-]{36})/g;
          let m;
          while ((m = regex.exec(s)) !== null) {
            const url = m[0];
            if (!seenUrls.has(url)) {
              seenUrls.add(url);
              const after = s.slice(m.index + url.length, m.index + url.length + 100);
              const titleM = after.match(/[\x12\x22]([\x03-\x50])([A-Za-z0-9\s\-_.?]+)/);
              const title = titleM ? titleM[2].trim() : 'ChatGPT Conversation';
              chatgptChats.push({ url, title, uuid: m[1] });
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn(`[COMPANION] Error scanning LevelDB for ${resolvedKey}:`, err.message);
    }
  }

  // Exact 4 workers for Enhance IMG: 6ad49918, 6ad49924, 6ad4992a, 6ad4992b
  const enhanceTabs = chatgptChats.filter(
    (c) =>
      c.title.toLowerCase().includes('enhance interior') ||
      ['6ad49918-a4f0-83ec-acf5-efb0ef516adc', '6ad49924-7dd0-83ec-8205-768c67420600', '6ad4992a-66e8-83ec-9b11-c5e727e258d9', '6ad4992b-135c-83ec-b042-8c92220921d7'].includes(c.uuid)
  );

  const defaultEnhanceUuids = [
    { uuid: '6ad49918-a4f0-83ec-acf5-efb0ef516adc', title: 'Enhance Interior Photograph 1' },
    { uuid: '6ad49924-7dd0-83ec-8205-768c67420600', title: 'Enhance Interior Photograph 2' },
    { uuid: '6ad4992a-66e8-83ec-9b11-c5e727e258d9', title: 'Enhance Interior Photograph 3' },
    { uuid: '6ad4992b-135c-83ec-b042-8c92220921d7', title: 'Enhance Interior Photograph 4' },
  ];
  defaultEnhanceUuids.forEach((d) => {
    if (!enhanceTabs.some((t) => t.uuid === d.uuid)) {
      enhanceTabs.push({ url: `https://chatgpt.com/c/${d.uuid}`, title: d.title, uuid: d.uuid });
    }
  });

  const facilitiesTabs = chatgptChats.filter(
    (c) =>
      (c.title.toLowerCase().includes('enhance property') || c.title.toLowerCase().includes('enhance real estate')) &&
      !enhanceTabs.some((e) => e.url === c.url)
  );

  const fbTabs = chatgptChats.filter(
    (c) =>
      c.title.toLowerCase().includes('facebook') ||
      c.title.toLowerCase().includes('create facebook') ||
      c.title.toLowerCase().includes('prompt analysis') ||
      c.uuid === '6ad49862-4bb0-83ec-969a-1a85cf694b6b' ||
      c.uuid === '6ad49a3b-f934-83ec-a7c3-ed5f0977c9f6'
  );

  const defaultFbUuids = [
    { uuid: '6ad49862-4bb0-83ec-969a-1a85cf694b6b', title: 'Prompt analysis' },
    { uuid: '6ad49a3b-f934-83ec-a7c3-ed5f0977c9f6', title: 'Create Facebook Advertisement' },
  ];
  defaultFbUuids.forEach((d) => {
    if (!fbTabs.some((t) => t.uuid === d.uuid)) {
      fbTabs.push({ url: `https://chatgpt.com/c/${d.uuid}`, title: d.title, uuid: d.uuid });
    }
  });

  const tiktokTabs = chatgptChats.filter(
    (c) =>
      c.title.toLowerCase().includes('advertisement') ||
      c.uuid === '6ad6c92c-1bf4-83ec-ae98-9568d0a39027' ||
      c.uuid === '6ad31074-980c-83ec-8403-c65811ad9d7c'
  );

  const tiktokDotTabs = chatgptChats.filter(
    (c) => c.uuid === '6ad310de-c0c8-83ec-8467-45bd13e3b137'
  );

  const result = [];
  const order = ['enhance img', 'fb hero', 'tiktok - bh hero', 'tiktok dot hero', 'facilities img'];
  const prettyNames = {
    'enhance img': 'Enhance IMG',
    'fb hero': 'FB Hero',
    'tiktok - bh hero': 'Tiktok - BH Hero',
    'tiktok dot hero': 'Tiktok Dot Hero',
    'facilities img': 'Facilities IMG',
  };

  for (const groupNameLower of order) {
    const grp = groups.get(groupNameLower) || {
      name: prettyNames[groupNameLower] || groupNameLower.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      color:
        groupNameLower.includes('enhance')
          ? '#3B82F6'
          : groupNameLower.includes('fb')
          ? '#F59E0B'
          : groupNameLower.includes('bh')
          ? '#EF4444'
          : groupNameLower.includes('dot')
          ? '#10B981'
          : '#94A3B8',
    };

    let mappedTabs = [];
    if (groupNameLower.includes('enhance')) {
      mappedTabs = enhanceTabs;
    } else if (groupNameLower.includes('fb')) {
      mappedTabs = fbTabs;
    } else if (groupNameLower.includes('bh hero') || (groupNameLower.includes('tiktok') && !groupNameLower.includes('dot'))) {
      mappedTabs = tiktokTabs;
    } else if (groupNameLower.includes('dot')) {
      mappedTabs = tiktokDotTabs;
    } else if (groupNameLower.includes('facilities')) {
      mappedTabs = facilitiesTabs;
    }

    result.push({
      id: 'grp-' + grp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: grp.name,
      color: grp.color,
      is_active: true,
      tabs_count: mappedTabs.length,
      tabs: mappedTabs.map((t, idx) => ({
        id: `tab-${grp.name.toLowerCase().slice(0, 3)}-${idx + 1}`,
        title: `${t.title.replace(/\d+$/, '').trim()} — Worker #${idx + 1}`,
        url: t.url,
        is_chatgpt: true,
      })),
    });
  }

  return result;
}

const CHROME_BINARY = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_USER_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');

function getRunningChromePid() {
  const lockPath = path.join(CHROME_USER_DATA_DIR, 'SingletonLock');
  try {
    const stat = fs.lstatSync(lockPath);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(lockPath);
      const m = target.match(/-(\d+)$/);
      if (m) {
        const pid = parseInt(m[1], 10);
        try {
          process.kill(pid, 0);
          return pid;
        } catch (e) {
          // Stale link pointing to terminated process - clean up locks
          try {
            fs.unlinkSync(lockPath);
            fs.unlinkSync(path.join(CHROME_USER_DATA_DIR, 'SingletonSocket'));
            fs.unlinkSync(path.join(CHROME_USER_DATA_DIR, 'SingletonCookie'));
          } catch (delErr) {}
        }
      }
    }
  } catch (e) {}

  // Fallback: inspect running Google Chrome processes (excluding remote debugging test instances)
  try {
    const pgrep = execSync('pgrep -x "Google Chrome" 2>/dev/null', { encoding: 'utf8' }).trim();
    if (pgrep) {
      const pids = pgrep.split('\n').map((p) => parseInt(p.trim(), 10)).filter(Boolean);
      for (const p of pids) {
        try {
          const ps = execSync(`ps -p ${p} -o command= 2>/dev/null`, { encoding: 'utf8' });
          if (!ps.includes('remote-debugging-port')) {
            return p;
          }
        } catch (e) {}
      }
      return pids[pids.length - 1];
    }
  } catch (e) {}
  return null;
}

function isChromeRunning() {
  const pid = getRunningChromePid();
  if (pid) return true;
  try {
    const pgrep = execSync('pgrep -x "Google Chrome" 2>/dev/null', { encoding: 'utf8' }).trim();
    return Boolean(pgrep);
  } catch (e) {
    return false;
  }
}

// Check if THAT SPECIFIC Chrome profile is currently open and active
function isChromeProfileOpen(profileKey, profileName) {
  const normKey = normalizeProfileKey(profileKey, profileName);
  if (!isChromeRunning()) {
    return false;
  }

  // 1. Check live extension heartbeats / pair records for this specific profile
  if (liveTabGroupsByKey[normKey] && liveTabGroupsByKey[normKey].length > 0) {
    const recent = registeredProfiles.slice().reverse().find((p) => {
      const k = (p.profileKey || p.profile_key || '').toLowerCase();
      return k === normKey.toLowerCase();
    });
    if (recent && recent.paired_at) {
      const age = Date.now() - new Date(recent.paired_at).getTime();
      if (age < 45000) return true;
    }
  }

  return false;
}

function activateChromeWindow(pid, fallbackUrl = 'https://chatgpt.com/', matchQuery = 'chatgpt.com') {
  const targetPid = pid || getRunningChromePid();
  if (targetPid) {
    exec(`swift -e 'import AppKit; NSRunningApplication(processIdentifier: ${targetPid})?.activate(options: .activateIgnoringOtherApps)' 2>/dev/null`, () => {});
  }
  const cleanMatch = (matchQuery || 'chatgpt.com').replace(/"/g, '');
  const cleanFallback = (fallbackUrl || 'https://chatgpt.com/').replace(/"/g, '');
  const asScript = `
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then
    open location "${cleanFallback}"
  else
    repeat with w in windows
      set tabIdx to 1
      repeat with t in tabs of w
        if URL of t contains "${cleanMatch}" then
          set active tab index of w to tabIdx
          set index of w to 1
          return
        end if
        set tabIdx to tabIdx + 1
      end repeat
    end repeat
  end if
end tell
`;
  execFile('osascript', ['-e', asScript], () => {});
}

// 2. Focus / Open Chrome Profile on macOS
function normalizeProfileKey(profileKey, profileName) {
  const chromeDir = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  if (profileKey && fs.existsSync(path.join(chromeDir, profileKey))) {
    return profileKey;
  }
  const m = String(profileKey || profileName || '').match(/(Profile\s*\d+|Default)/i);
  if (m) {
    const key = m[1].replace(/\s+/, ' ');
    if (fs.existsSync(path.join(chromeDir, key))) return key;
  }
  const profiles = getLocalChromeProfiles();
  const match = profiles.find(
    (p) =>
      (profileName && p.display_name.toLowerCase() === profileName.toLowerCase()) ||
      (profileKey && p.profile_key.toLowerCase() === profileKey.toLowerCase()) ||
      (profileKey && p.display_name.toLowerCase().includes(profileKey.toLowerCase()))
  );
  if (match) return match.profile_key;
  return 'Profile 14';
}

let lastLaunchedProfile = '';
let lastLaunchTime = 0;

function launchChromeProfileOnce(resolvedKey, targetUrls = []) {
  const now = Date.now();
  if (lastLaunchedProfile === resolvedKey && (now - lastLaunchTime < 3000)) {
    activateChromeWindow(undefined, 'https://chatgpt.com/', 'chatgpt.com');
    return Promise.resolve(true);
  }
  lastLaunchedProfile = resolvedKey;
  lastLaunchTime = now;

  return new Promise((resolve) => {
    console.log(`[COMPANION] Launching Chrome for profile "${resolvedKey}"...`);
    // Launch Chrome profile cleanly with extension attached.
    // Do not pass worker URLs on CLI to prevent creating duplicate loose tabs outside the tab group!
    const args = [
      `--profile-directory=${resolvedKey}`,
      `--load-extension=/Users/zinwaishine/Desktop/Project_EA/extension`,
    ];
    try {
      const child = spawn(CHROME_BINARY, args, { detached: true, stdio: 'ignore' });
      child.unref();
    } catch (err) {
      console.warn('[COMPANION] Error launching Chrome with profile:', err.message);
    }

    setTimeout(() => {
      activateChromeWindow(undefined, 'https://chatgpt.com/', 'chatgpt.com');
      resolve(true);
    }, 450);
  });
}

function focusChromeProfile(profileKey) {
  const resolvedKey = normalizeProfileKey(profileKey);
  console.log(`[COMPANION] Focusing Chrome profile: "${resolvedKey}"`);
  if (isChromeProfileOpen(resolvedKey)) {
    console.log(`[COMPANION] Profile "${resolvedKey}" is already open. Activating window.`);
    activateChromeWindow();
    return Promise.resolve(true);
  }
  console.log(`[COMPANION] Profile "${resolvedKey}" is not open. Launching profile browser...`);
  return launchChromeProfileOnce(resolvedKey);
}

function openChromeUrl(profileKey, targetURL) {
  return new Promise((resolve, reject) => {
    const resolvedKey = normalizeProfileKey(profileKey);
    const urls = Array.isArray(targetURL) ? targetURL : [targetURL || 'https://chatgpt.com/'];
    console.log(`[COMPANION] Opening URLs in profile "${resolvedKey}":`, urls);

    // If THAT SAME PROFILE is already open, queue for extension in that profile to open URL
    if (isChromeProfileOpen(resolvedKey)) {
      activateChromeWindow();
      pushPendingCommand({
        action: 'OPEN_URL',
        payload: { url: urls[0], profileKey: resolvedKey },
        created_at: new Date().toISOString(),
      });
      return resolve(true);
    }

    // Profile is NOT open -> must launch Chrome with that profile cleanly (no CLI urls to avoid duplicate tabs)
    console.log(`[COMPANION] Profile "${resolvedKey}" is not open. Launching profile browser cleanly...`);
    const pid = getRunningChromePid();
    const args = [
      `--profile-directory=${resolvedKey}`,
      `--load-extension=/Users/zinwaishine/Desktop/Project_EA/extension`,
    ];

    try {
      const child = spawn(CHROME_BINARY, args, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      // Queue command for extension to handle once it connects
      pushPendingCommand({
        action: 'OPEN_URL',
        payload: { url: urls[0], profileKey: resolvedKey },
        created_at: new Date().toISOString(),
      });

      setTimeout(() => {
        const updatedPid = getRunningChromePid() || pid;
        activateChromeWindow(updatedPid, urls[0]);
        console.log(`[COMPANION] Successfully launched Chrome cleanly in profile "${resolvedKey}"`);
        resolve(true);
      }, 450);
    } catch (err) {
      console.error(`[COMPANION] Error opening URL in profile "${resolvedKey}":`, err.message);
      reject(err);
    }
  });
}

let lastFocusTabGroupTime = 0;
let lastFocusTabGroupKey = '';

function openOrFocusChromeTabs(profileKey, groupName, targetUrls) {
  const resolvedKey = normalizeProfileKey(profileKey);
  console.log(`[COMPANION] openOrFocusChromeTabs: profile="${resolvedKey}", group="${groupName}"`);
  if (isChromeProfileOpen(resolvedKey)) {
    activateChromeWindow();
    return Promise.resolve(true);
  }
  return launchChromeProfileOnce(resolvedKey, targetUrls);
}

function focusChromeTabGroup(profileKey, groupName, tabId, defaultUrl, explicitTabUrls, force, tabMode = 'existing_tabs', workerCount = 4, reuseSessionTabs = true) {
  const resolvedKey = normalizeProfileKey(profileKey);
  const now = Date.now();
  const cacheKey = `${resolvedKey}-${groupName}-${tabMode}-${workerCount}`;
  const shouldSkipWindowLaunch = (!force && cacheKey === lastFocusTabGroupKey && (now - lastFocusTabGroupTime < 2500));
  lastFocusTabGroupTime = now;
  lastFocusTabGroupKey = cacheKey;

  return new Promise(async (resolve) => {
    console.log(`[COMPANION] Auto-focusing Chrome profile "${resolvedKey}" & Tab Group "${groupName}" (mode: ${tabMode}, workers: ${workerCount})...`);

    // 1. Determine all distinct tab URLs for this group
    let groupTabUrls = Array.isArray(explicitTabUrls) && explicitTabUrls.length > 0 ? explicitTabUrls : [];
    let targetUrl = defaultUrl || '';

    if (groupTabUrls.length === 0) {
      // Check live data pushed by extension (most accurate)
      const liveGroups = liveTabGroupsByKey[resolvedKey] || [];
      const liveMatch = liveGroups.find((g) =>
        (g.title || g.name || '').toLowerCase().includes((groupName || 'enhance').toLowerCase())
      );
      if (liveMatch && Array.isArray(liveMatch.tabs) && liveMatch.tabs.length > 0) {
        groupTabUrls = liveMatch.tabs.map((t) => t.url).filter(Boolean);
        const found = tabId ? liveMatch.tabs.find((t) => String(t.id) === String(tabId)) : null;
        targetUrl = (found || liveMatch.tabs[0]).url || targetUrl;
        console.log(`[COMPANION] Using live extension data: ${liveMatch.tabs.length} tabs in "${groupName}"`);
      } else {
        // Fallback: scan LevelDB records
        try {
          const groups = scanProfileGroups(resolvedKey, '');
          const match = (groups || []).find((g) =>
            (g.name || '').toLowerCase().includes((groupName || 'enhance').toLowerCase())
          );
          if (match && match.tabs && match.tabs.length > 0) {
            groupTabUrls = match.tabs.map((t) => t.url).filter(Boolean);
            const found = tabId ? match.tabs.find((t) => t.id === tabId) : null;
            targetUrl = (found || match.tabs[0]).url || targetUrl;
          }
        } catch (e) {}
      }
    }

    if (!targetUrl || targetUrl === 'chrome://newtab') {
      targetUrl = groupTabUrls[0] || 'https://chatgpt.com/';
    }
    if (groupTabUrls.length === 0) {
      groupTabUrls = [targetUrl];
    }

    // 2. Queue command for Chrome Extension to expand and focus all tabs in group
    pushPendingCommand({
      action: 'FOCUS_GROUP',
      payload: { groupName, tabId, profileKey: resolvedKey, targetUrl, groupTabUrls, tabMode, workerCount, reuseSessionTabs },
      created_at: new Date().toISOString(),
    });

    // 3. Activate window and bring the matching tab to the front
    const matchTarget = (groupTabUrls[0] || targetUrl || 'chatgpt.com');
    if (isChromeProfileOpen(resolvedKey)) {
      console.log(`[COMPANION] Profile "${resolvedKey}" is already open. Activating window & matching tab.`);
      activateChromeWindow(undefined, targetUrl, matchTarget);
    } else if (!shouldSkipWindowLaunch) {
      console.log(`[COMPANION] Profile "${resolvedKey}" is not open. Launching profile browser with group URLs...`);
      await launchChromeProfileOnce(resolvedKey, groupTabUrls.length > 0 ? groupTabUrls : [targetUrl]);
    } else {
      activateChromeWindow(undefined, targetUrl, matchTarget);
    }

    resolve(true);
  });
}

function verifyChromeTabsOpen(profileKey, groupName, expectedUrls = [], tabMode = 'existing_tabs', workerCount = 4) {
  return new Promise((resolve) => {
    const effectiveCount = Math.max(1, Math.min(8, parseInt(workerCount, 10) || 4));
    let targets = (expectedUrls || []).filter(Boolean);
    if (targets.length === 0) {
      if ((groupName || '').toLowerCase().includes('enhance')) {
        targets = [
          'https://chatgpt.com/c/6ad49918-a4f0-83ec-acf5-efb0ef516adc',
          'https://chatgpt.com/c/6ad49924-7dd0-83ec-8205-768c67420600',
          'https://chatgpt.com/c/6ad4992a-66e8-83ec-9b11-c5e727e258d9',
          'https://chatgpt.com/c/6ad4992b-135c-83ec-b042-8c92220921d7',
        ];
      } else {
        targets = ['https://chatgpt.com/'];
      }
    }
    targets = targets.slice(0, effectiveCount);

    const userPid = getRunningChromePid();
    let isChromeRunning = Boolean(userPid);
    if (!isChromeRunning) {
      try {
        const pgrep = execSync('pgrep -x "Google Chrome" 2>/dev/null', { encoding: 'utf8' }).trim();
        if (pgrep) isChromeRunning = true;
      } catch (e) {}
    }

    if (!isChromeRunning) {
      return resolve({
        verified: false,
        chrome_running: false,
        window_count: 0,
        matched_count: 0,
        total_expected: targets.length,
        message: 'Google Chrome is not running',
      });
    }

    // Check if Chrome has windows open
    let winCount = 0;
    try {
      const cnt = execSync(`osascript -e 'tell application "Google Chrome" to count windows' 2>/dev/null`, { encoding: 'utf8' }).trim();
      winCount = parseInt(cnt, 10) || 0;
    } catch (e) {}

    if (winCount === 0) {
      activateChromeWindow(undefined, targets[0] || 'https://chatgpt.com/', targets[0] || 'chatgpt.com');
    }

    // 1. First priority: Check live tab groups reported directly by Chrome Extension
    const normKey = normalizeProfileKey(profileKey);
    const liveGroups = liveTabGroupsByKey[profileKey] || liveTabGroupsByKey[normKey] || [];
    const liveMatch = liveGroups.find((g) =>
      (g.title || g.name || '').toLowerCase().includes((groupName || 'enhance').toLowerCase())
    );
    if (liveMatch && Array.isArray(liveMatch.tabs) && liveMatch.tabs.length > 0) {
      const liveUrls = liveMatch.tabs.map((t) => t.url).filter(Boolean);
      return resolve({
        verified: true,
        chrome_running: true,
        window_count: Math.max(1, winCount),
        matched_count: liveUrls.length,
        total_expected: targets.length,
        matched_urls: liveUrls,
        missing_urls: [],
        message: `Tab group "${groupName}" confirmed active with ${liveUrls.length} tabs`,
      });
    }

    const script = `
      tell application "Google Chrome"
        set winCount to count of windows
        if winCount = 0 then
          return "0||NO_WINDOWS"
        end if
        
        -- Collect all URLs from all windows
        set allUrls to {}
        repeat with w in windows
          repeat with t in tabs of w
            set end of allUrls to (URL of t as text)
          end repeat
        end repeat
        
        -- Return formatted list
        set AppleScript's text item delimiters to "||"
        set urlsStr to allUrls as text
        set AppleScript's text item delimiters to ""
        return (winCount as text) & "||" & urlsStr
      end tell
    `;

    execFile('osascript', ['-e', script], { timeout: 3500 }, async (err, stdout) => {
      let winCount = 0;
      let activeUrls = [];

      if (!err && stdout) {
        const parts = stdout.trim().split('||');
        winCount = parseInt(parts[0], 10) || 0;
        activeUrls = parts.slice(1).map((u) => u.trim());
      }

      if (tabMode === 'new_tabs') {
        const chatgptTabs = activeUrls.filter((u) => u.toLowerCase().includes('chatgpt.com'));
        const matchedCount = Math.min(chatgptTabs.length, effectiveCount);
        return resolve({
          verified: matchedCount >= 1,
          chrome_running: true,
          window_count: winCount,
          matched_count: matchedCount,
          total_expected: effectiveCount,
          matched_urls: chatgptTabs.slice(0, effectiveCount),
          missing_urls: [],
          message: `${matchedCount} ChatGPT worker tabs confirmed active`,
        });
      }

      const matchedUrls = [];
      const missingUrls = [];

      targets.forEach((tgt) => {
        const tgtLower = tgt.toLowerCase();
        const tgtUuid = tgtLower.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)?.[1];

        const isMatch = activeUrls.some((openUrl) => {
          const uLower = openUrl.toLowerCase();
          if (tgtUuid && uLower.includes(tgtUuid)) return true;
          if (uLower === tgtLower) return true;
          return false;
        });

        if (isMatch) {
          matchedUrls.push(tgt);
        } else {
          missingUrls.push(tgt);
        }
      });

      const isVerified = matchedUrls.length >= 1;

      resolve({
        verified: isVerified,
        chrome_running: true,
        window_count: winCount,
        matched_count: matchedUrls.length,
        total_expected: targets.length,
        matched_urls: matchedUrls,
        missing_urls: missingUrls,
        message: isVerified
          ? `Verified ${matchedUrls.length}/${targets.length} worker tabs open in Google Chrome`
          : `Waiting for Chrome tabs to finish loading (${matchedUrls.length}/${targets.length} ready)...`,
      });
    });
  });
}


// 3. Monitor download folder for completed images
function startDownloadWatcher() {
  if (!fs.existsSync(activeWatchDir)) {
    return;
  }

  console.log(`[COMPANION] Monitoring directory: ${activeWatchDir}`);
  fs.watch(activeWatchDir, (eventType, filename) => {
    if (!filename) return;

    const lower = filename.toLowerCase();
    if (
      lower.endsWith('.crdownload') ||
      lower.endsWith('.tmp') ||
      lower.startsWith('.') ||
      lower.endsWith('.part')
    ) {
      return; // Skip partial download files
    }

    if (
      !lower.endsWith('.png') &&
      !lower.endsWith('.jpg') &&
      !lower.endsWith('.jpeg') &&
      !lower.endsWith('.webp')
    ) {
      return;
    }

    const fullPath = path.join(activeWatchDir, filename);
    if (processedFiles.has(fullPath)) return;

    // Verify file write stability (file size unchanging)
    setTimeout(() => {
      try {
        if (!fs.existsSync(fullPath)) return;
        const stat1 = fs.statSync(fullPath);
        if (stat1.size === 0) return;

        setTimeout(() => {
          try {
            if (!fs.existsSync(fullPath)) return;
            const stat2 = fs.statSync(fullPath);
            if (stat1.size !== stat2.size) return; // Still downloading

            // File complete!
            processedFiles.add(fullPath);
            handleDetectedDownload(fullPath, filename, stat2.size);
          } catch (e) {}
        }, 300);
      } catch (e) {}
    }, 200);
  });
}

function handleDetectedDownload(filePath, fileName, size) {
  try {
    const fileBuf = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');
    console.log(`[COMPANION] Validated download: ${fileName} (${size} bytes, sha256: ${hash.slice(0, 12)})`);

    // Notify BoltHaven backend of newly downloaded file
    const postData = JSON.stringify({
      file_name: fileName,
      file_path: filePath,
      checksum: hash,
      size: size,
      detected_at: new Date().toISOString(),
    });

    const req = http.request(
      `${BOLTHAVEN_API}/api/browser/companion/sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        console.log(`[COMPANION] Synced with BoltHaven API: status ${res.statusCode}`);
      }
    );

    req.on('error', (e) => {
      console.warn(`[COMPANION] Warning: Could not sync with BoltHaven API (${e.message})`);
    });

    req.write(postData);
    req.end();
  } catch (err) {
    console.error('[COMPANION] Error processing download:', err);
  }
}

// 4. HTTP Service for BoltHaven Frontend & Chrome Extension Pairing
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health and Status
  if (url.pathname === '/health' || url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        status: 'online',
        service: 'BoltHaven Mac Browser Companion',
        version: '2.5.0',
        platform: os.platform(),
        watch_directory: activeWatchDir,
        monitored_exists: fs.existsSync(activeWatchDir),
        registered_profiles_count: registeredProfiles.length,
      })
    );
  }

  // ── Read-Only Condo Folder Image Scanner ───────────────────────────────────
  // Scans /Users/zinwaishine/Desktop/Condo Building with fuzzy matching
  // STRICT READ-ONLY: Never alters, renames, writes, or deletes any desktop files!
  const CONDO_BASE_DIR = path.join(os.homedir(), 'Desktop', 'Condo Building');

  function normalizeCondoName(str) {
    if (!str) return '';
    return str
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(ให้เช่า|เช่า|ขาย|คอนโด|for rent|for sale|\(owner post\)|owner post)[\s:]*/i, '')
      // Convert mathematical bold, italic, and sans-serif Unicode to standard ASCII
      .replace(/[\u{1D400}-\u{1D7FF}]/gu, (c) => {
        const code = c.codePointAt(0);
        if (code >= 0x1d400 && code <= 0x1d419) return String.fromCharCode(65 + code - 0x1d400);
        if (code >= 0x1d41a && code <= 0x1d433) return String.fromCharCode(97 + code - 0x1d41a);
        if (code >= 0x1d7ce && code <= 0x1d7d7) return String.fromCharCode(48 + code - 0x1d7ce);
        if (code >= 0x1d5d4 && code <= 0x1d5ed) return String.fromCharCode(65 + code - 0x1d5d4);
        if (code >= 0x1d5ee && code <= 0x1d607) return String.fromCharCode(97 + code - 0x1d5ee);
        return c;
      })
      .toLowerCase()
      .replace(/^(ให้เช่า|เช่า|ขาย|คอนโด|for rent|for sale|\(owner post\)|owner post)[\s:]*/i, '')
      .replace(/[:\/_\-\(\)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findCondoDirectory(query, customBaseDir) {
    const baseDir = (customBaseDir && fs.existsSync(customBaseDir)) ? customBaseDir : CONDO_BASE_DIR;
    if (!fs.existsSync(baseDir)) return null;
    const dirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const normQ = normalizeCondoName(query);
    if (!normQ) return null;

    // 1. Exact normalized match
    for (const d of dirs) {
      if (normalizeCondoName(d) === normQ) return d;
    }
    // 2. Substring match
    for (const d of dirs) {
      const nd = normalizeCondoName(d);
      if (nd && (nd.includes(normQ) || normQ.includes(nd))) return d;
    }
    // 3. Token overlap match (e.g. "Regent Home Bangna" vs "Regent Home Bangna")
    const qTokens = normQ.split(' ').filter((t) => t.length > 2);
    let best = null;
    let bestScore = 0;
    for (const d of dirs) {
      const nd = normalizeCondoName(d);
      let score = 0;
      for (const t of qTokens) {
        if (nd.includes(t)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return bestScore >= Math.min(2, qTokens.length) ? best : null;
  }

  // Native macOS folder chooser dialog via osascript
  if (url.pathname === '/choose-folder' && (req.method === 'POST' || req.method === 'GET')) {
    try {
      const appleScript = `POSIX path of (choose folder with prompt "Select Condo Buildings Base Directory")`;
      execFile('osascript', ['-e', appleScript], (err, stdout) => {
        if (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'cancelled', error: err.message }));
        }
        const selectedPath = (stdout || '').trim().replace(/\/$/, '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'success', selected_path: selectedPath }));
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: e.message }));
    }
    return;
  }

  if (url.pathname === '/condo-images') {
    const handleCondoRequest = (condoName, customBaseDir) => {
      try {
        const baseDir = (customBaseDir && fs.existsSync(customBaseDir)) ? customBaseDir : CONDO_BASE_DIR;
        if (!fs.existsSync(baseDir)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'error', message: `Condo directory not found: ${baseDir}`, base_dir: baseDir }));
        }

        const matchedDir = findCondoDirectory(condoName, baseDir);
        if (!matchedDir) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            status: 'error',
            message: `No matching condo directory found for "${condoName}" in ${baseDir}`,
            base_dir: baseDir,
          }));
        }

        const folderPath = path.join(baseDir, matchedDir);
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });

        // Strictly locate image files named 1, 2, 3 (ignoring subdirectories like D or watermark)
        const images = [];
        [1, 2, 3].forEach((num) => {
          const match = entries.find(
            (f) => f.isFile() && new RegExp(`^${num}\\.(png|jpg|jpeg|webp)$`, 'i').test(f.name)
          );
          if (match) {
            const filePath = path.join(folderPath, match.name);
            const ext = path.extname(match.name).toLowerCase().replace('.', '') || 'png';
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            const fileBuf = fs.readFileSync(filePath);
            const b64 = fileBuf.toString('base64');
            images.push({
              index: num,
              filename: match.name,
              mime_type: mime,
              full_path: filePath,
              size_bytes: fileBuf.length,
              data_url: `data:${mime};base64,${b64}`,
            });
          }
        });

        // Fallback: If 1.png, 2.png, 3.png not explicitly numbered, pick the top 3 image files
        if (images.length === 0) {
          const validEntries = entries
            .filter((f) => f.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(f.name) && !f.name.startsWith('.'))
            .slice(0, 3);
          validEntries.forEach((file, idx) => {
            const filePath = path.join(folderPath, file.name);
            const ext = path.extname(file.name).toLowerCase().replace('.', '') || 'png';
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            const fileBuf = fs.readFileSync(filePath);
            const b64 = fileBuf.toString('base64');
            images.push({
              index: idx + 1,
              filename: file.name,
              mime_type: mime,
              full_path: filePath,
              size_bytes: fileBuf.length,
              data_url: `data:${mime};base64,${b64}`,
            });
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'success',
          condo_query: condoName,
          matched_folder: matchedDir,
          folder_path: folderPath,
          base_dir: baseDir,
          images_found: images.length,
          images: images,
        }));
      } catch (err) {
        console.error('[COMPANION] Error reading condo images:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          handleCondoRequest(parsed.condo_name || parsed.condoName || parsed.title || '', parsed.base_dir || parsed.target_folder);
        } catch (e) {
          handleCondoRequest('');
        }
      });
      return;
    } else {
      const q = url.searchParams.get('condo_name') || url.searchParams.get('condoName') || url.searchParams.get('q') || '';
      const customBase = url.searchParams.get('base_dir') || url.searchParams.get('target_folder') || '';
      return handleCondoRequest(q, customBase);
    }
  }

  // Preview all indexed condo directories
  if (url.pathname === '/scan-condos' && (req.method === 'GET' || req.method === 'POST')) {
    const customBase = url.searchParams.get('base_dir') || url.searchParams.get('target_folder') || '';
    const baseDir = (customBase && fs.existsSync(customBase)) ? customBase : CONDO_BASE_DIR;
    if (!fs.existsSync(baseDir)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'success', total_condos: 0, folders: [], base_dir: baseDir }));
    }
    const dirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'success',
      base_dir: baseDir,
      total_condos: dirs.length,
      folders: dirs,
    }));
  }

  // Discovered Chrome Profiles on macOS
  if (url.pathname === '/profiles') {
    const profiles = getLocalChromeProfiles();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'success', profiles }));
  }

  // Open / Focus Chrome Profile
  if (url.pathname === '/open-profile' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const profileKey = payload.profile_key || 'Default';
        await focusChromeProfile(profileKey);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: `Profile ${profileKey} focused` }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: e.message }));
      }
    });
    return;
  }

  // Open a specific URL inside the correct Chrome Profile on macOS
  if (url.pathname === '/open-url' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const profileKey = payload.profile_key || 'Default';
        const targetURL = payload.url || '';
        if (!targetURL) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'error', message: 'Missing url' }));
        }
        // Open the URL in the correct Chrome profile on macOS
        await openChromeUrl(profileKey, targetURL);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: `URL opened in profile ${profileKey}`, url: targetURL }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: e.message }));
      }
    });
    return;
  }

  // Focus Profile and Tab Group (called when workflow arrives at External Browser node)
  if (url.pathname === '/focus-tab-group' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const profileKey = payload.profile_key || 'Profile 14';
        const groupName = payload.group_name || 'Enhance IMG';
        const tabId = payload.tab_id || '';
        const groupTabUrls = payload.group_tab_urls || payload.groupTabUrls || [];
        const force = !!payload.force;
        const tabMode = payload.tab_mode || 'existing_tabs';
        const workerCount = parseInt(payload.worker_count, 10) || 4;
        const reuseSessionTabs = payload.reuse_session_tabs !== false;

        await focusChromeTabGroup(profileKey, groupName, tabId, defaultUrl, groupTabUrls, force, tabMode, workerCount, reuseSessionTabs);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          message: `Profile "${profileKey}" and Tab Group "${groupName}" focused`,
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: e.message }));
      }
    });
    return;
  }

  // Active Tab & Browser Readiness Verification (used during workflow execution)
  if (url.pathname === '/verify-tab-group') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const profileKey = payload.profile_key || payload.profileKey || 'Profile 14';
          const groupName = payload.group_name || payload.groupName || 'Enhance IMG';
          const expectedUrls = payload.group_tab_urls || payload.groupTabUrls || payload.expected_urls || [];
          const autoLaunch = !!payload.auto_launch;
          const tabMode = payload.tab_mode || 'existing_tabs';
          const workerCount = parseInt(payload.worker_count, 10) || 4;

          let checkResult = await verifyChromeTabsOpen(profileKey, groupName, expectedUrls, tabMode, workerCount);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'success', ...checkResult }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: e.message }));
        }
      });
      return;
    } else {
      // GET request
      const profileKey = url.searchParams.get('profile_key') || 'Profile 14';
      const groupName = url.searchParams.get('group_name') || 'Enhance IMG';
      const rawUrls = url.searchParams.getAll('urls') || [];
      const expectedUrls = rawUrls.length > 0 ? rawUrls : (url.searchParams.get('urls') ? url.searchParams.get('urls').split(',') : []);

      verifyChromeTabsOpen(profileKey, groupName, expectedUrls).then((checkResult) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', ...checkResult }));
      }).catch((e) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: e.message }));
      });
      return;
    }
  }

function mergeTabGroups(scannedGroups, liveGroups) {
  const result = [];
  const liveMap = new Map();

  for (const lg of (liveGroups || [])) {
    const title = (lg.title || lg.name || '').trim().toLowerCase();
    if (title) {
      liveMap.set(title, lg);
    }
  }

  for (const sg of (scannedGroups || [])) {
    const sgKey = (sg.name || '').trim().toLowerCase();
    let matchedLive = null;
    for (const [key, lg] of liveMap.entries()) {
      if (key === sgKey || key.includes(sgKey) || sgKey.includes(key)) {
        matchedLive = lg;
        liveMap.delete(key);
        break;
      }
    }

    if (matchedLive && Array.isArray(matchedLive.tabs) && matchedLive.tabs.length > 0) {
      result.push({
        id: String(matchedLive.id || sg.id),
        name: matchedLive.title || matchedLive.name || sg.name,
        color: matchedLive.color || sg.color,
        is_active: true,
        tabs_count: matchedLive.tabs.length,
        tabs: matchedLive.tabs.map((t, idx) => ({
          id: String(t.id || `tab-${idx + 1}`),
          title: t.title || 'Tab',
          url: t.url || '',
          is_chatgpt: !!t.isChatGPT || (t.url || '').includes('chatgpt.com'),
        })),
      });
    } else {
      result.push(sg);
    }
  }

  // Any additional live groups detected in Chrome
  for (const [, lg] of liveMap.entries()) {
    result.push({
      id: String(lg.id || 'group'),
      name: lg.title || lg.name || 'Group',
      color: lg.color || '#06B6D4',
      is_active: true,
      tabs_count: Array.isArray(lg.tabs) ? lg.tabs.length : 0,
      tabs: (lg.tabs || []).map((t, idx) => ({
        id: String(t.id || `tab-${idx + 1}`),
        title: t.title || 'Tab',
        url: t.url || '',
        is_chatgpt: !!t.isChatGPT || (t.url || '').includes('chatgpt.com'),
      })),
    });
  }

  return result;
}

  // Query live tab groups for a profile (profile-specific read from Chrome saved data + live extension groups)
  if (url.pathname === '/profile-groups' && req.method === 'GET') {
    const rawProfileName = url.searchParams.get('profile_name') || '';
    const rawProfileKey = url.searchParams.get('profile_key') || '';
    const profileName = rawProfileName.toLowerCase();
    const profileKey = rawProfileKey.toLowerCase();

    // 1. Scan configured and saved tab groups for this profile
    const scannedGroups = scanProfileGroups(rawProfileKey, rawProfileName);

    // 2. Fetch live open tab groups pushed by extension
    let liveGroups = [];
    if (rawProfileKey && liveTabGroupsByKey[rawProfileKey]) {
      liveGroups = liveTabGroupsByKey[rawProfileKey];
    } else {
      const found = registeredProfiles.slice().reverse().find((p) => {
        const pKey = (p.profileKey || p.profile_key || '').toLowerCase();
        const pName = (p.profileName || p.profile_name || p.displayName || '').toLowerCase();
        return (profileKey && pKey === profileKey) || (profileName && pName.includes(profileName));
      });
      if (found && Array.isArray(found.tabGroups)) {
        liveGroups = found.tabGroups;
      }
    }

    // 3. Fallback to live binary only if no extension groups and no scanned groups
    if (liveGroups.length === 0 && scannedGroups.length === 0) {
      const liveBinary = path.join(__dirname, 'chrome_live_tabs');
      if (fs.existsSync(liveBinary)) {
        try {
          const stdout = require('child_process').execFileSync(liveBinary, { encoding: 'utf8', timeout: 3000 });
          const parsed = JSON.parse(stdout);
          if (parsed && Array.isArray(parsed.groups) && parsed.groups.length > 0) {
            liveGroups = parsed.groups;
          }
        } catch (err) {
          console.warn('[COMPANION] Live Chrome binary query fallback:', err.message);
        }
      }
    }

    // 4. Merge: Always retain ALL profile tab groups (Enhance IMG, FB Hero, etc.),
    // updating any currently open groups with live Chrome tab IDs, titles, and active URLs.
    const groups = mergeTabGroups(scannedGroups, liveGroups);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'success', groups }));
  }

  // Register or Pair Chrome Extension — stores live tab group data keyed by profileKey
  if (url.pathname === '/pair-extension' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const pKey = (payload.profileKey || payload.profile_key || '').trim();
        const entry = {
          ...payload,
          profileKey: pKey,
          paired_at: new Date().toISOString(),
        };
        registeredProfiles.push(entry);
        // Also update fast-lookup map so focusChromeTabGroup can find live data instantly
        if (pKey && Array.isArray(payload.tabGroups) && payload.tabGroups.length > 0) {
          const prevLive = liveTabGroupsByKey[pKey] || [];
          const liveMap = new Map();
          for (const g of prevLive) {
            const key = (g.title || g.name || '').toLowerCase().trim();
            if (key) liveMap.set(key, g);
          }
          for (const g of payload.tabGroups) {
            const key = (g.title || g.name || '').toLowerCase().trim();
            if (key) liveMap.set(key, g);
          }
          liveTabGroupsByKey[pKey] = Array.from(liveMap.values());
          console.log(`[COMPANION] Live tab groups updated for "${pKey}":`, liveTabGroupsByKey[pKey].map((g) => `${g.title || g.name}(${Array.isArray(g.tabs)?g.tabs.length:0})`).join(', '));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', paired: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: e.message }));
      }
    });
    return;
  }

  // ── Automation Progress Report (from extension background worker) ─────────
  if (url.pathname === '/automation-progress' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        automationState = { ...automationState, ...data, updated_at: new Date().toISOString() };
        console.log(`[COMPANION] Automation progress: completed=${data.completed} remaining=${data.remaining}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Automation Complete Report (from extension) ───────────────────────────
  if (url.pathname === '/automation-complete' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        automationState = { ...automationState, ...data, is_running: false, updated_at: new Date().toISOString() };
        console.log(`[COMPANION] ✓ Automation COMPLETE — ${data.completed} done, ${data.failed} failed`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Get Automation State (polled by frontend / backend) ──────────────────
  if (url.pathname === '/automation-status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'success', automation: automationState }));
  }

  // ── Start Automation (called by BoltHaven Go backend → companion → extension) ─
  if (url.pathname === '/start-automation' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        // payload: { profile_key, tab_ids, jobs, property_id }

        let { profile_key, tab_ids, jobs, property_id } = payload;
        const safeTabIds = (tab_ids && tab_ids.length > 0) ? tab_ids : [1, 2, 3, 4];

        automationState = {
          is_running: true,
          property_id,
          total: (jobs || []).length,
          completed: 0,
          failed: 0,
          remaining: (jobs || []).length,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Forward to Chrome extension via runtime messaging
        // We use chrome.runtime.sendMessage from a Node helper script since
        // the companion is a Node.js process. We spawn a small helper that loads
        // the NativeMessaging bridge. As a simpler approach that works without native
        // messaging setup, we expose a /relay-to-extension API endpoint that the
        // popup.html / background.js polls every few seconds via fetch.
        let safeGroupTabUrls = payload.group_tab_urls || payload.groupTabUrls || [];
        if (!safeGroupTabUrls || safeGroupTabUrls.length === 0) {
          safeGroupTabUrls = [
            'https://chatgpt.com/c/6ad49918-a4f0-83ec-acf5-efb0ef516adc',
            'https://chatgpt.com/c/6ad49924-7dd0-83ec-8205-768c67420600',
            'https://chatgpt.com/c/6ad4992a-66e8-83ec-9b11-c5e727e258d9',
            'https://chatgpt.com/c/6ad4992b-135c-83ec-b042-8c92220921d7',
          ];
        }

        // Store the pending command for the extension to pick up when it polls.
        pushPendingCommand({
          action: 'START_AUTOMATION',
          payload: {
            tabIds: safeTabIds,
            jobs: jobs || [],
            propertyId: property_id,
            groupName: payload.group_name || payload.groupName || 'Enhance IMG',
            groupTabUrls: safeGroupTabUrls,
            tabMode: payload.tab_mode || payload.tabMode || 'existing_tabs',
            workerCount: payload.worker_count || payload.workerCount || safeTabIds.length || 4,
            reuseSessionTabs: payload.reuse_session_tabs !== undefined ? payload.reuse_session_tabs : (payload.reuseSessionTabs !== undefined ? payload.reuseSessionTabs : true),
          },
          created_at: new Date().toISOString(),
        });

        // Bring Chrome window to front to trigger tab activation and extension wake-up
        activateChromeWindow();

        const jobCount = (jobs || []).length;
        console.log(`[COMPANION] Queued START_AUTOMATION for ${jobCount} jobs on ${safeTabIds.length} tabs (property: ${property_id})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          message: `Automation queued: ${jobCount} images on ${safeTabIds.length} tabs`,
          property_id,
        }));
      } catch (e) {
        console.error('[COMPANION] Error in /start-automation:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── Stop Automation ─────────────────────────────────────────────────────────
  if (url.pathname === '/stop-automation' && req.method === 'POST') {
    automationState = { ...automationState, is_running: false };
    pushPendingCommand({ action: 'STOP_AUTOMATION', payload: {}, created_at: new Date().toISOString() });
    console.log('[COMPANION] Stop automation command queued');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  // ── Inspect ChatGPT DOM ──────────────────────────────────────────────────
  if (url.pathname === '/last-inspect' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(global.lastInspectResult || { status: 'none' }));
  }

  if (url.pathname === '/inspect-chatgpt' && req.method === 'GET') {
    global.lastInspectResult = null;
    pushPendingCommand({ action: 'INSPECT_CHATGPT', payload: {}, created_at: new Date().toISOString() });
    console.log('[COMPANION] Inspect ChatGPT command queued');
    let attempts = 0;
    while (attempts < 60 && !global.lastInspectResult) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
    const result = global.lastInspectResult || { error: 'Timeout waiting for inspect result' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  }

  if (url.pathname === '/report-inspect' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        global.lastInspectResult = JSON.parse(body || '{}');
      } catch (e) {
        global.lastInspectResult = { raw: body };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
    return;
  }

  // ── Reload Extension ─────────────────────────────────────────────────────────
  if (url.pathname === '/reload-extension' && req.method === 'POST') {
    pushPendingCommand({ action: 'RELOAD_EXTENSION', payload: {}, created_at: new Date().toISOString() });
    console.log('[COMPANION] Reload extension command queued');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', message: 'Reload queued' }));
  }

  // ── Two-Stage Staging Automation (Group 2: Tab 1 Prompt Extractor -> Tab 2 Staging) ──
  let twoStageState = {
    is_running: false,
    step: 'idle',
    extracted_prompt: '',
    condo_name: '',
    matched_folder: '',
    images_attached: 0,
    error: null,
    started_at: null,
    updated_at: null,
  };

  if (url.pathname === '/start-two-stage-staging' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const profileKey = payload.profile_key || 'Profile 14';
        const groupName = payload.group_name || 'FB Hero';
        const condoName = payload.condo_name || payload.title || '';
        const initialPrompt = payload.initial_prompt || payload.prompt || '';
        const useRef = payload.use_reference_image !== false;
        const referenceImage = useRef ? (payload.reference_image || null) : null;
        const useCondoImgs = payload.use_condo_images !== false;
        const customBase = payload.target_folder || payload.base_dir;
        const baseDir = (customBase && fs.existsSync(customBase)) ? customBase : CONDO_BASE_DIR;
        const skipTab1 = !!payload.skip_tab1 || payload.staging_mode === 'direct_tab2';

        // Read local condo images 1, 2, 3 (Strictly Read-Only!)
        let condoImages = [];
        let matchedDir = '';
        if (useCondoImgs && condoName && fs.existsSync(baseDir)) {
          matchedDir = findCondoDirectory(condoName, baseDir);
          if (matchedDir) {
            const folderPath = path.join(baseDir, matchedDir);
            const entries = fs.readdirSync(folderPath, { withFileTypes: true });
            [1, 2, 3].forEach((num) => {
              const match = entries.find(
                (f) => f.isFile() && new RegExp(`^${num}\\.(png|jpg|jpeg|webp)$`, 'i').test(f.name)
              );
              if (match) {
                const filePath = path.join(folderPath, match.name);
                const ext = path.extname(match.name).toLowerCase().replace('.', '') || 'png';
                const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                const buf = fs.readFileSync(filePath);
                condoImages.push({
                  index: num,
                  filename: match.name,
                  data_url: `data:${mime};base64,${buf.toString('base64')}`,
                });
              }
            });

            // Fallback: If 1.png, 2.png, 3.png not explicitly numbered, pick the top 3 image files
            if (condoImages.length === 0) {
              const validEntries = entries
                .filter((f) => f.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(f.name) && !f.name.startsWith('.'))
                .slice(0, 3);
              validEntries.forEach((file, idx) => {
                const filePath = path.join(folderPath, file.name);
                const ext = path.extname(file.name).toLowerCase().replace('.', '') || 'png';
                const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                const buf = fs.readFileSync(filePath);
                condoImages.push({
                  index: idx + 1,
                  filename: file.name,
                  data_url: `data:${mime};base64,${buf.toString('base64')}`,
                });
              });
            }
          }
        }

        twoStageState = {
          is_running: true,
          step: 'starting',
          condo_name: condoName,
          matched_folder: matchedDir || 'not found',
          images_attached: (referenceImage ? 1 : 0) + condoImages.length,
          extracted_prompt: '',
          error: null,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        pushPendingCommand({
          action: 'START_TWO_STAGE_STAGING',
          payload: {
            profileKey,
            groupName,
            initialPrompt,
            referenceImage, // manual example image pasted 1st
            condoImages,    // 1.png, 2.png, 3.png pasted right after
            condoName,
            matchedFolder: matchedDir,
            skipTab1,
          },
          created_at: new Date().toISOString(),
        });

        activateChromeWindow();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          message: `Two-stage staging initiated for "${condoName}" in group "${groupName}"`,
          matched_folder: matchedDir,
          images_count: condoImages.length,
          reference_image_present: !!referenceImage,
        }));
      } catch (e) {
        console.error('[COMPANION] Error starting two-stage staging:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/two-stage-status') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const update = JSON.parse(body || '{}');
          twoStageState = { ...twoStageState, ...update, updated_at: new Date().toISOString() };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', twoStageState }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'success', state: twoStageState }));
    }
  }

  // ── Poll for Pending Extension Command (called by the extension background on an interval) ─
  if (url.pathname === '/poll-command' && req.method === 'GET') {
    if (pendingAutomationCommands.length > 0) {
      const cmd = pendingAutomationCommands.shift();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'command', command: cmd }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'idle' }));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[COMPANION] BoltHaven macOS Browser Companion running at http://0.0.0.0:${PORT} (listening on 127.0.0.1 and host.docker.internal)`);
  startDownloadWatcher();
});
