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
const https = require('https');
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

const REFERENCE_IMAGE_CACHE_FILE = path.join(defaultProcessingDir, '.fb_hero_reference_image.json');

function loadPersistedReferenceImageFromDisk() {
  try {
    if (fs.existsSync(REFERENCE_IMAGE_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(REFERENCE_IMAGE_CACHE_FILE, 'utf8'));
      if (parsed && typeof parsed.reference_image === 'string' && parsed.reference_image.length > 0) {
        return parsed.reference_image;
      }
    }
  } catch (e) {}
  return null;
}

function savePersistedReferenceImageToDisk(dataUrl, boxId) {
  try {
    fs.writeFileSync(
      REFERENCE_IMAGE_CACHE_FILE,
      JSON.stringify({
        reference_image: dataUrl || '',
        box_id: boxId || '',
        updated_at: new Date().toISOString(),
      }),
      'utf8'
    );
  } catch (e) {
    console.warn('[COMPANION] Could not persist reference image to disk:', e.message);
  }
}

function deletePersistedReferenceImageFromDisk() {
  try {
    if (fs.existsSync(REFERENCE_IMAGE_CACHE_FILE)) {
      fs.unlinkSync(REFERENCE_IMAGE_CACHE_FILE);
    }
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

// Two-Stage Staging state (shared across HTTP handlers)
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

  if (resolvedKey === 'Profile 2') {
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
  } else {
    for (let i = 1; i <= 4; i++) {
      if (!enhanceTabs.some((t) => t.title && t.title.includes(`Worker #${i}`))) {
        enhanceTabs.push({ url: 'https://chatgpt.com/', title: `Enhance Image — Worker #${i}`, uuid: `worker-${i}` });
      }
    }
  }

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

function getChromeWindowCount() {
  try {
    const cnt = execSync("osascript -e 'tell application \"Google Chrome\" to count of windows' 2>/dev/null", {
      encoding: 'utf8',
      timeout: 1500,
    }).trim();
    return parseInt(cnt, 10) || 0;
  } catch (e) {
    return 0;
  }
}

function bringChromeToFront() {
  const pid = getRunningChromePid();
  if (pid) {
    exec(`swift -e 'import AppKit; NSRunningApplication(processIdentifier: ${pid})?.activate(options: .activateIgnoringOtherApps)' 2>/dev/null`, () => {});
  } else {
    execFile('osascript', ['-e', 'tell application "Google Chrome" to activate'], () => {});
  }
}

function hasOpenChatGPTWindow() {
  try {
    const res = execSync(`osascript -e '
      tell application "Google Chrome"
        repeat with w in windows
          repeat with t in tabs of w
            if (URL of t as text) contains "chatgpt.com" then return "YES"
          end repeat
        end repeat
        return "NO"
      end tell
    ' 2>/dev/null`, { encoding: 'utf8', timeout: 2000 }).trim();
    return res === 'YES';
  } catch (e) {
    return false;
  }
}

function focusChatGPTWindow() {
  try {
    execSync(`osascript -e '
      tell application "Google Chrome"
        activate
        repeat with w in windows
          repeat with t in tabs of w
            if (URL of t as text) contains "chatgpt.com" then
              set index of w to 1
              return "DONE"
            end if
          end repeat
        end repeat
      end tell
    ' 2>/dev/null`, { timeout: 2000 });
  } catch (e) {}
}

const openedProfiles = new Set();
const launchingProfileLock = {};

// Check if Chrome is currently running
function isChromeProfileOpen(profileKey, profileName) {
  return isChromeRunning();
}

function activateChromeProfile(profileKey, targetUrl = '') {
  const resolvedKey = normalizeProfileKey(profileKey);
  const now = Date.now();

  // Debounce guard: do not re-trigger launch commands within 2 seconds
  const lastLaunch = launchingProfileLock[resolvedKey] || 0;
  if (now - lastLaunch < 2000) {
    console.log(`[COMPANION] Profile "${resolvedKey}" launch was initiated recently. Debouncing...`);
    return;
  }
  launchingProfileLock[resolvedKey] = now;

  const targets = Array.isArray(targetUrl) && targetUrl.length > 0
    ? targetUrl
    : [typeof targetUrl === 'string' && targetUrl.trim() ? targetUrl.trim() : 'https://chatgpt.com/'];

  console.log(`[COMPANION] 🚀 Activating/Opening Chrome profile "${resolvedKey}"...`);

  const chromeBinary = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const chromeRunning = isChromeRunning();

  try {
    if (chromeRunning) {
      // Chrome is already running!
      // Do NOT pass URL targets to the binary CLI when Chrome is running,
      // because passing URLs to running Chrome forces it to create duplicate tabs.
      // Instead, pass only --profile-directory to focus/open the profile window, and activate via AppleScript.
      if (fs.existsSync(chromeBinary)) {
        const child = spawn(chromeBinary, [`--profile-directory=${resolvedKey}`], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      }
      setTimeout(() => {
        try {
          execSync(`osascript -e 'tell application "Google Chrome" to activate' 2>/dev/null`);
        } catch (e) {}
      }, 200);
    } else {
      // Chrome is completely closed: launch it fresh with the profile and initial worker URLs
      if (fs.existsSync(chromeBinary)) {
        const child = spawn(chromeBinary, [`--profile-directory=${resolvedKey}`, ...targets], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      } else {
        const child = spawn('open', ['-a', 'Google Chrome', '--args', `--profile-directory=${resolvedKey}`, ...targets], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
      }
    }
  } catch (err) {
    console.warn('[COMPANION] Error launching Chrome profile:', err.message);
  }
}

// Backwards-compatible alias for any residual call
function activateChromeWindow(pid, fallbackUrl, matchQuery, profileKey) {
  activateChromeProfile(profileKey || 'Profile 2', fallbackUrl || '');
}

// 2. Focus / Open Chrome Profile on macOS
function normalizeProfileKey(profileKey, profileName, email) {
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

  // High Priority: Match by email (notezinwai@gmail.com -> Profile 2, etc.)
  const targetEmail = (email || '').toLowerCase().trim();
  if (targetEmail) {
    const emailMatch = profiles.find((p) => p.email && p.email.toLowerCase().trim() === targetEmail);
    if (emailMatch) return emailMatch.profile_key;
  }

  // Known keyword matching for profiles configured in BoltHaven
  const combined = `${profileKey || ''} ${profileName || ''}`.toLowerCase();
  if (combined.includes('notezinwai') || combined.includes('note zin wai') || combined.includes('zin wai') || combined.includes('pro')) {
    const zinMatch = profiles.find((p) => (p.email || '').toLowerCase().includes('notezinwai') || p.profile_key === 'Profile 2');
    if (zinMatch) return zinMatch.profile_key;
  }
  if (combined.includes('hsuyeenandar417') || (combined.includes('hsu') && !combined.includes('yee'))) {
    const hsuMatch = profiles.find((p) => p.profile_key === 'Profile 14' || (p.email || '').toLowerCase().includes('hsuyeenandar417'));
    if (hsuMatch) return hsuMatch.profile_key;
  }

  const match = profiles.find(
    (p) =>
      (profileName && p.display_name.toLowerCase() === profileName.toLowerCase()) ||
      (profileKey && p.profile_key.toLowerCase() === profileKey.toLowerCase()) ||
      (profileKey && p.display_name.toLowerCase().includes(profileKey.toLowerCase())) ||
      (profileName && p.display_name.toLowerCase().includes(profileName.toLowerCase())) ||
      (profileName && profileName.toLowerCase().includes(p.display_name.toLowerCase()))
  );
  if (match) return match.profile_key;

  return 'Profile 2';
}

let lastLaunchedProfile = '';
let lastLaunchTime = 0;

function launchChromeProfileOnce(resolvedKey, targetUrls = []) {
  const now = Date.now();
  const firstUrl = Array.isArray(targetUrls) ? targetUrls[0] : (targetUrls || '');
  if (lastLaunchedProfile === resolvedKey && (now - lastLaunchTime < 3000)) {
    activateChromeProfile(resolvedKey, firstUrl);
    return Promise.resolve(true);
  }
  lastLaunchedProfile = resolvedKey;
  lastLaunchTime = now;

  return new Promise((resolve) => {
    console.log(`[COMPANION] Launching/Focusing Chrome for profile "${resolvedKey}"...`);
    activateChromeProfile(resolvedKey, firstUrl);
    setTimeout(() => {
      resolve(true);
    }, 350);
  });
}

function focusChromeProfile(profileKey, targetUrl = '') {
  const resolvedKey = normalizeProfileKey(profileKey);
  console.log(`[COMPANION] Focusing Chrome profile: "${resolvedKey}" (target: "${targetUrl || ''}")`);
  activateChromeProfile(resolvedKey, targetUrl);
  return Promise.resolve(true);
}

function openChromeUrl(profileKey, targetURL) {
  return new Promise((resolve, reject) => {
    const resolvedKey = normalizeProfileKey(profileKey);
    const urls = Array.isArray(targetURL) ? targetURL : [targetURL || 'https://chatgpt.com/'];
    console.log(`[COMPANION] Opening URLs in profile "${resolvedKey}":`, urls);

    // Focus this profile directly with the target URL
    activateChromeProfile(resolvedKey, urls[0]);
    pushPendingCommand({
      action: 'OPEN_URL',
      payload: { url: urls[0], profileKey: resolvedKey },
      created_at: new Date().toISOString(),
    });
    return resolve(true);
  });
}

let lastFocusTabGroupTime = 0;
let lastFocusTabGroupKey = '';

function openOrFocusChromeTabs(profileKey, groupName, targetUrls) {
  const resolvedKey = normalizeProfileKey(profileKey);
  console.log(`[COMPANION] openOrFocusChromeTabs: profile="${resolvedKey}", group="${groupName}"`);
  if (isChromeProfileOpen(resolvedKey)) {
    activateChromeWindow(null, (Array.isArray(targetUrls) ? targetUrls[0] : targetUrls) || '', '', resolvedKey);
    return Promise.resolve(true);
  }
  return launchChromeProfileOnce(resolvedKey, targetUrls);
}

function focusChromeTabGroup(profileKey, groupName, tabId, defaultUrl, explicitTabUrls, force, tabMode = 'existing_tabs', workerCount = 4, reuseSessionTabs = true) {
  const resolvedKey = normalizeProfileKey(profileKey);
  const isHero = (groupName || '').toLowerCase().includes('hero');
  const count = Math.max(1, Math.min(8, parseInt(workerCount, 10) || (isHero ? 1 : 4)));
  const isNewTabsMode = tabMode === 'new_tabs' || tabMode === 'open_fresh';
  const now = Date.now();
  const cacheKey = `${resolvedKey}-${groupName}-${tabMode}-${count}`;
  const shouldSkipWindowLaunch = (!force && cacheKey === lastFocusTabGroupKey && (now - lastFocusTabGroupTime < 2500));
  lastFocusTabGroupTime = now;
  lastFocusTabGroupKey = cacheKey;

  return new Promise(async (resolve) => {
    console.log(`[COMPANION] Auto-focusing Chrome profile "${resolvedKey}" & Tab Group "${groupName}" (mode: ${tabMode}, workers: ${count})...`);

    // 1. Determine all distinct tab URLs for this group
    let groupTabUrls = [];
    let targetUrl = 'https://chatgpt.com/';

    if (isNewTabsMode) {
      // Open fresh clean ChatGPT tabs
      groupTabUrls = Array(count).fill('https://chatgpt.com/');
      targetUrl = 'https://chatgpt.com/';
    } else {
      if (Array.isArray(explicitTabUrls) && explicitTabUrls.length > 0) {
        // Filter out stale chat UUIDs from other profiles
        groupTabUrls = explicitTabUrls.filter((u) => {
          if (!u) return false;
          if (resolvedKey !== 'Profile 2' && (u.includes('6ad49918') || u.includes('6ad49924') || u.includes('6ad4992a') || u.includes('6ad4992b'))) {
            return false;
          }
          return true;
        });
      }

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

      // Ensure full count of tabs
      while (groupTabUrls.length < count) {
        groupTabUrls.push('https://chatgpt.com/');
      }
      if (groupTabUrls.length > count) {
        groupTabUrls = groupTabUrls.slice(0, count);
      }
      targetUrl = groupTabUrls[0] || 'https://chatgpt.com/';
    }

    // 2. Queue command for Chrome Extension to expand and focus all tabs in group
    pushPendingCommand({
      action: 'FOCUS_GROUP',
      payload: { groupName, tabId, profileKey: resolvedKey, targetUrl, groupTabUrls, tabMode, workerCount: count, reuseSessionTabs },
      created_at: new Date().toISOString(),
    });

    // 3. Activate window specifically for this profile with all worker tab URLs
    activateChromeProfile(resolvedKey, groupTabUrls);
    resolve(true);
  });
}

function verifyChromeTabsOpen(profileKey, groupName, expectedUrls = [], tabMode = 'existing_tabs', workerCount = 4) {
  return new Promise((resolve) => {
    const effectiveCount = Math.max(1, Math.min(8, parseInt(workerCount, 10) || 4));
    let targets = (expectedUrls || []).filter(Boolean);
    if (targets.length === 0) {
      targets = Array(effectiveCount).fill('https://chatgpt.com/');
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
      activateChromeProfile(profileKey);
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
function watchSingleDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  console.log(`[COMPANION] Monitoring directory: ${dirPath}`);
  try {
    fs.watch(dirPath, (eventType, filename) => {
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

      const fullPath = path.join(dirPath, filename);
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
  } catch (err) {
    console.warn(`[COMPANION] Could not watch directory ${dirPath}:`, err.message);
  }
}

function startDownloadWatcher() {
  watchSingleDir(activeWatchDir);
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  if (downloadsDir !== activeWatchDir) {
    watchSingleDir(downloadsDir);
  }
}

function handleDetectedDownload(filePath, fileName, size) {
  try {
    const fileBuf = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');
    console.log(`[COMPANION] Validated download: ${fileName} (${size} bytes, sha256: ${hash.slice(0, 12)})`);

    // If this is a Hero image download (or twoStageState is active), attach data URL so the workflow receives the local downloaded file
    if (fileName.toLowerCase().startsWith('fb_hero') || (twoStageState && (twoStageState.is_running || twoStageState.step === 'completed' || twoStageState.step === 'downloading_image'))) {
      const ext = path.extname(fileName).toLowerCase().replace('.', '') || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = `data:${mime};base64,${fileBuf.toString('base64')}`;
      const imageUrl = `http://127.0.0.1:${PORT}/hero-downloaded-image?file=${encodeURIComponent(fileName)}&t=${Date.now()}`;
      twoStageState = {
        ...(twoStageState || {}),
        downloaded_file: fileName,
        downloaded_file_path: filePath,
        downloaded_data_url: dataUrl,
        downloaded_image_url: imageUrl,
        result_url: imageUrl,
        updated_at: new Date().toISOString(),
      };
      console.log(`[COMPANION] 🎉 Hero image attached to twoStageState: ${fileName} -> ${imageUrl}`);
    }

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
    return String(str)
      .split('\n')[0]
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^(condo name|project name|condominium|project|ชื่อโครงการ|โครงการ|ให้เช่า|เช่า|ขาย|คอนโด|for rent|for sale|\(owner post\)|owner post)[\s:：\-–—]*/i, '')
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
      .replace(/^(condo name|project name|condominium|project|ชื่อโครงการ|โครงการ|ให้เช่า|เช่า|ขาย|คอนโด|for rent|for sale|\(owner post\)|owner post)[\s:：\-–—]*/i, '')
      .replace(/[:\/_,\.\(\)\[\]"'`\*#•\-\u2010-\u2015\u2212]/g, ' ')
      .replace(/\bon\s+nut\b/g, 'onnut')
      .replace(/\bhuai\s+kh?wang\b/g, 'huaikhwang')
      .replace(/\blat\s+phrao\b/g, 'ladprao')
      .replace(/\bphrama\b/g, 'rama')
      .replace(/\bsrinagarindra\b/g, 'srinakarin')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findCondoDirectory(query, customBaseDir) {
    const baseDir = (customBaseDir && fs.existsSync(customBaseDir)) ? customBaseDir : CONDO_BASE_DIR;
    if (!fs.existsSync(baseDir)) return null;
    const dirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const rawTrimmed = String(query || '').trim();
    if (!rawTrimmed || rawTrimmed.toLowerCase() === 'featured property listing' || rawTrimmed.toLowerCase() === 'not_found') {
      return null;
    }

    // 0. Direct exact folder name match
    const exactRaw = dirs.find((d) => d.trim().toLowerCase() === rawTrimmed.toLowerCase());
    if (exactRaw) return exactRaw;

    const normQ = normalizeCondoName(rawTrimmed);
    if (!normQ) return null;
    const compactQ = normQ.replace(/\s+/g, '');

    // 1. Exact normalized or compact match
    for (const d of dirs) {
      const nd = normalizeCondoName(d);
      if (nd === normQ || (compactQ.length >= 4 && nd.replace(/\s+/g, '') === compactQ)) {
        return d;
      }
    }

    // 2. Scored substring & token similarity match (picks the closest/most specific match)
    const qTokens = normQ.split(' ').filter((t) => t.length >= 2);
    let best = null;
    let bestScore = 0;

    for (const d of dirs) {
      const nd = normalizeCondoName(d);
      if (!nd) continue;
      const dTokens = nd.split(' ').filter((t) => t.length >= 2);
      let score = 0;

      // Full phrase containment bonus
      if (nd.includes(normQ) || normQ.includes(nd)) {
        score += 5;
      }

      // Token match scoring (exact token + prefix/substring token similarity)
      for (const qt of qTokens) {
        if (dTokens.includes(qt)) {
          score += 3;
        } else if (qt.length >= 3 && dTokens.some((dt) => dt.includes(qt) || qt.includes(dt))) {
          score += 1.5;
        }
      }

      // Penalize extra unmatched words slightly so specific matches win over generic ones
      const extraTokens = Math.abs(dTokens.length - qTokens.length);
      const finalScore = score - extraTokens * 0.15;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        best = d;
      }
    }

    const minRequired = qTokens.length === 1 ? 2.5 : 3.5;
    return bestScore >= minRequired ? best : null;
  }

  function extractCondoImages123(folderPath) {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const subDirs = entries
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => path.join(folderPath, d.name));

    const toImageEntry = (filePath, filename, num) => {
      const ext = path.extname(filename).toLowerCase().replace('.', '') || 'png';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const fileBuf = fs.readFileSync(filePath);
      const b64 = fileBuf.toString('base64');
      return {
        index: num,
        filename,
        mime_type: mime,
        full_path: filePath,
        size_bytes: fileBuf.length,
        data_url: `data:${mime};base64,${b64}`,
      };
    };

    const imagesBySlot = new Map();
    const usedPaths = new Set();

    // 1. Check root folder for 1.(png|jpg|jpeg|webp), 2.(...), 3.(...)
    [1, 2, 3].forEach((num) => {
      const match = entries.find(
        (f) => f.isFile() && new RegExp(`^0?${num}\\.(png|jpg|jpeg|webp)$`, 'i').test(f.name)
      );
      if (match) {
        const fp = path.join(folderPath, match.name);
        imagesBySlot.set(num, toImageEntry(fp, match.name, num));
        usedPaths.add(fp);
      }
    });

    // 2. If any slot 1, 2, 3 is missing in root, check immediate subfolders (e.g. watermark/) for 1.png, 2.png, 3.png
    if (imagesBySlot.size < 3 && subDirs.length > 0) {
      [1, 2, 3].forEach((num) => {
        if (imagesBySlot.has(num)) return;
        for (const sd of subDirs) {
          try {
            const subEntries = fs.readdirSync(sd, { withFileTypes: true });
            const match = subEntries.find(
              (f) => f.isFile() && new RegExp(`^0?${num}\\.(png|jpg|jpeg|webp)$`, 'i').test(f.name)
            );
            if (match) {
              const fp = path.join(sd, match.name);
              imagesBySlot.set(num, toImageEntry(fp, match.name, num));
              usedPaths.add(fp);
              break;
            }
          } catch (e) {}
        }
      });
    }

    // 3. Fallback: fill any remaining empty slots (1, 2, 3) from top image files in the condo folder
    if (imagesBySlot.size < 3) {
      const validRootImages = entries
        .filter((f) => f.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(f.name) && !f.name.startsWith('.'))
        .map((f) => ({ name: f.name, fullPath: path.join(folderPath, f.name) }))
        .filter((f) => !usedPaths.has(f.fullPath));

      let fallbackIdx = 0;
      [1, 2, 3].forEach((num) => {
        if (!imagesBySlot.has(num) && fallbackIdx < validRootImages.length) {
          const picked = validRootImages[fallbackIdx++];
          imagesBySlot.set(num, toImageEntry(picked.fullPath, picked.name, num));
          usedPaths.add(picked.fullPath);
        }
      });
    }

    return [1, 2, 3].map((n) => imagesBySlot.get(n)).filter(Boolean);
  }

  // Native macOS folder chooser dialog via osascript
  if (url.pathname === '/choose-folder' && (req.method === 'POST' || req.method === 'GET')) {
    try {
      const defaultLoc = url.searchParams.get('default') || url.searchParams.get('folder') || CONDO_BASE_DIR;
      const validLoc = (defaultLoc && fs.existsSync(defaultLoc)) ? defaultLoc : CONDO_BASE_DIR;
      const appleScript = validLoc && fs.existsSync(validLoc)
        ? `try
             POSIX path of (choose folder default location POSIX file "${validLoc}" with prompt "Select Condo Folder")
           on error
             return ""
           end try`
        : `try
             POSIX path of (choose folder with prompt "Select Condo Folder")
           on error
             return ""
           end try`;
      execFile('osascript', ['-e', appleScript], (err, stdout) => {
        if (err) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ status: 'cancelled', error: err.message }));
        }
        const selectedPath = (stdout || '').trim().replace(/\/$/, '');
        if (!selectedPath) {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ status: 'cancelled' }));
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          status: 'success',
          selected_path: selectedPath,
          folder_path: selectedPath,
          folder_name: path.basename(selectedPath),
        }));
      });
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ status: 'error', message: e.message }));
    }
    return;
  }

  if (url.pathname === '/condo-images') {
    const handleCondoRequest = (condoName, customBaseDir, customFolderPath) => {
      try {
        const baseDir = (customBaseDir && fs.existsSync(customBaseDir)) ? customBaseDir : CONDO_BASE_DIR;
        let folderPath = '';
        let matchedDir = '';

        if (customFolderPath && fs.existsSync(customFolderPath)) {
          folderPath = customFolderPath;
          matchedDir = path.basename(customFolderPath);
        } else if (condoName && baseDir && fs.existsSync(path.join(baseDir, condoName))) {
          matchedDir = condoName;
          folderPath = path.join(baseDir, condoName);
        } else {
          if (!fs.existsSync(baseDir)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'error', message: `Condo directory not found: ${baseDir}`, base_dir: baseDir }));
          }

          matchedDir = findCondoDirectory(condoName, baseDir);
          if (!matchedDir) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              status: 'error',
              message: `No matching condo directory found for "${condoName}" in ${baseDir}`,
              base_dir: baseDir,
            }));
          }
          folderPath = path.join(baseDir, matchedDir);
        }

        const images = extractCondoImages123(folderPath);

        // Also extract all available image files in this condo folder (so user can pick/swap/replace any of the 3 slots)
        let availableImages = [];
        try {
          const allEntries = fs.readdirSync(folderPath, { withFileTypes: true });
          availableImages = allEntries
            .filter((f) => f.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(f.name) && !f.name.startsWith('.'))
            .map((f, i) => {
              const fp = path.join(folderPath, f.name);
              const ext = path.extname(f.name).toLowerCase().replace('.', '') || 'png';
              const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              const fileBuf = fs.readFileSync(fp);
              return {
                id: `avail-${i + 1}`,
                filename: f.name,
                mime_type: mime,
                full_path: fp,
                size_bytes: fileBuf.length,
                data_url: `data:${mime};base64,${fileBuf.toString('base64')}`,
              };
            });
        } catch (scanErr) {
          console.warn('[COMPANION] Error reading available images in folder:', scanErr);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'success',
          condo_query: condoName || matchedDir,
          matched_folder: matchedDir,
          folder_path: folderPath,
          base_dir: baseDir,
          images_found: images.length,
          images: images,
          available_images: availableImages,
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
          handleCondoRequest(
            parsed.condo_name || parsed.condoName || parsed.title || '',
            parsed.base_dir || parsed.target_folder,
            parsed.folder_path || parsed.folderPath
          );
        } catch (e) {
          handleCondoRequest('');
        }
      });
      return;
    } else {
      const q = url.searchParams.get('condo_name') || url.searchParams.get('condoName') || url.searchParams.get('q') || '';
      const customBase = url.searchParams.get('base_dir') || url.searchParams.get('target_folder') || '';
      const customFolder = url.searchParams.get('folder_path') || url.searchParams.get('folderPath') || '';
      return handleCondoRequest(q, customBase, customFolder);
    }
  }

  // Preview all indexed condo directories
  if ((url.pathname === '/scan-condos' || url.pathname === '/condo-folders') && (req.method === 'GET' || req.method === 'POST')) {
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
      total_condos: dirs.length,
      folders: dirs,
      base_dir: baseDir,
    }));
  }

  // ── Open Folder directly in macOS Finder ──
  if ((url.pathname === '/open-folder' || url.pathname === '/reveal-folder')) {
    const handleOpen = (targetPath) => {
      const folderToOpen = targetPath || CONDO_BASE_DIR;
      if (folderToOpen && fs.existsSync(folderToOpen)) {
        try {
          execSync(`open "${folderToOpen}" 2>/dev/null`);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ status: 'ok', folder: folderToOpen }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ status: 'error', message: e.message }));
        }
      }
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Folder not found', folder: folderToOpen }));
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          handleOpen(parsed.folder || parsed.path || url.searchParams.get('folder') || url.searchParams.get('path'));
        } catch (e) {
          handleOpen(url.searchParams.get('folder') || url.searchParams.get('path'));
        }
      });
      return;
    } else {
      return handleOpen(url.searchParams.get('folder') || url.searchParams.get('path'));
    }
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
        await focusChromeProfile(profileKey, payload.url || 'https://chatgpt.com/');
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
        const profileKey = payload.profile_key || (registeredProfiles[0]?.profileKey) || 'Pro';
        const groupName = payload.group_name || 'Enhance Image';
        const tabId = payload.tab_id || '';
        const groupTabUrls = payload.group_tab_urls || payload.groupTabUrls || [];
        const defaultUrl = payload.url || payload.default_url || (groupTabUrls[0] || 'https://chatgpt.com/');
        const force = !!payload.force;
        const tabMode = payload.tab_mode || 'existing_tabs';
        const isHero = (groupName || '').toLowerCase().includes('hero');
        const workerCount = parseInt(payload.worker_count, 10) || (isHero ? 1 : 4);
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
          const profileKey = payload.profile_key || payload.profileKey || (registeredProfiles[0]?.profileKey) || 'Pro';
          const groupName = payload.group_name || payload.groupName || 'Enhance Image';
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
      const profileKey = url.searchParams.get('profile_key') || (registeredProfiles[0]?.profileKey) || 'Pro';
      const groupName = url.searchParams.get('group_name') || 'Enhance Image';
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

        let { profile_key, tab_ids, jobs, property_id, listing_code } = payload;
        const safeListingCode = listing_code || payload.listingCode || (payload.property_metadata && payload.property_metadata.listing_code) || '';
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
        const resolvedProf = normalizeProfileKey(profile_key);
        let safeGroupTabUrls = payload.group_tab_urls || payload.groupTabUrls || [];
        if (Array.isArray(safeGroupTabUrls) && safeGroupTabUrls.length > 0) {
          safeGroupTabUrls = safeGroupTabUrls.filter((u) => {
            if (!u) return false;
            if (resolvedProf !== 'Profile 2' && (u.includes('6ad49918') || u.includes('6ad49924') || u.includes('6ad4992a') || u.includes('6ad4992b'))) {
              return false;
            }
            return true;
          });
        }
        if (!safeGroupTabUrls || safeGroupTabUrls.length === 0) {
          safeGroupTabUrls = [
            'https://chatgpt.com/',
            'https://chatgpt.com/',
            'https://chatgpt.com/',
            'https://chatgpt.com/',
          ];
        }

        const effectiveCount = payload.worker_count || payload.workerCount || safeTabIds.length || 4;
        while (safeGroupTabUrls.length < effectiveCount) {
          safeGroupTabUrls.push('https://chatgpt.com/');
        }

        // Store the pending command for the extension to pick up when it polls.
        pushPendingCommand({
          action: 'START_AUTOMATION',
          payload: {
            profileKey: resolvedProf,
            tabIds: safeTabIds,
            jobs: (jobs || []).map((j) => ({
              ...j,
              listing_code: j.listing_code || safeListingCode,
            })),
            listingCode: safeListingCode,
            propertyId: property_id,
            groupName: payload.group_name || payload.groupName || 'Enhance IMG',
            groupTabUrls: safeGroupTabUrls,
            tabMode: payload.tab_mode || payload.tabMode || 'existing_tabs',
            workerCount: effectiveCount,
            reuseSessionTabs: payload.reuse_session_tabs !== undefined ? payload.reuse_session_tabs : (payload.reuseSessionTabs !== undefined ? payload.reuseSessionTabs : true),
          },
          created_at: new Date().toISOString(),
        });

        // Bring Chrome window to front to trigger tab activation and extension wake-up
        activateChromeProfile(resolvedProf, safeGroupTabUrls);

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

  // ── Save Generated Image Directly to Disk ──────────────────────────────────
  if (url.pathname === '/save-generated-image' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const imageUrl = payload.url || '';
        const filename = (payload.filename || `fb_hero_${Date.now()}.png`).replace(/[\/\\]/g, '_').trim();
        const condoName = payload.condo_name || '';

        if (!imageUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing image url' }));
        }

        console.log(`[COMPANION] 📥 Direct save request for generated image: ${filename} (URL: ${imageUrl.slice(0, 80)}...)`);

        // Target directories: ~/Downloads and Processing directory
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        const downloadFilePath = path.join(downloadsDir, filename);
        const processingFilePath = path.join(defaultProcessingDir, filename);

        let buffer = null;
        if (imageUrl.startsWith('data:')) {
          const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
          buffer = Buffer.from(base64Data, 'base64');
        } else if (imageUrl.startsWith('http:') || imageUrl.startsWith('https:')) {
          buffer = await new Promise((resolve, reject) => {
            const https = require('https');
            const httpMod = imageUrl.startsWith('https:') ? https : http;
            httpMod.get(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (resp) => {
              if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
                httpMod.get(resp.headers.location, (redResp) => {
                  const chunks = [];
                  redResp.on('data', (c) => chunks.push(c));
                  redResp.on('end', () => resolve(Buffer.concat(chunks)));
                  redResp.on('error', reject);
                });
                return;
              }
              const chunks = [];
              resp.on('data', (c) => chunks.push(c));
              resp.on('end', () => resolve(Buffer.concat(chunks)));
              resp.on('error', reject);
            }).on('error', reject);
          }).catch((err) => {
            console.warn('[COMPANION] HTTP image buffer fetch warning:', err.message);
            return null;
          });
        }

        if (buffer && buffer.length > 0) {
          try { fs.writeFileSync(downloadFilePath, buffer); } catch (e) {}
          try { fs.writeFileSync(processingFilePath, buffer); } catch (e) {}
          console.log(`[COMPANION] ✓ Saved generated image to disk:\n  - ${downloadFilePath} (${buffer.length} bytes)\n  - ${processingFilePath}`);

          // Update twoStageState so UI instantly marks step as completed
          twoStageState = {
            ...twoStageState,
            is_running: false,
            step: 'completed',
            result_url: imageUrl,
            downloaded_file: filename,
            updated_at: new Date().toISOString(),
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            status: 'success',
            download_path: downloadFilePath,
            processing_path: processingFilePath,
            size: buffer.length,
          }));
        } else {
          throw new Error('Empty image buffer received');
        }
      } catch (err) {
        console.warn('[COMPANION] Error saving generated image directly:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── Stop Automation ─────────────────────────────────────────────────────────
  if (url.pathname === '/stop-automation' && req.method === 'POST') {
    pendingAutomationCommands = [];
    automationState = {
      ...automationState,
      is_running: false,
      updated_at: new Date().toISOString(),
    };
    twoStageState = {
      ...twoStageState,
      is_running: false,
      step: 'stopped',
      error: 'Stopped by user',
      updated_at: new Date().toISOString(),
    };
    pushPendingCommand({ action: 'STOP_AUTOMATION', payload: {}, created_at: new Date().toISOString() });
    console.log('[COMPANION] Stop automation command queued (cleared pending queue and stopped twoStageState)');
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

  if (url.pathname === '/test-attach' && req.method === 'GET') {
    global.lastInspectResult = null;
    pushPendingCommand({ action: 'TEST_ATTACH', payload: {}, created_at: new Date().toISOString() });
    console.log('[COMPANION] Test Attach command queued');
    let attempts = 0;
    while (attempts < 60 && !global.lastInspectResult) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
    const result = global.lastInspectResult || { error: 'Timeout waiting for test attach result' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  }

  if (url.pathname === '/test-send' && req.method === 'GET') {
    global.lastInspectResult = null;
    pushPendingCommand({ action: 'TEST_SETUP_AND_SEND', payload: {}, created_at: new Date().toISOString() });
    console.log('[COMPANION] Test Setup & Send command queued');
    let attempts = 0;
    while (attempts < 100 && !global.lastInspectResult) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
    const result = global.lastInspectResult || { error: 'Timeout waiting for test setup & send result' };
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

  function getGeminiApiKey() {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    if (process.env.GOOGLE_AI_API_KEY) return process.env.GOOGLE_AI_API_KEY;
    try {
      const envPath = path.join(__dirname, '..', '..', '.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const m = content.match(/^(?:GEMINI_API_KEY|GOOGLE_AI_API_KEY)=(.*)$/m);
        if (m && m[1]) return m[1].trim();
      }
    } catch (_) {}
    return '';
  }

  // ── High-Speed Native Gemini AI Copywriter ──────────────────────────────────
  if (url.pathname === '/generate-ai' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const key = payload.apiKey || payload.api_key || getGeminiApiKey();
        let model = payload.model || 'gemini-flash-lite-latest';
        if (model.includes('gemini-2.5') || model.includes('gemini-2.0') || model.includes('gemini-1.5')) {
          model = 'gemini-flash-lite-latest';
        }
        let prompt = payload.prompt || payload.template_text || payload.custom_prompt || '';
        const rawContent = payload.rawContent || payload.raw_content || '';
        const listingCode = payload.listingCode || payload.listing_code || '';

        if (listingCode) {
          const placeholderRegex =
            /\[(?:NEW\s+)?(?:RANDOM\s+)?CODE\]|\[(?:NEW\s+)?(?:GENERATED\s+)?CODE\]|\[(?:LISTING|PROPERTY)\s*CODE\]|\[(?:LISTING\s*ID|REF|CODE_FORMAT)\]|\{(?:NEW\s+)?(?:RANDOM\s+)?CODE\}|\{(?:LISTING|PROPERTY)\s*CODE\}|\<(?:NEW\s+)?(?:RANDOM\s+)?CODE\>|\[(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)\]|\{(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)\}|<(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)>/gi;
          prompt = prompt.replace(placeholderRegex, listingCode);

          prompt = prompt.replace(
            /((?:•\s*)?(?:Property\s*Code|Listing\s*Code|Unit\s*Code|Code|Ref|Listing\s*ID):\s*)(?:\[[^\]\r\n]*\]|N\/A|null|none|\.{3}|—|-)/gi,
            `$1${listingCode}`
          );

          prompt = prompt.replace(
            /(?:Always\s+include\s+one\s+newly\s+generated\s+property\s+code\.?)/gi,
            `Always use the authorized property code "${listingCode}". Do not invent or generate a different code.`
          );

          if (/(?:Property\s*Code|Listing\s*Code|Listing\s*ID|\bCode\b)/i.test(prompt)) {
            prompt = `${prompt}\n\n[Property Code Requirement: The authorized unique code for this listing is "${listingCode}". Whenever "Property Code" or "Code" is output, strictly use "${listingCode}". Do not generate or invent a different code.]`;
          }
        }

        const fullPrompt = `${prompt}\n\n=== SOURCE PROPERTY CONTENT ===\n${rawContent}`;
        const isJSONRequest = prompt.includes('JSON') || prompt.includes('headers') || prompt.includes('spreadsheet') || prompt.includes('parseable');

        let initialModel = payload.model || 'gemini-flash-lite-latest';
        if (initialModel.includes('gemini-2.5') || initialModel.includes('gemini-2.0') || initialModel.includes('gemini-1.5')) {
          initialModel = 'gemini-flash-lite-latest';
        }

        const modelsToTry = [initialModel, 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest']
          .filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);

        let generatedText = null;
        let lastError = null;

        for (const candidateModel of modelsToTry) {
          try {
            const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${key}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000);

            const aiResp = await fetch(geminiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: isJSONRequest ? `${prompt}\n\n=== CONTENT ===\n${rawContent}` : fullPrompt }] }],
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);

            const data = await aiResp.json();
            if (aiResp.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
              generatedText = data.candidates[0].content.parts[0].text.trim();
              console.log(`[COMPANION] /generate-ai succeeded with model: ${candidateModel}`);
              break;
            } else {
              lastError = data.error?.message || `HTTP ${aiResp.status}`;
              console.warn(`[COMPANION] /generate-ai model ${candidateModel} failed: ${lastError}`);
            }
          } catch (modelErr) {
            lastError = modelErr.message;
            console.warn(`[COMPANION] /generate-ai model ${candidateModel} error: ${modelErr.message}`);
          }
        }

        if (generatedText) {
          if (listingCode) {
            const placeholderRegex =
              /\[(?:NEW\s+)?(?:RANDOM\s+)?CODE\]|\[(?:NEW\s+)?(?:GENERATED\s+)?CODE\]|\[(?:LISTING|PROPERTY)\s*CODE\]|\[(?:LISTING\s*ID|REF|CODE_FORMAT)\]|\{(?:NEW\s+)?(?:RANDOM\s+)?CODE\}|\{(?:LISTING|PROPERTY)\s*CODE\}|\<(?:NEW\s+)?(?:RANDOM\s+)?CODE\>|\[(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)\]|\{(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)\}|<(?:CODE|LISTING\s*CODE|LISTING\s*ID|PROPERTY\s*CODE|REF|CODE_FORMAT)>/gi;
            generatedText = generatedText.replace(placeholderRegex, listingCode);

            const propertyCodeLineRegex = /((?:•\s*)?(?:Property\s*Code|Listing\s*Code|Unit\s*Code):\s*)([^\r\n]+)/gi;
            generatedText = generatedText.replace(propertyCodeLineRegex, (match, prefix) => {
              return `${prefix}${listingCode}`;
            });

            generatedText = generatedText.replace(/(?:Code|Listing\s*Code|Listing\s*ID|Ref):\s*\[?(?:N\/A|null|none|\.{3}|—|-)\]?/gi, `Code: ${listingCode}`);
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: true, generated_content: generatedText }));
        }

        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: lastError || 'AI generation failed' }));
      } catch (err) {
        console.warn('[COMPANION] /generate-ai fallback notice:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          success: false,
          error: err.message,
        }));
      }
    });
    return;
  }

  // ── Proxy Image (bypass CORS & referer blocks from CDNs) ───────────────────
  if (url.pathname === '/proxy-image' && req.method === 'GET') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }
    try {
      const client = targetUrl.startsWith('https') ? https : http;
      const proxyReq = client.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        }
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
        });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: err.message }));
      });
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── Reload Extension ─────────────────────────────────────────────────────────
  if (url.pathname === '/reload-extension' && req.method === 'POST') {
    pushPendingCommand({ action: 'RELOAD_EXTENSION', payload: {}, created_at: new Date().toISOString() });
    console.log('[COMPANION] Reload extension command queued');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', message: 'Reload queued' }));
  }

  // ── Persistent Reference Image Storage (GET / POST / DELETE) ───────────────
  if (url.pathname === '/reference-image') {
    if (req.method === 'GET') {
      const refImg = loadPersistedReferenceImageFromDisk();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', reference_image: refImg || '' }));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (payload.reference_image) {
            savePersistedReferenceImageToDisk(payload.reference_image, payload.box_id || '');
            console.log(`[COMPANION] 🖼️ Saved persistent FB Hero Reference Image (${Math.round(payload.reference_image.length / 1024)} KB)`);
          } else {
            deletePersistedReferenceImageFromDisk();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'ok' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      deletePersistedReferenceImageFromDisk();
      console.log('[COMPANION] 🗑️ Cleared persistent FB Hero Reference Image');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok' }));
    }
  }

  // ── Two-Stage / Direct Staging Automation (FB Hero) ──
  if (url.pathname === '/start-two-stage-staging' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const profileKey = payload.profile_key || (registeredProfiles[0]?.profileKey) || 'Pro';
        const groupName = payload.group_name || 'BG Hero Generate';
        const condoName = payload.condo_name || payload.title || '';
        const initialPrompt = payload.initial_prompt || payload.prompt || '';
        const useRef = payload.use_reference_image !== false;
        if (payload.reference_image && typeof payload.reference_image === 'string') {
          savePersistedReferenceImageToDisk(payload.reference_image, payload.box_id || '');
        }
        const referenceImage = useRef
          ? (payload.reference_image || loadPersistedReferenceImageFromDisk() || null)
          : null;
        const useCondoImgs = payload.use_condo_images !== false;
        const customBase = payload.target_folder || payload.base_dir;
        const baseDir = (customBase && fs.existsSync(customBase)) ? customBase : CONDO_BASE_DIR;
        const skipTab1 = !!payload.skip_tab1 || payload.staging_mode === 'direct_tab2' || payload.worker_count === 1;
        const tabMode = payload.tab_mode || payload.worker_tab_mode || 'existing_tabs';
        const workerCount = skipTab1 ? 1 : (parseInt(payload.worker_count, 10) || 2);
        const reuseSessionTabs = payload.reuse_session_tabs !== false;

        // Ensure the connected Chrome Profile is open and focused with the right tab count (1 for Direct, 2 for 2-Stage)
        const resolvedProfileKey = normalizeProfileKey(profileKey);
        activateChromeProfile(resolvedProfileKey, 'https://chatgpt.com/');

        // Read local condo images 1, 2, 3 (Strictly Read-Only!)
        let condoImages = Array.isArray(payload.condo_images) && payload.condo_images.length > 0
          ? payload.condo_images
          : [];
        let matchedDir = payload.matched_folder || '';
        if (condoImages.length === 0 && useCondoImgs && condoName && fs.existsSync(baseDir)) {
          matchedDir = findCondoDirectory(condoName, baseDir);
          if (matchedDir) {
            const folderPath = path.join(baseDir, matchedDir);
            condoImages = extractCondoImages123(folderPath).map((img) => ({
              index: img.index,
              filename: img.filename,
              data_url: img.data_url,
            }));
          }
        }

        console.log(`[COMPANION] 🚀 Staging Command Prepared for "${condoName}":`);
        console.log(`  - Reference image present: ${!!referenceImage}`);
        console.log(`  - Condo images count: ${condoImages.length} (${condoImages.map((i) => i.filename || i.index).join(', ')})`);
        console.log(`  - Matched directory: ${matchedDir || 'none'}`);
        console.log(`  - Direct Staging (1 tab): ${skipTab1}`);

        twoStageState = {
          is_running: true,
          step: 'starting',
          condo_name: condoName,
          matched_folder: matchedDir || 'not found',
          images_attached: (referenceImage ? 1 : 0) + condoImages.length,
          extracted_prompt: '',
          result_url: '',
          downloaded_file: '',
          error: null,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        pushPendingCommand({
          action: 'START_TWO_STAGE_STAGING',
          payload: {
            profileKey: resolvedProfileKey,
            groupName,
            initialPrompt,
            referenceImage, // 1st: manual reference image
            condoImages,    // 2nd: 1.png, 2.png, 3.png
            condoName,
            matchedFolder: matchedDir,
            skipTab1,
            tabMode,
            workerCount,
            reuseSessionTabs,
          },
          created_at: new Date().toISOString(),
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          message: `${skipTab1 ? 'Direct (1-Tab)' : 'Two-stage (2-Tab)'} Hero generation initiated for "${condoName}" in group "${groupName}"`,
          matched_folder: matchedDir,
          images_count: condoImages.length,
          reference_image_present: !!referenceImage,
          tabs_used: workerCount,
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
    if (req.method === 'DELETE') {
      twoStageState = null;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ status: 'cleared', state: null }));
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const update = JSON.parse(body || '{}');
          twoStageState = { ...twoStageState, ...update, updated_at: new Date().toISOString() };

          // If downloaded_file is provided, resolve it
          const rawFile = update.downloaded_file || twoStageState?.downloaded_file;
          if (rawFile) {
            const safeName = path.basename(rawFile);
            const downloadsDir = path.join(os.homedir(), 'Downloads');
            const targetPath = path.join(downloadsDir, safeName);
            if (fs.existsSync(targetPath)) {
              twoStageState.downloaded_file = safeName;
              twoStageState.downloaded_file_path = targetPath;
              twoStageState.downloaded_image_url = `http://127.0.0.1:${PORT}/hero-downloaded-image?file=${encodeURIComponent(safeName)}&t=${Date.now()}`;
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'ok', twoStageState }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    } else {
      // GET request
      const reqCondo = (url.searchParams.get('condo') || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (twoStageState && twoStageState.downloaded_file) {
        const safeName = path.basename(twoStageState.downloaded_file);
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        const targetPath = path.join(downloadsDir, safeName);
        if (fs.existsSync(targetPath)) {
          twoStageState.downloaded_file_path = targetPath;
          twoStageState.downloaded_image_url = `http://127.0.0.1:${PORT}/hero-downloaded-image?file=${encodeURIComponent(safeName)}`;
        }
      } else if (reqCondo) {
        // Fallback: check matching fb_hero for THIS specific condo in Downloads
        try {
          const downloadsDir = path.join(os.homedir(), 'Downloads');
          const heroFiles = fs.readdirSync(downloadsDir)
            .filter((f) => {
              const lower = f.toLowerCase();
              const sanitized = lower.replace(/[^a-z0-9]/g, '');
              return lower.startsWith('fb_hero') && lower.endsWith('.png') && sanitized.includes(reqCondo);
            })
            .map((f) => ({ name: f, path: path.join(downloadsDir, f), mtime: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
          if (heroFiles.length > 0) {
            twoStageState = {
              ...(twoStageState || {}),
              downloaded_file: heroFiles[0].name,
              downloaded_file_path: heroFiles[0].path,
              downloaded_image_url: `http://127.0.0.1:${PORT}/hero-downloaded-image?file=${encodeURIComponent(heroFiles[0].name)}`,
            };
          }
        } catch (e) {}
      }

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ status: 'success', state: twoStageState }));
    }
  }

  // ── Serve Downloaded Enhanced Image ──
  if (url.pathname === '/downloaded-image' && (req.method === 'GET' || req.method === 'HEAD')) {
    const rawFile = url.searchParams.get('file') || '';
    const safeName = path.basename(rawFile);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    let targetPath = safeName ? path.join(downloadsDir, safeName) : '';

    if (!targetPath || !fs.existsSync(targetPath)) {
      if (safeName && fs.existsSync(path.join(defaultProcessingDir, safeName))) {
        targetPath = path.join(defaultProcessingDir, safeName);
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Image not found on disk' }));
    }

    const stat = fs.statSync(targetPath);
    const ext = path.extname(targetPath).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(targetPath).pipe(res);
    return;
  }

  // ── List All Downloaded Enhanced Images ──
  if (url.pathname === '/enhanced-images' && req.method === 'GET') {
    try {
      const reqPropertyId = url.searchParams.get('property_id');
      const reqListingCode = url.searchParams.get('listing_code');
      const downloadsDir = path.join(os.homedir(), 'Downloads');
      const dirsToScan = [downloadsDir, defaultProcessingDir].filter((d) => fs.existsSync(d));
      const seenPositions = new Map(); // pos -> imgObj

      for (const dir of dirsToScan) {
        try {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            const lower = f.toLowerCase();
            if (!lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.jpeg') && !lower.endsWith('.webp')) continue;

            let pos = 0;
            const mEnhanced = f.match(/^enhanced_(\d+)_/i);
            const mCode = f.match(/[-_](\d+)\.(?:png|jpg|jpeg|webp)$/i);

            if (mEnhanced) {
              pos = parseInt(mEnhanced[1], 10);
            } else if (mCode) {
              pos = parseInt(mCode[1], 10);
            } else {
              continue;
            }

            if (reqListingCode && !lower.includes(reqListingCode.toLowerCase())) {
              if (!reqPropertyId || !f.includes(reqPropertyId)) continue;
            } else if (reqPropertyId && !reqListingCode && !f.includes(reqPropertyId)) {
              continue;
            }

            const fullPath = path.join(dir, f);
            const stat = fs.statSync(fullPath);

            const imgObj = {
              filename: f,
              full_path: fullPath,
              size: stat.size,
              size_bytes: stat.size,
              mtime: stat.mtimeMs,
              position: pos > 0 ? pos : 1,
              url: `http://127.0.0.1:${PORT}/downloaded-image?file=${encodeURIComponent(f)}`,
            };

            const key = imgObj.position;
            if (!seenPositions.has(key) || stat.mtimeMs > seenPositions.get(key).mtime) {
              seenPositions.set(key, imgObj);
            }
          }
        } catch (e) {}
      }

      const sortedImages = Array.from(seenPositions.values()).sort((a, b) => a.position - b.position);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      return res.end(JSON.stringify({
        status: 'success',
        count: sortedImages.length,
        images: sortedImages,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: err.message, images: [] }));
    }
  }

  // ── Serve Downloaded Hero Image ──
  if (url.pathname === '/hero-downloaded-image' && (req.method === 'GET' || req.method === 'HEAD')) {
    const rawFile = url.searchParams.get('file') || (twoStageState && twoStageState.downloaded_file) || '';
    const safeName = path.basename(rawFile);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    let targetPath = safeName ? path.join(downloadsDir, safeName) : '';

    if (!targetPath || !fs.existsSync(targetPath)) {
      if (safeName && fs.existsSync(path.join(defaultProcessingDir, safeName))) {
        targetPath = path.join(defaultProcessingDir, safeName);
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      try {
        const files = fs.readdirSync(downloadsDir)
          .filter((f) => f.toLowerCase().startsWith('fb_hero') && f.toLowerCase().endsWith('.png'))
          .map((f) => ({ name: f, path: path.join(downloadsDir, f), mtime: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) {
          targetPath = files[0].path;
        }
      } catch (e) {}
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ error: 'Hero image not found on disk' }));
    }

    const stat = fs.statSync(targetPath);
    const ext = path.extname(targetPath).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(targetPath).pipe(res);
    return;
  }

  // ── Reveal Downloaded File in macOS Finder ──
  if (url.pathname === '/reveal-file' && (req.method === 'POST' || req.method === 'GET')) {
    const rawFile = url.searchParams.get('file') || (twoStageState && twoStageState.downloaded_file) || '';
    const safeName = path.basename(rawFile);
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    let targetPath = safeName ? path.join(downloadsDir, safeName) : (twoStageState?.downloaded_file_path || '');
    if (!fs.existsSync(targetPath)) {
      targetPath = path.join(defaultProcessingDir, safeName);
    }
    if (!fs.existsSync(targetPath)) {
      try {
        const files = fs.readdirSync(downloadsDir)
          .filter((f) => f.toLowerCase().startsWith('fb_hero') && f.toLowerCase().endsWith('.png'))
          .map((f) => ({ name: f, path: path.join(downloadsDir, f), mtime: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) {
          targetPath = files[0].path;
        }
      } catch (e) {}
    }

    if (fs.existsSync(targetPath)) {
      try {
        execSync(`open -R "${targetPath}" 2>/dev/null`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ status: 'ok', file: targetPath }));
      } catch (e) {}
    }
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: 'File not found' }));
  }

  // ── Current Target Profile Query (called by extension to verify identity) ─
  if (url.pathname === '/current-profile' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      profileKey: lastFocusTabGroupKey?.split('-')?.[0] || 'Profile 14',
    }));
  }

  // ── Poll for Pending Extension Command (called by the extension background on an interval) ─
  if (url.pathname === '/poll-command' && req.method === 'GET') {
    const rawClientKey = url.searchParams.get('profile_key') || '';
    const clientKey = rawClientKey ? normalizeProfileKey(rawClientKey) : '';

    if (pendingAutomationCommands.length > 0) {
      // Find a command targeted for this specific client profile, or untargeted command
      let cmdIndex = pendingAutomationCommands.findIndex((c) => {
        if (!c || !c.payload) return true;
        const targetRaw = c.payload.profileKey || c.payload.profile_key || '';
        if (!targetRaw) return true;
        const targetKey = normalizeProfileKey(targetRaw);
        return !clientKey || targetKey === clientKey;
      });

      // Fallback: If no exact profile match but there are pending commands, dispatch if clientKey is unverified or 'Profile 2'
      if (cmdIndex === -1 && pendingAutomationCommands.length > 0) {
        cmdIndex = 0;
      }

      if (cmdIndex !== -1) {
        const cmd = pendingAutomationCommands.splice(cmdIndex, 1)[0];
        console.log(`[COMPANION] Dispatched command "${cmd.action}" to client profile "${clientKey || 'any'}" (targeted: ${cmd.payload?.profileKey || 'all'})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'command', command: cmd }));
      }
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
