/**
 * BoltHaven Browser Companion — Background Service Worker
 *
 * Responsibilities:
 *  1. Tab group / tab discovery for the current Chrome profile
 *  2. Tab focusing on demand
 *  3. Multi-tab image processing orchestrator:
 *     - Receives a PROCESS_QUEUE message with a list of jobs & target tab IDs
 *     - Sends up to N jobs concurrently across the assigned ChatGPT tabs
 *     - Waits for each tab to complete or time-out
 *     - Marks each job complete via the backend API
 *     - Automatically advances to the next pending job when a tab finishes
 */

const COMPANION_URL = 'http://127.0.0.1:9224';
const BOLTHAVEN_URL = 'http://localhost:8085';

// ─── Tab-group discovery ────────────────────────────────────────────────────

async function getTabGroupsWithTabs() {
  try {
    const groups = await chrome.tabGroups.query({});
    const tabs = await chrome.tabs.query({});

    const result = groups.map((g) => {
      const groupTabs = tabs
        .filter((t) => t.groupId === g.id)
        .map((t) => ({
          id: t.id,
          title: t.title || 'Untitled',
          url: t.url || '',
          favIconUrl: t.favIconUrl || '',
          isChatGPT: (t.url || '').includes('chatgpt.com'),
        }));

      return {
        id: g.id,
        title: g.title || 'Untitled Group',
        color: g.color || 'grey',
        collapsed: g.collapsed,
        tabs: groupTabs,
        tabsCount: groupTabs.length,
      };
    });

    // If tabs are ungrouped (plain tabs), provide live ChatGPT tabs as the default worker group
    const chatGPTTabs = tabs.filter((t) => (t.url || '').includes('chatgpt.com'));
    if (result.length === 0 && chatGPTTabs.length > 0) {
      result.push({
        id: 'virtual-enhance',
        title: 'Enhance IMG',
        color: 'blue',
        collapsed: false,
        tabs: chatGPTTabs.slice(0, 4).map((t, idx) => ({
          id: t.id,
          title: t.title || `ChatGPT Worker #${idx + 1}`,
          url: t.url || '',
          favIconUrl: t.favIconUrl || '',
          isChatGPT: true,
        })),
        tabsCount: Math.min(4, chatGPTTabs.length),
      });
    }

    return result;
  } catch (err) {
    console.warn('[BOLTHAVEN EXT] Warning discovering tab groups:', err.message);
    return [];
  }
}

// ─── Tab focusing ────────────────────────────────────────────────────────────

async function focusTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) return false;
    await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return true;
  } catch (e) {
    console.warn('[BOLTHAVEN EXT] Warning focusing tab:', e.message);
    return false;
  }
}

// ─── Automation Engine ───────────────────────────────────────────────────────

/**
 * State for the running automation session.
 * Only one session runs at a time (per extension install = per Chrome profile).
 */
const automation = {
  isRunning: false,
  tabSlots: [],      // [{ tabId, busy: bool }]
  queue: [],         // pending job objects
  completedCount: 0,
  failedCount: 0,
  propertyId: null,
  onComplete: null,  // optional callback
};

let automationSessionId = 0;
let twoStageAborted = false;

async function stopAllExtensionAutomation() {
  automationSessionId += 1;
  twoStageAborted = true;
  automation.isRunning = false;
  automation.queue = [];
  setupMutex = Promise.resolve();

  for (const [jobId, resolver] of pendingJobGenerations.entries()) {
    try {
      resolver({ success: false, error: 'Automation stopped by user' });
    } catch (e) {}
  }
  pendingJobGenerations.clear();

  const notifiedTabIds = new Set();
  if (Array.isArray(automation.tabSlots)) {
    for (const slot of automation.tabSlots) {
      if (slot && slot.tabId) {
        notifiedTabIds.add(slot.tabId);
        chrome.tabs.sendMessage(slot.tabId, { action: 'STOP_TAB_JOB' }).catch(() => {});
      }
    }
  }

  try {
    const allTabs = await chrome.tabs.query({});
    for (const t of allTabs) {
      if (t && t.id && (t.url || '').includes('chatgpt.com') && !notifiedTabIds.has(t.id)) {
        notifiedTabIds.add(t.id);
        chrome.tabs.sendMessage(t.id, { action: 'STOP_TAB_JOB' }).catch(() => {});
      }
    }
  } catch (e) {}

  console.log(`[BOLTHAVEN EXT] Stopped all automation across ${notifiedTabIds.size} ChatGPT tab(s).`);
}

/** Send a job to a specific ChatGPT tab via the content script. */
function dispatchJobToTab(tabId, job) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'PROCESS_TAB_JOB', job }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false, error: 'No response from content script' });
      }
    });
  });
}

/** Ping a tab to see if the content script is alive. */
function pingTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'PING_TAB' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait until a tab has status === 'complete' (page finished loading) */
function waitForTabComplete(tabId, maxWaitMs = 25000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + maxWaitMs;

    async function check() {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab && tab.status === 'complete') {
          return resolve(true);
        }
      } catch (e) {
        return resolve(false);
      }
      if (Date.now() >= deadline) {
        return resolve(true);
      }
      setTimeout(check, 600);
    }

    check();
  });
}

/** Ensure a tab has the content script injected. Returns immediately if already alive. */
async function ensureContentScriptInjected(tabId) {
  // 1. Quick test: already alive?
  if (await pingTab(tabId)) return true;

  // 2. Try immediate injection
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    await delay(150);
    if (await pingTab(tabId)) return true;
  } catch (e) {}

  // 3. Tab might still be loading initial page, poll for up to 4s
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    await delay(300);
    if (await pingTab(tabId)) return true;
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      await delay(150);
      if (await pingTab(tabId)) return true;
    } catch (e) {}
  }
  return false;
}

/**
 * Report a completed job to the BoltHaven backend.
 * This moves the job from READY_FOR_USER → COMPLETED.
 */
async function reportJobComplete(jobId, resultUrl) {
  try {
    const filename = `enhanced_${jobId}.png`;
    const localCompanionUrl = `http://127.0.0.1:9224/downloaded-image?file=${encodeURIComponent(filename)}`;
    const effectiveUrl = resultUrl && !resultUrl.startsWith('blob:') ? resultUrl : localCompanionUrl;
    await fetch(`${BOLTHAVEN_URL}/api/browser/jobs/${jobId}/complete-from-tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result_url: effectiveUrl,
        completed_via: 'chatgpt_tab_automation',
      }),
    });
    console.log('[BOLTHAVEN EXT] Reported job complete:', jobId, '->', effectiveUrl);
  } catch (e) {
    console.warn('[BOLTHAVEN EXT] Failed to report job complete:', e.message);
  }
}

/**
 * Report a failed job to the backend.
 */
async function reportJobFailed(jobId, reason) {
  try {
    await fetch(`${BOLTHAVEN_URL}/api/browser/jobs/${jobId}/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  } catch (e) {
    console.warn('[BOLTHAVEN EXT] Failed to report job failure:', e.message);
  }
}

// ─── Setup Phase Mutex ────────────────────────────────────────────────────────
// Ensures that only ONE tab is in the active focus + attach + send phase at a time (~3 seconds).
// As soon as that tab's image is sent and leaving composer, the lock is released so the
// next tab gets full focus. All tabs then generate concurrently in parallel!
let setupMutex = Promise.resolve();

function acquireAttachmentMutex(timeoutMs = 18000) {
  let release;
  let timer;
  const newLock = new Promise((resolve) => {
    release = () => {
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      console.warn('[BOLTHAVEN EXT] Attachment mutex auto-released after timeout');
      resolve();
    }, timeoutMs);
  });
  const prevLock = setupMutex;
  setupMutex = newLock;
  return prevLock.then(() => release);
}

// ─── Concurrent Job Generation Map ───────────────────────────────────────────
const pendingJobGenerations = new Map();

function waitForJobGeneration(jobId, timeoutMs = 360000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingJobGenerations.delete(jobId);
      resolve({ success: false, error: `Generation timed out after ${Math.round(timeoutMs / 1000)}s` });
    }, timeoutMs);

    pendingJobGenerations.set(jobId, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

/** Pre-fetch an image from local backend or remote URL and convert to Base64 data URL */
async function fetchJobImageDataUrl(job) {
  if (!job) return null;
  if (job.image_data_url && typeof job.image_data_url === 'string' && job.image_data_url.startsWith('data:')) {
    return job.image_data_url;
  }
  const primary = job.source_file_path || job.source_file_url || '';
  const fallback = job.source_file_url || job.source_file_path || '';
  const candidates = [];

  if (primary && primary.includes('/storage/')) {
    candidates.push(primary.startsWith('/') ? `${BOLTHAVEN_URL}${primary}` : primary);
  }
  if (fallback && fallback.includes('/storage/')) {
    candidates.push(fallback.startsWith('/') ? `${BOLTHAVEN_URL}${fallback}` : fallback);
  }
  if (primary && !candidates.includes(primary)) {
    candidates.push(primary.startsWith('/') ? `${BOLTHAVEN_URL}${primary}` : primary);
  }
  if (fallback && !candidates.includes(fallback)) {
    candidates.push(fallback.startsWith('/') ? `${BOLTHAVEN_URL}${fallback}` : fallback);
  }

  for (const rawUrl of candidates) {
    try {
      console.log(`[BOLTHAVEN EXT] Pre-fetching image #${job.original_position || 1} for tab:`, rawUrl);
      const r = await fetch(rawUrl);
      if (!r.ok) continue;
      const arrayBuffer = await r.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const mimeType = r.headers.get('content-type') || (rawUrl.endsWith('.png') ? 'image/png' : 'image/jpeg');
      return `data:${mimeType};base64,${base64}`;
    } catch (e) {
      console.warn(`[BOLTHAVEN EXT] Pre-fetch candidate failed (${rawUrl}):`, e.message);
    }
  }
  return null;
}

/**
 * Process one job on a given tab slot.
 * When done (success or fail), automatically picks the next pending job
 * from the shared queue and processes it on the same slot.
 */
async function processSlot(slotIndex, sessionId, initialJob = null) {
  const slot = automation.tabSlots[slotIndex];
  if (!slot) return;

  let nextJob = initialJob;

  while (automation.isRunning && sessionId === automationSessionId) {
    const job = nextJob || automation.queue.shift();
    nextJob = null; // only use initialJob on first iteration
    if (!job) break;
    slot.busy = true;
    slot.currentJob = job;

    console.log(
      `[BOLTHAVEN EXT] Tab ${slot.tabId} → waiting for setup lock for Image #${job.original_position}...`
    );

    // 1. SEQUENTIAL SETUP & SEND (exclusive focus on this tab for ~3 seconds)
    const releaseLock = await acquireAttachmentMutex();
    try {
      if (!automation.isRunning || sessionId !== automationSessionId) {
        slot.busy = false;
        slot.currentJob = null;
        return;
      }

      console.log(`[BOLTHAVEN EXT] Tab ${slot.tabId} → acquired setup lock! Focusing tab for Image #${job.original_position}...`);

      await focusTab(slot.tabId);
      await delay(400);

      await ensureContentScriptInjected(slot.tabId);
      if (!automation.isRunning || sessionId !== automationSessionId) {
        slot.busy = false;
        slot.currentJob = null;
        return;
      }

      // Pre-fetch image Base64 data URL in background script so tab has zero CORS/mixed-content restrictions!
      let jobWithData = { ...job };
      try {
        const dataUrl = await fetchJobImageDataUrl(job);
        if (dataUrl) {
          jobWithData.image_data_url = dataUrl;
          console.log(`[BOLTHAVEN EXT] Image #${job.original_position || 1} pre-fetched successfully (${Math.round(dataUrl.length / 1024)} KB data URL)`);
        }
      } catch (imgErr) {
        console.warn(`[BOLTHAVEN EXT] Pre-fetch image notice for Image #${job.original_position}:`, imgErr.message);
      }

      // Send SETUP_AND_SEND_JOB to the tab with retry
      let setupRes = null;
      for (let sendAttempt = 0; sendAttempt < 4; sendAttempt++) {
        setupRes = await new Promise((resolve) => {
          chrome.tabs.sendMessage(slot.tabId, { action: 'SETUP_AND_SEND_JOB', job: jobWithData }, (res) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { success: false, error: 'No response from tab setup' });
            }
          });
        });
        if (setupRes && setupRes.success) break;
        await delay(1200);
      }

      if (!setupRes || !setupRes.success) {
        throw new Error(setupRes?.error || 'Failed to setup and send image in ChatGPT tab');
      }

      console.log(`[BOLTHAVEN EXT] Tab ${slot.tabId} → Image #${job.original_position} sent! Releasing setup lock for next tab.`);
    } catch (setupErr) {
      console.warn(`[BOLTHAVEN EXT] Tab ${slot.tabId} setup error:`, setupErr.message);
      automation.failedCount++;
      await reportJobFailed(job.job_id, setupErr.message);
      slot.busy = false;
      slot.currentJob = null;
      await delay(2000);
      break;
    } finally {
      // RELEASE THE LOCK IMMEDIATELY SO NEXT TAB GETS FULL ATTENTION!
      releaseLock();
    }

    // 2. PARALLEL GENERATION & DOWNLOAD (happens in background while other tabs setup)
    console.log(`[BOLTHAVEN EXT] Tab ${slot.tabId} → generating Image #${job.original_position} in background...`);
    try {
      const genResult = await waitForJobGeneration(job.job_id, 360000);
      if (genResult && genResult.success) {
        automation.completedCount++;
        await reportJobComplete(job.job_id, genResult.result_url || '');
        console.log(`[BOLTHAVEN EXT] ✓ Job ${job.job_id} (Image #${job.original_position}) completed on tab ${slot.tabId}`);
        notifyProgress();
      } else {
        throw new Error(genResult?.error || 'Generation failed or timed out');
      }
    } catch (genErr) {
      automation.failedCount++;
      await reportJobFailed(job.job_id, genErr.message);
      console.warn(`[BOLTHAVEN EXT] ✗ Job ${job.job_id} failed:`, genErr.message);
    }

    slot.busy = false;
    slot.currentJob = null;

    // Brief pause before this slot takes the next job from queue
    await delay(1500);
  }

  // Check if all slots have finished
  checkAndFinishAutomation(sessionId);
}

function checkAndFinishAutomation(sessionId) {
  const allDone = automation.tabSlots.every((s) => !s.busy) && automation.queue.length === 0;
  if (allDone && automation.isRunning && (sessionId === undefined || sessionId === automationSessionId)) {
    finishAutomation();
  }
}

function notifyProgress() {
  const total = automation.completedCount + automation.failedCount + automation.queue.length;
  const isAllDone = automation.queue.length === 0 && automation.tabSlots.every((s) => !s.busy);

  // Notify the companion service so the frontend can poll queue status
  fetch(`${COMPANION_URL}/automation-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_id: automation.propertyId,
      completed: automation.completedCount,
      failed: automation.failedCount,
      remaining: automation.queue.length,
      total: total,
      is_running: !isAllDone,
    }),
  }).catch(() => {});

  if (isAllDone && automation.isRunning) {
    finishAutomation();
  }
}

function finishAutomation() {
  console.log(
    `[BOLTHAVEN EXT] Automation complete! ✓ ${automation.completedCount} done, ✗ ${automation.failedCount} failed`
  );
  automation.isRunning = false;

  // Notify companion
  fetch(`${COMPANION_URL}/automation-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_id: automation.propertyId,
      completed: automation.completedCount,
      failed: automation.failedCount,
      is_running: false,
    }),
  }).catch(() => {});
}

const ENHANCE_CHATGPT_DEFAULT_URLS = [
  'https://chatgpt.com/',
  'https://chatgpt.com/',
  'https://chatgpt.com/',
  'https://chatgpt.com/',
];

// Global lock to prevent concurrent calls to ensureTabGroupOpen from racing and creating duplicate tab groups
let isEnsuringGroupOpen = null;

// Remembers active worker tabs opened during this browser session
// Worker tabs are remembered PER GROUP NAME (so "FB Hero" and "Enhance IMG" never share tabs) and are
// persisted in chrome.storage.local, because the MV3 service worker is killed when idle and loses memory.
// Groups are NOT created in Chrome: these are normal tabs that the site simply remembers.
const SESSION_TABS_STORAGE_KEY = 'bolthavenSessionTabsByGroup';
const FRESH_CHAT_URL = 'https://chatgpt.com/';

function sessionKeyFor(groupName) {
  return String(groupName || 'default').toLowerCase().trim();
}

async function loadSessionTabs(groupName) {
  try {
    const stored = await chrome.storage.local.get([SESSION_TABS_STORAGE_KEY]);
    const map = stored[SESSION_TABS_STORAGE_KEY] || {};
    const ids = map[sessionKeyFor(groupName)];
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'number') : [];
  } catch (e) {
    return [];
  }
}

async function saveSessionTabs(groupName, tabIds) {
  try {
    const stored = await chrome.storage.local.get([SESSION_TABS_STORAGE_KEY]);
    const map = stored[SESSION_TABS_STORAGE_KEY] || {};
    map[sessionKeyFor(groupName)] = tabIds;
    await chrome.storage.local.set({ [SESSION_TABS_STORAGE_KEY]: map });
  } catch (e) {}
}

async function loadAliveSessionTabs(groupName) {
  const remembered = await loadSessionTabs(groupName);
  if (remembered.length === 0) return [];
  const allTabs = await chrome.tabs.query({});
  const alive = new Set(allTabs.map((t) => t.id));
  return remembered.filter((id) => alive.has(id));
}

function getConversationKey(rawUrl) {
  if (!rawUrl) return '';
  const match = String(rawUrl).match(/\/c\/([a-zA-Z0-9\-]+)/i);
  if (match) return `c:${match[1].toLowerCase()}`;
  try {
    const parsed = new URL(rawUrl);
    return (parsed.origin + parsed.pathname).toLowerCase().replace(/\/+$/, '');
  } catch {
    return String(rawUrl).toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');
  }
}

function getTabKey(tab) {
  if (!tab) return '';
  return getConversationKey(tab.url || tab.pendingUrl || '');
}

async function ensureTabGroupOpen(groupName, customUrls, tabMode = 'existing_tabs', workerCount = 4, reuseSessionTabs = true) {
  if (isEnsuringGroupOpen) {
    console.log('[BOLTHAVEN EXT] ensureTabGroupOpen is already executing, reusing pending promise...');
    return isEnsuringGroupOpen;
  }
  isEnsuringGroupOpen = (async () => {
    try {
      return await _ensureTabGroupOpenInternal(groupName, customUrls, tabMode, workerCount, reuseSessionTabs);
    } finally {
      isEnsuringGroupOpen = null;
    }
  })();
  return isEnsuringGroupOpen;
}

async function _ensureTabGroupOpenInternal(groupName, customUrls, tabMode = 'existing_tabs', workerCount = 4, reuseSessionTabs = true) {
  const isHero = (groupName || '').toLowerCase().includes('hero');
  const count = isHero ? 1 : Math.max(1, Math.min(8, parseInt(workerCount, 10) || 4));
  const resolvedName = isHero ? 'FB Hero' : (groupName || 'Enhance IMG');

  console.log(`[BOLTHAVEN EXT] 🎯 Ensuring plain worker tabs for "${resolvedName}" (count: ${count})`);

  let allTabs = await chrome.tabs.query({});

  // 1. If any tabs are currently inside a Chrome Tab Group, ungroup them so tabs are plain and simple
  const groupedTabIds = allTabs.filter((t) => t.groupId && t.groupId !== -1).map((t) => t.id);
  if (groupedTabIds.length > 0) {
    try {
      await chrome.tabs.ungroup(groupedTabIds);
      console.log(`[BOLTHAVEN EXT] ✓ Ungrouped ${groupedTabIds.length} tabs to keep plain tabs`);
      // Refresh tab list after ungrouping
      allTabs = await chrome.tabs.query({});
    } catch (e) {
      console.warn('[BOLTHAVEN EXT] Ungroup notice:', e.message);
    }
  }

  // 2. Locate existing open ChatGPT tabs in this window
  const chatGPTTabs = allTabs.filter((t) => (t.url || t.pendingUrl || '').includes('chatgpt.com'));

  let finalTabIds = [];

  if (chatGPTTabs.length >= count) {
    // We already have enough open ChatGPT tabs! Reuse the first `count` tabs, zero new tabs created
    finalTabIds = chatGPTTabs.slice(0, count).map((t) => t.id);
    console.log(`[BOLTHAVEN EXT] ✓ Reusing ${finalTabIds.length} existing ChatGPT worker tabs (no new tabs opened)`);
  } else {
    // We have fewer than `count` tabs. Use existing and open only what is missing up to `count`
    finalTabIds = chatGPTTabs.map((t) => t.id);

    // Reuse any empty/newtab tabs first before opening new ones
    const blankTabs = allTabs.filter(
      (t) => (t.url || '').includes('newtab') || (t.title || '').toLowerCase() === 'new tab'
    );
    for (const bt of blankTabs) {
      if (finalTabIds.length < count) {
        try {
          await chrome.tabs.update(bt.id, { url: 'https://chatgpt.com/' });
          finalTabIds.push(bt.id);
        } catch (e) {}
      }
    }

    // Open any remaining tabs to reach exactly `count`
    while (finalTabIds.length < count) {
      try {
        const createdTab = await chrome.tabs.create({
          url: 'https://chatgpt.com/',
          active: false,
        });
        finalTabIds.push(createdTab.id);
      } catch (e) {
        break;
      }
    }
    console.log(`[BOLTHAVEN EXT] ✓ Total ${finalTabIds.length} plain worker tabs ready for "${resolvedName}"`);
  }

  // 3. Close any leftover blank new tab pages if we already have our worker tabs
  try {
    const blankTabs = (await chrome.tabs.query({})).filter(
      (t) =>
        !finalTabIds.includes(t.id) &&
        ((t.url || '').includes('newtab') || (t.title || '').toLowerCase() === 'new tab')
    );
    blankTabs.forEach((bt) => chrome.tabs.remove(bt.id).catch(() => {}));
  } catch (e) {}

  finalTabIds = finalTabIds.slice(0, count);
  await saveSessionTabs(resolvedName, finalTabIds);

  if (finalTabIds.length > 0) {
    await focusTab(finalTabIds[0]);
  }

  console.log(`[BOLTHAVEN EXT] ✓ Ready: ${finalTabIds.length} tab(s) confirmed open and active for "${resolvedName}":`, finalTabIds);
  return finalTabIds;
}

/**
 * Start the multi-tab processing automation session.
 *
 * @param {object} payload
 *   - tabIds: number[]          — Chrome tab IDs in the "Enhance IMG" group assigned as workers
 *   - jobs: object[]            — array of ImageProcessingJob objects from the backend queue
 *   - propertyId: string        — property being processed
 */
async function startAutomation(payload) {
  let { tabIds, jobs, propertyId, groupName, groupTabUrls, tabMode, workerCount, reuseSessionTabs } = payload || {};
  const maxWorkers = Math.max(1, Math.min(8, parseInt(workerCount, 10) || 4));

  if (automation.isRunning) {
    console.log('[BOLTHAVEN EXT] Automation was already marked running. Resetting previous session to run requested batch...');
    await stopAllExtensionAutomation();
    await delay(400);
  }

  const mySessionId = ++automationSessionId;
  twoStageAborted = false;
  setupMutex = Promise.resolve();

  // 1. Immediately ensure the worker tabs are open, organized in Tab Group, and focused
  console.log(`[BOLTHAVEN EXT] Ensuring Tab Group "${groupName || 'Enhance IMG'}" is active...`);
  const ensuredTabIds = await ensureTabGroupOpen(groupName || 'Enhance IMG', groupTabUrls, tabMode, maxWorkers, reuseSessionTabs).catch(() => []);
  if (mySessionId !== automationSessionId) {
    return { success: false, error: 'Automation cancelled by user' };
  }

  let activeTabIds = (Array.isArray(ensuredTabIds) && ensuredTabIds.length > 0)
    ? ensuredTabIds.slice(0, maxWorkers)
    : [];

  // Fallback: If not enough tabs returned by ensureTabGroupOpen, locate available tabs
  if (activeTabIds.length < maxWorkers) {
    const allTabs = await chrome.tabs.query({});
    const realTabIdSet = new Set(allTabs.map((t) => t.id));

    if (Array.isArray(tabIds) && tabIds.length > 0) {
      const valid = tabIds.filter((id) => typeof id === 'number' && realTabIdSet.has(id));
      for (const vid of valid) {
        if (!activeTabIds.includes(vid)) {
          activeTabIds.push(vid);
          if (activeTabIds.length >= maxWorkers) break;
        }
      }
    }

    if (activeTabIds.length < maxWorkers) {
      const chatGPTTabs = allTabs.filter((t) => (t.url || '').includes('chatgpt.com'));
      for (const t of chatGPTTabs) {
        if (!activeTabIds.includes(t.id)) {
          activeTabIds.push(t.id);
          if (activeTabIds.length >= maxWorkers) break;
        }
      }
    }
  }

  // Open any remaining tabs to reach maxWorkers
  if (activeTabIds.length < maxWorkers) {
    const needed = maxWorkers - activeTabIds.length;
    console.log(`[BOLTHAVEN EXT] Opening ${needed} additional ChatGPT worker tab(s)...`);
    for (let i = 0; i < needed; i++) {
      const idx = activeTabIds.length;
      const targetUrl = (groupTabUrls && groupTabUrls[idx]) || 'https://chatgpt.com/';
      const created = await chrome.tabs.create({ url: targetUrl, active: false });
      activeTabIds.push(created.id);
    }
  }

  activeTabIds = activeTabIds.slice(0, maxWorkers);

  // Ensure content scripts are active on all worker tabs in parallel (fast, no blocking sequential loops)
  await Promise.all(activeTabIds.map((tid) => ensureContentScriptInjected(tid)));

  // 2. If jobs not passed or empty, fetch pending jobs from the backend queue
  if ((!jobs || jobs.length === 0) && propertyId) {
    try {
      const qRes = await fetch(`${BOLTHAVEN_URL}/api/browser/queue?property_id=${encodeURIComponent(propertyId)}`);
      if (qRes.ok) {
        const qData = await qRes.json();
        const rawJobs = qData.queue || qData.jobs || [];
        jobs = rawJobs.filter((j) => {
          const s = String(j.status || '').toUpperCase();
          return s === 'PENDING' || s === 'READY_FOR_USER' || s === 'CANCELLED' || s === 'FAILED' || s === 'PROCESSING_CHROME';
        });
      }
    } catch (fetchErr) {
      console.warn('[BOLTHAVEN EXT] Could not fetch queue from backend:', fetchErr);
    }
  }

  if (mySessionId !== automationSessionId) {
    return { success: false, error: 'Automation cancelled by user' };
  }

  if (!jobs || jobs.length === 0) {
    return { success: false, error: 'No pending jobs found for this property' };
  }

  const sessionListingCode = payload.listingCode || payload.listing_code || '';

  // Strictly deduplicate jobs by original_position so each image is enhanced EXACTLY ONCE!
  const seenPositions = new Set();
  const uniqueJobs = [];
  const sortedRaw = [...jobs].sort((a, b) => {
    const posA = a.original_position || a.index || 0;
    const posB = b.original_position || b.index || 0;
    return posA - posB;
  });

  for (const j of sortedRaw) {
    const pos = j.original_position || j.index || (uniqueJobs.length + 1);
    if (!seenPositions.has(pos)) {
      seenPositions.add(pos);
      uniqueJobs.push({
        ...j,
        original_position: pos,
        listing_code: j.listing_code || sessionListingCode || '',
      });
    }
  }

  jobs = uniqueJobs;

  console.log(
    `[BOLTHAVEN EXT] Starting automation: ${jobs.length} unique images (positions: ${jobs.map((j) => '#' + j.original_position).join(', ')}) distributed across ${activeTabIds.length} tabs`
  );

  // Initialise automation state
  automation.isRunning = true;
  automation.propertyId = propertyId;
  // Queue holds remaining jobs after assigning the initial jobs to the slots
  automation.queue = jobs.slice(activeTabIds.length);
  automation.completedCount = 0;
  automation.failedCount = 0;
  automation.tabSlots = activeTabIds.map((tabId) => ({ tabId, busy: false, currentJob: null }));

  console.log(`[BOLTHAVEN EXT] Starting ${automation.tabSlots.length} tab slots with queue mutex...`);

  // Start all tab slots: acquireAttachmentMutex inside processSlot guarantees
  // each tab performs setup & send one-by-one in sequence without conflict!
  for (let i = 0; i < automation.tabSlots.length; i++) {
    if (!automation.isRunning || mySessionId !== automationSessionId) break;
    const initialJob = jobs[i];
    if (!initialJob) break;
    processSlot(i, mySessionId, initialJob);
  }

  return { success: true, message: `Automation started: ${jobs.length} jobs on ${activeTabIds.length} tabs` };
}

// ─── Message Router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Click Send button in MAIN world context (bypasses Chrome isolated world limitations for React events)
  if (request.action === 'CLICK_SEND_MAIN_WORLD') {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const isStop = (el) => {
            if (!el) return false;
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const tid = (el.getAttribute('data-testid') || '').toLowerCase();
            return aria.includes('stop') || tid.includes('stop') || Boolean(el.querySelector('svg rect, svg square'));
          };

          const explicit = (
            document.querySelector('button[data-testid="send-button"]') ||
            document.querySelector('button[data-testid="composer-send-button"]') ||
            document.querySelector('button[aria-label="Send prompt"]') ||
            document.querySelector('button[aria-label="Send message"]') ||
            document.querySelector('button[aria-label="Send"]')
          );
          let btn = (explicit && !explicit.disabled && explicit.getAttribute('aria-disabled') !== 'true' && !isStop(explicit)) ? explicit : null;

          if (!btn) {
            const promptEl = document.querySelector('.ProseMirror, #prompt-textarea, textarea');
            const pRect = promptEl?.getBoundingClientRect();
            const btns = Array.from(document.querySelectorAll('button:not(:disabled)')).filter((b) => {
              if (b.disabled || b.getAttribute('aria-disabled') === 'true' || isStop(b)) return false;
              const aria = (b.getAttribute('aria-label') || '').toLowerCase();
              const text = (b.innerText || b.textContent || '').trim();
              if (text.length > 0) return false;
              if (
                aria.includes('editor') ||
                aria.includes('copy') ||
                aria.includes('share') ||
                aria.includes('pin') ||
                aria.includes('desktop') ||
                aria.includes('app') ||
                aria.includes('project') ||
                aria.includes('plugin') ||
                aria.includes('attach') ||
                aria.includes('mic') ||
                aria.includes('voice') ||
                aria.includes('model') ||
                aria.includes('dictate') ||
                aria.includes('record')
              ) {
                return false;
              }
              const r = b.getBoundingClientRect();
              if (r.width < 18 || r.width > 55 || r.height < 18 || r.height > 55) return false;
              if (pRect && r.bottom < pRect.top - 10) return false;
              return Boolean(b.querySelector('svg'));
            });
            if (btns.length > 0) {
              btns.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
              btn = btns[0];
            }
          }

          if (btn && !btn.disabled) {
            btn.focus();
            const r = btn.getBoundingClientRect();
            const opts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, buttons: 1 };
            btn.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
            btn.dispatchEvent(new MouseEvent('mousedown', opts));
            btn.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, isPrimary: true, pointerType: 'mouse' }));
            btn.dispatchEvent(new MouseEvent('mouseup', opts));
            btn.dispatchEvent(new MouseEvent('click', opts));
            btn.click();
            if (btn.form && typeof btn.form.requestSubmit === 'function') {
              btn.form.requestSubmit(btn);
            }
          }

          const pm = document.querySelector('.ProseMirror, #prompt-textarea, textarea');
          if (pm) {
            pm.focus();
            pm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true }));
          }
        },
      }).then(() => sendResponse({ success: true })).catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    }
  }

  // Insert Prompt text in MAIN world context (directly interacts with ProseMirror document transaction)
  if (request.action === 'INSERT_PROMPT_MAIN_WORLD') {
    const tabId = sender.tab?.id;
    const textToInsert = request.text || '';
    if (tabId && textToInsert) {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (text) => {
          const pm = document.querySelector('.ProseMirror, #prompt-textarea, textarea');
          if (!pm) return { ok: false, reason: 'no pm' };
          pm.focus();

          // METHOD A: document.execCommand insertText — works in isolated worlds AND main world where deprecated API still active
          try {
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(pm);
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('delete', false, null);
            const ok = document.execCommand('insertText', false, text);
            if (ok && pm.textContent && pm.textContent.trim().length > 3) {
              pm.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
              return { ok: true, method: 'execCommand' };
            }
          } catch (e) {}

          // METHOD B: ProseMirror __prosemirror_state access (direct state mutation via PM API)
          try {
            const pmStateKey = Object.keys(pm).find(k => k.startsWith('__prosemirror') || k === 'pmViewDesc');
            if (pmStateKey) {
              const view = pm[pmStateKey]?.node ? pm[pmStateKey] : null;
              if (view && view.dispatch && view.state) {
                const tr = view.state.tr.insertText(text);
                view.dispatch(tr);
                return { ok: true, method: 'prosemirror_view' };
              }
            }
          } catch (e) {}

          // METHOD C: React fiber / synthetic event on the underlying contenteditable
          try {
            const reactFiberKey = Object.keys(pm).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternals'));
            if (reactFiberKey) {
              // Walk up fiber tree to find the ProseMirror view
              let fiber = pm[reactFiberKey];
              while (fiber) {
                if (fiber.stateNode && fiber.stateNode.dispatch && fiber.stateNode.state) {
                  const view = fiber.stateNode;
                  const tr = view.state.tr.insertText(text);
                  view.dispatch(tr);
                  return { ok: true, method: 'fiber_pm_view' };
                }
                fiber = fiber.return;
              }
            }
          } catch (e) {}

          // METHOD D: Clipboard paste simulation (most reliable for modern editors)
          try {
            pm.focus();
            // Select all existing text first
            const sel2 = window.getSelection();
            const range2 = document.createRange();
            range2.selectNodeContents(pm);
            sel2.removeAllRanges();
            sel2.addRange(range2);

            const dt = new DataTransfer();
            dt.setData('text/plain', text);
            dt.setData('text/html', `<p>${text.replace(/\n/g, '</p><p>')}</p>`);

            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              composed: true,
            });
            Object.defineProperty(pasteEvent, 'clipboardData', { value: dt });
            pm.dispatchEvent(pasteEvent);

            // Check synchronously - no await in non-async func scope
            if (pm.textContent && pm.textContent.trim().length > 3) {
              return { ok: true, method: 'clipboard_paste' };
            }
          } catch (e) {}

          // METHOD E: Direct innerHTML paragraph injection (fallback, works if React state reads innerText)
          try {
            const lines2 = text.split('\n');
            pm.innerHTML = lines2.map(l => `<p>${l || '<br>'}</p>`).join('');
            pm.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
            pm.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            pm.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            return { ok: pm.textContent.trim().length > 3, method: 'innerHTML' };
          } catch (e) {}

          return { ok: false, reason: 'all methods failed' };
        },
        args: [textToInsert],
      }).then((res) => sendResponse({ success: res?.[0]?.result?.ok ?? false, detail: res?.[0]?.result }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    }
  }

  // Attach single image in MAIN world context
  if (request.action === 'ATTACH_IMAGE_MAIN_WORLD') {
    const tabId = sender.tab?.id;
    const { dataUrl, filename } = request;
    if (tabId && dataUrl) {
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: async (dUrl, fName) => {
          try {
            const resp = await fetch(dUrl);
            const blob = await resp.blob();
            const file = new File([blob], fName || 'image.jpg', { type: blob.type || 'image/jpeg' });
            const dt = new DataTransfer();
            dt.items.add(file);

            // 1. Locate or trigger file input in DOM
            let fileInput = document.querySelector('input[type="file"], input[accept*="image"]');
            if (!fileInput) {
              const attachBtn = (
                document.querySelector('button[data-testid="attach-button"]') ||
                document.querySelector('button[aria-label*="Attach" i]') ||
                document.querySelector('button[aria-label*="Add files" i]') ||
                document.querySelector('button[aria-label*="Add content" i]') ||
                document.querySelector('button[data-testid*="attach" i]')
              );
              if (attachBtn) {
                attachBtn.click();
                await new Promise((r) => setTimeout(r, 250));
                fileInput = document.querySelector('input[type="file"], input[accept*="image"]');
              }
            }

            if (fileInput) {
              try {
                const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')?.set;
                if (nativeSetter) {
                  nativeSetter.call(fileInput, dt.files);
                } else {
                  fileInput.files = dt.files;
                }
              } catch (e) {
                fileInput.files = dt.files;
              }
              if (fileInput._valueTracker) fileInput._valueTracker.setValue('');

              // Trigger React onChange directly if present on fiber
              try {
                const reactPropsKey = Object.keys(fileInput).find((k) => k.startsWith('__reactProps$'));
                if (reactPropsKey && fileInput[reactPropsKey]?.onChange) {
                  fileInput[reactPropsKey].onChange({ target: fileInput, currentTarget: fileInput });
                }
              } catch (e) {}

              fileInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
              fileInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            }

            // 2. Dispatch paste and drop on prompt textarea
            const pm = document.querySelector('#prompt-textarea, .ProseMirror, textarea');
            if (pm) {
              pm.focus();
              try {
                const pasteEv = new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true });
                Object.defineProperty(pasteEv, 'clipboardData', { value: dt, writable: false });
                pm.dispatchEvent(pasteEv);
              } catch (e) {}

              try {
                const dropEv = new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
                pm.dispatchEvent(dropEv);
              } catch (e) {}
            }

            // Send Escape key to close any attach popup that opened
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
            return true;
          } catch (e) {
            return false;
          }
        },
        args: [dataUrl, filename],
      }).then((res) => sendResponse({ success: res?.[0]?.result ?? false }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    }
  }
  // Image download handler via chrome.downloads API
  if (request.action === 'DOWNLOAD_IMAGE') {
    const rawFilename = request.filename || `enhanced_${Date.now()}.png`;
    const cleanFilename = rawFilename.replace(/[\/\\]/g, '_').trim();
    chrome.downloads.download(
      {
        url: request.url,
        filename: cleanFilename,
        saveAs: false,
        conflictAction: 'overwrite',
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.warn('[BOLTHAVEN EXT] chrome.downloads error:', chrome.runtime.lastError.message);
          // Fallback without explicit filename
          chrome.downloads.download(
            { url: request.url, saveAs: false },
            (id2) => {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                console.log('[BOLTHAVEN EXT] ✓ chrome.downloads started with default filename, id:', id2);
                sendResponse({ success: true, downloadId: id2 });
              }
            }
          );
        } else {
          console.log('[BOLTHAVEN EXT] ✓ chrome.downloads started, id:', downloadId);
          sendResponse({ success: Boolean(downloadId), downloadId });
        }
      }
    );
    return true;
  }

  // Fetch image as base64 to avoid CSP/Mixed content restrictions on ChatGPT page
  if (request.action === 'FETCH_IMAGE_BASE64') {
    const fetchAsDataUrl = async () => {
      const candidates = [];
      const primary = request.url || '';
      const fallback = request.fallbackUrl || '';

      // If local storage path (/storage/...) is present in primary or fallback, try it first
      if (primary && primary.includes('/storage/')) {
        candidates.push(primary.startsWith('/') ? `${BOLTHAVEN_URL}${primary}` : primary);
      }
      if (fallback && fallback.includes('/storage/')) {
        candidates.push(fallback.startsWith('/') ? `${BOLTHAVEN_URL}${fallback}` : fallback);
      }
      if (primary && !candidates.includes(primary)) {
        candidates.push(primary.startsWith('/') ? `${BOLTHAVEN_URL}${primary}` : primary);
      }
      if (fallback && !candidates.includes(fallback)) {
        candidates.push(fallback.startsWith('/') ? `${BOLTHAVEN_URL}${fallback}` : fallback);
      }

      let lastError = null;
      for (const rawUrl of candidates) {
        try {
          console.log('[BOLTHAVEN] Fetching image for base64 conversion:', rawUrl);
          const r = await fetch(rawUrl);
          const arrayBuffer = await r.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
          }
          const base64 = btoa(binary);
          const mimeType = r.headers.get('content-type') || (rawUrl.endsWith('.png') ? 'image/png' : 'image/jpeg');
          return `data:${mimeType};base64,${base64}`;
        } catch (err) {
          console.warn('[BOLTHAVEN] Candidate image fetch failed:', rawUrl, err.message);
          lastError = err;
        }
      }
      throw lastError || new Error('No valid image candidate could be fetched');
    };

    fetchAsDataUrl()
      .then((dataUrl) => sendResponse({ success: true, dataUrl }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async
  }

  // Existing handlers
  if (request.action === 'GET_GROUPS') {
    getTabGroupsWithTabs().then((groups) => sendResponse({ groups }));
    return true;
  }

  if (request.action === 'FOCUS_TAB') {
    focusTab(request.tabId).then((success) => sendResponse({ success }));
    return true;
  }

  if (request.action === 'SYNC_NOW') {
    getTabGroupsWithTabs().then(async (groups) => {
      try {
        const stored = await chrome.storage.local.get(['profileName']);
        const profileName = stored.profileName || 'Current Profile';

        await fetch(`${COMPANION_URL}/pair-extension`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileName, tabGroups: groups }),
        }).catch(() => {});

        sendResponse({ success: true, count: groups.length });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }

  // ── Start multi-tab automation ──────────────────────────────────────
  if (request.action === 'START_AUTOMATION') {
    startAutomation(request.payload)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ── Stop running automation ─────────────────────────────────────────
  if (request.action === 'STOP_AUTOMATION') {
    stopAllExtensionAutomation().then(() => {
      sendResponse({ success: true, message: 'Automation stopped' });
    });
    return true;
  }

  // ── Wake up and poll on content script keep-alive ping ───────────────
  if (request.action === 'WAKE_UP_AND_POLL') {
    pollCompanion();
    sendResponse({ awake: true });
    return true;
  }

  // ── Get automation status ───────────────────────────────────────────
  if (request.action === 'GET_AUTOMATION_STATUS') {
    sendResponse({
      isRunning: automation.isRunning,
      completed: automation.completedCount,
      failed: automation.failedCount,
      remaining: automation.queue.length,
      propertyId: automation.propertyId,
    });
    return true;
  }

  // ── Notify job generation complete/failed from content script ──────
  if (request.action === 'JOB_GENERATION_COMPLETE' || request.action === 'JOB_GENERATION_FAILED') {
    const resolver = pendingJobGenerations.get(request.jobId);
    if (resolver) {
      pendingJobGenerations.delete(request.jobId);
      resolver({
        success: request.action === 'JOB_GENERATION_COMPLETE',
        result_url: request.result_url || '',
        error: request.error || '',
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  // ── Notify attachment phase complete for this job ──────────────────
  if (request.action === 'ATTACHMENT_PHASE_COMPLETE') {
    const resolver = pendingAttachmentResolvers.get(request.jobId);
    if (resolver) {
      pendingAttachmentResolvers.delete(request.jobId);
      resolver();
    }
    sendResponse({ ok: true });
    return true;
  }

  // ── Forward Stage 2 live progress (generating / downloading image) ──
  if (request.action === 'STAGE2_PROGRESS') {
    fetch(`${COMPANION_URL}/two-stage-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        is_running: true,
        step: request.step || 'stage2_running',
        images_attached: request.images_attached,
        result_url: request.result_url || '',
        message: request.message || 'Processing in ChatGPT...',
      }),
    }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
});

// ─── Keep-Alive & Wake-up Listeners ──────────────────────────────────────────
// Content scripts from any open ChatGPT tab automatically connect and send pings
// to keep this service worker alive continuously without needing user interaction.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'bolthaven-worker-keepalive') {
    pollCompanion();
  }
});

// Chrome alarms heartbeat (fires every ~6-10 seconds to wake up service worker)
try {
  chrome.alarms.create('companion_poll_heartbeat', { periodInMinutes: 0.1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'companion_poll_heartbeat') {
      pollCompanion();
    }
  });
} catch (e) {}

// Browser tab and window events wake up the service worker when Chrome opens or focuses
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('chatgpt.com')) {
    pollCompanion();
  }
});

chrome.tabs.onActivated.addListener(() => {
  pollCompanion();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    pollCompanion();
  }
});

// ── Two-Stage / Direct Staging Orchestration (FB Hero) ──
async function executeTwoStageStaging(payload) {
  const {
    profileKey,
    groupName,
    initialPrompt,
    referenceImage,
    condoImages,
    condoName,
    skipTab1,
    tabMode,
    reuseSessionTabs,
    workerCount: reqWorkerCount,
  } = payload;
  const isDirectMode = Boolean(skipTab1) || reqWorkerCount === 1;
  const requiredTabCount = isDirectMode ? 1 : Math.max(1, parseInt(reqWorkerCount, 10) || 2);
  const mySessionId = ++automationSessionId;
  twoStageAborted = false;
  setupMutex = Promise.resolve();
  const isTwoStageStopped = () => twoStageAborted || mySessionId !== automationSessionId;

  console.log(
    `[BOLTHAVEN EXT] 🚀 Starting ${isDirectMode ? 'Direct 1-Tab' : '2-Stage (2-Tab)'} Hero Generation for "${condoName}" in group "${groupName}" (tabMode: ${tabMode || 'existing_tabs'}, tabs: ${requiredTabCount})...`
  );

  await fetch(`${COMPANION_URL}/two-stage-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_running: true,
      step: 'locating_tab_group',
      condo_name: condoName,
      message: `Opening connected browser & ${requiredTabCount === 1 ? '1 worker tab' : `${requiredTabCount} worker tabs`} in [${groupName || 'FB Hero'}]...`,
    }),
  }).catch(() => {});

  if (isTwoStageStopped()) return;

  // 1. Ensure the required number of tabs (1 for Direct, 2 for 2-Stage) are open and focused (regular tabs, no groups)
  const ensuredTabIds = await ensureTabGroupOpen(
    groupName || 'FB Hero',
    Array.from({ length: requiredTabCount }, () => 'https://chatgpt.com/'),
    tabMode || 'existing_tabs',
    requiredTabCount,
    reuseSessionTabs !== false
  ).catch(() => []);

  if (isTwoStageStopped()) return;

  let tabs = [];
  if (Array.isArray(ensuredTabIds) && ensuredTabIds.length > 0) {
    for (const id of ensuredTabIds.slice(0, requiredTabCount)) {
      const t = await chrome.tabs.get(id).catch(() => null);
      if (t) tabs.push(t);
    }
  }
  if (tabs.length === 0) {
    const allTabs = await chrome.tabs.query({});
    tabs = allTabs.filter((t) => (t.url || '').includes('chatgpt.com')).slice(0, requiredTabCount);
  }

  // Ensure we have enough tabs open (1 for Direct mode, 2 for 2-Stage mode)
  while (tabs.length < requiredTabCount) {
    const created = await chrome.tabs.create({ url: 'https://chatgpt.com/', active: false });
    tabs.push(created);
  }

  tabs = tabs.slice(0, requiredTabCount);

  if (isTwoStageStopped()) return;

  // In Direct Mode (skipTab1 === true), ONLY 1 tab is used (tabs[0])!
  // In 2-Stage Mode (skipTab1 === false), Tab 1 generates prompt and Tab 2 generates image.
  const tab1 = tabs[0];
  const tab2 = isDirectMode ? tabs[0] : (tabs[1] || tabs[0]);

  let extractedPrompt = initialPrompt;

  // 3. Step 1: Generate prompt in Tab 1 unless Direct Mode (skipTab1) is active
  if (isDirectMode) {
    console.log('[BOLTHAVEN EXT] ⚡ Direct Mode (1 Tab): Using prompt directly in Tab 1 (id:', tab2.id, ')');
    await fetch(`${COMPANION_URL}/two-stage-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'stage1_completed',
        extracted_prompt: initialPrompt,
        message: 'Direct Mode (1 Tab): Prompt ready, attaching Reference Image + 3 Condo Photos...',
      }),
    }).catch(() => {});
  } else {
    if (isTwoStageStopped()) return;
    console.log('[BOLTHAVEN EXT] Focusing Tab 1:', tab1.id, tab1.title);
    await focusTab(tab1.id);
    await ensureContentScriptInjected(tab1.id);
    await new Promise((r) => setTimeout(r, 500));
    if (isTwoStageStopped()) return;

    await fetch(`${COMPANION_URL}/two-stage-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'stage1_running', message: 'Generating and extracting prompt in Tab 1...' }),
    }).catch(() => {});

    const stage1Response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab1.id, {
        action: 'EXTRACT_STAGE1_PROMPT',
        prompt: initialPrompt,
      }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res || !res.success) return reject(new Error(res?.error || 'Failed to extract prompt from Tab 1'));
        resolve(res);
      });
    });

    if (isTwoStageStopped()) return;

    extractedPrompt = stage1Response.extractedPrompt || '';
    console.log('[BOLTHAVEN EXT] ✓ Stage 1 prompt extracted, length:', extractedPrompt.length);

    await fetch(`${COMPANION_URL}/two-stage-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: 'stage1_completed',
        extracted_prompt: extractedPrompt,
        message: 'Tab 1 prompt extracted! Switching to Tab 2...',
      }),
    }).catch(() => {});
  }

  if (isTwoStageStopped()) return;

  // 4. Step 2: Focus target tab, ensure content script is injected, attach Reference Image (1st) + 3 Condo Photos (2nd) + Prompt (3rd), generate & download!
  console.log('[BOLTHAVEN EXT] Focusing generation tab:', tab2.id, tab2.title);
  await focusTab(tab2.id);
  await ensureContentScriptInjected(tab2.id);
  await new Promise((r) => setTimeout(r, 600));
  if (isTwoStageStopped()) return;

  await fetch(`${COMPANION_URL}/two-stage-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'stage2_running',
      message: 'Attaching Reference Image (1st), Condo Photos 1, 2, 3 (next), and pasting prompt...',
    }),
  }).catch(() => {});

  let stage2Response = null;
  let lastSendError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ensureContentScriptInjected(tab2.id);
      stage2Response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab2.id, {
          action: 'EXECUTE_STAGE2_STAGING',
          extractedPrompt,
          referenceImage, // 1st: manual reference image
          condoImages,    // 2nd: 1.png, 2.png, 3.png
          condoName,
        }, (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!res || !res.success) return reject(new Error(res?.error || 'Failed to execute Hero image generation'));
          resolve(res);
        });
      });
      if (stage2Response) break;
    } catch (err) {
      lastSendError = err;
      console.warn(`[BOLTHAVEN EXT] Attempt ${attempt} to dispatch EXECUTE_STAGE2_STAGING failed:`, err.message);
      await delay(1000);
    }
  }

  if (!stage2Response) {
    throw lastSendError || new Error('Could not establish connection to ChatGPT tab');
  }

  if (isTwoStageStopped()) return;

  console.log('[BOLTHAVEN EXT] ✓ Hero Image generated & downloaded!', stage2Response);
  await fetch(`${COMPANION_URL}/two-stage-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_running: false,
      step: 'completed',
      extracted_prompt: extractedPrompt,
      images_attached: stage2Response.imagesAttached || 0,
      result_url: stage2Response.result_url || '',
      downloaded_file: stage2Response.filename || '',
      message: `✓ Hero Image generated and downloaded (${stage2Response.filename || 'fb_hero.png'})!`,
    }),
  }).catch(() => {});
}

// ─── Companion Polling Loop ──────────────────────────────────────────────────
// Poll the companion service every 2 seconds for pending automation commands.
// This bridges Node.js companion → Chrome extension without native messaging setup.

let isPollingCompanion = false;
let pollCycleCount = 0;

async function getExtensionProfile() {
  const stored = await chrome.storage.local.get(['profileName', 'profileKey', 'email']);
  if (stored.profileKey) {
    return { profileName: stored.profileName || stored.profileKey, profileKey: stored.profileKey };
  }
  try {
    const userInfo = await new Promise((resolve) => {
      if (chrome.identity && chrome.identity.getProfileUserInfo) {
        chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (u) => resolve(u));
      } else {
        resolve(null);
      }
    });
    if (userInfo && userInfo.email) {
      const email = userInfo.email.toLowerCase().trim();
      if (email.includes('hsuyeenandar417') || email.includes('hsu')) {
        await chrome.storage.local.set({ profileName: 'Hsu (Profile 14)', profileKey: 'Profile 14', email });
        return { profileName: 'Hsu', profileKey: 'Profile 14' };
      } else if (email.includes('notezinwai') || email.includes('zin')) {
        await chrome.storage.local.set({ profileName: 'Note Zin Wai (Profile 2)', profileKey: 'Profile 2', email });
        return { profileName: 'Note Zin Wai', profileKey: 'Profile 2' };
      }
    }
  } catch (e) {}

  return {
    profileName: stored.profileName || 'Active Chrome Profile',
    profileKey: stored.profileKey || '',
  };
}

async function pollCompanion() {
  if (isPollingCompanion) return;
  isPollingCompanion = true;
  try {
    const { profileKey, profileName } = await getExtensionProfile();

    // Every 5th cycle (~4s), push live tab group data to companion so counts stay accurate
    pollCycleCount++;
    if (pollCycleCount % 5 === 0) {
      try {
        const groups = await getTabGroupsWithTabs();
        if (groups && groups.length > 0) {
          fetch(`${COMPANION_URL}/pair-extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileName, profileKey, tabGroups: groups }),
          }).catch(() => {});
        }
      } catch (e) {}
    }

    const resp = await fetch(`${COMPANION_URL}/poll-command?profile_key=${encodeURIComponent(profileKey)}`, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.status === 'command' && data.command) {
      const { action, payload } = data.command;
      console.log('[BOLTHAVEN EXT] Received command from companion:', action, payload?.groupName || '');

      // Universal profile guard:
      // If this command is targeted to a specific profile, verify it matches this extension instance.
      // If there is a mismatch, REJECT it immediately and re-queue so the intended profile extension can pick it up!
      const cmdTargetProfile = (payload?.profileKey || payload?.profile_key || '').trim().replace(/\s+/g, '').toLowerCase();
      const myProfileKey = (profileKey || '').trim().replace(/\s+/g, '').toLowerCase();
      if (cmdTargetProfile && myProfileKey && cmdTargetProfile !== myProfileKey) {
        console.warn(`[BOLTHAVEN EXT] ⚠️ Rejecting command "${action}" targeted at "${payload?.profileKey}" — this extension is "${profileKey}". Re-queuing...`);
        fetch(`${COMPANION_URL}/requeue-command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload }),
        }).catch(() => {});
        setTimeout(pollCompanion, 150);
        return;
      }

      if (payload && (payload.profileKey || payload.profile_key)) {
        const pk = payload.profileKey || payload.profile_key;
        // Only set profileKey if not already set
        chrome.storage.local.get(['profileKey']).then((s) => {
          if (!s.profileKey) {
            chrome.storage.local.set({
              profileKey: pk,
              profileName: payload.profileName || payload.profile_name || pk,
            }).catch(() => {});
          }
        }).catch(() => {});
      }
      if (action === 'RELOAD_EXTENSION') {
        console.log('[BOLTHAVEN EXT] Reloading extension via companion command...');
        chrome.runtime.reload();
        return;
      } else if (action === 'INSPECT_CHATGPT') {
        const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const allTabs = await chrome.tabs.query({});
        const chatTab = (focusedTabs.length > 0 && (focusedTabs[0].url || '').includes('chatgpt.com'))
          ? focusedTabs[0]
          : (allTabs.find((t) => t.active && (t.url || '').includes('chatgpt.com')) || allTabs.find((t) => (t.url || '').includes('chatgpt.com')));
        if (chatTab) {
          let mainWorldInfo = null;
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: chatTab.id },
              world: 'MAIN',
              func: (shouldClick) => {
                const pm = document.querySelector('.ProseMirror, #prompt-textarea, textarea');
                let insertStatus = 'none';
                if (pm && shouldClick) {
                  pm.focus();
                  // Try document.execCommand('insertText')
                  const testText = 'Hello Test Prompt from Antigravity';
                  const sel = window.getSelection();
                  const range = document.createRange();
                  range.selectNodeContents(pm);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  const success = document.execCommand('insertText', false, testText);
                  insertStatus = `execCommand insertText: ${success}, text: ${pm.textContent}`;
                }

                const allBtns = Array.from(document.querySelectorAll('button')).map(b => ({
                  aria: b.getAttribute('aria-label'),
                  testid: b.getAttribute('data-testid'),
                  tag: b.tagName,
                  disabled: b.disabled,
                  ariaDisabled: b.getAttribute('aria-disabled'),
                  text: (b.innerText || b.textContent || '').trim().slice(0, 20),
                  rect: {
                    x: Math.round(b.getBoundingClientRect().x),
                    y: Math.round(b.getBoundingClientRect().y),
                    w: Math.round(b.getBoundingClientRect().width),
                    h: Math.round(b.getBoundingClientRect().height),
                  },
                  svg: Boolean(b.querySelector('svg')),
                  svgPath: b.querySelector('svg path')?.getAttribute('d')?.slice(0, 40) || '',
                }));

                const explicit = (
                  document.querySelector('button[data-testid="send-button"]') ||
                  document.querySelector('button[data-testid="composer-send-button"]') ||
                  document.querySelector('button[aria-label="Send prompt"]') ||
                  document.querySelector('button[aria-label="Send message"]') ||
                  document.querySelector('button[aria-label="Send"]')
                );
                let btn = explicit;
                if (!btn) {
                  // Find circular button near the bottom right of prompt textarea
                  const promptEl = document.querySelector('.ProseMirror, #prompt-textarea');
                  const pRect = promptEl?.getBoundingClientRect();
                  const candidates = Array.from(document.querySelectorAll('button')).filter(b => {
                    if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    if (aria.includes('stop') || aria.includes('editor') || aria.includes('attach') || aria.includes('mic') || aria.includes('voice') || aria.includes('model') || aria.includes('files') || aria.includes('projects')) return false;
                    const r = b.getBoundingClientRect();
                    if (r.width < 20 || r.width > 55 || r.height < 20 || r.height > 55) return false;
                    if (pRect && r.bottom < pRect.top) return false;
                    return Boolean(b.querySelector('svg'));
                  });
                  if (candidates.length > 0) {
                    candidates.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
                    btn = candidates[0];
                  }
                }

                return {
                  hasBtn: Boolean(btn),
                  btnDisabled: btn?.disabled,
                  btnAria: btn?.getAttribute('aria-label'),
                  btnTestId: btn?.getAttribute('data-testid'),
                  btnOuter: btn?.outerHTML?.slice(0, 150),
                  allBtns: allBtns.filter(b => b.svg || b.aria),
                  pmKeys,
                  pmTag: pm?.tagName,
                  insertStatus,
                };
              },
              args: [Boolean(payload?.tryClick)],
            });
            mainWorldInfo = results?.[0]?.result;
          } catch (e) {
            mainWorldInfo = { error: e.message };
          }

          await ensureContentScriptInjected(chatTab.id);
          chrome.tabs.sendMessage(chatTab.id, { action: 'INSPECT_CHATGPT', tryClick: payload?.tryClick }, (resp) => {
            const err = chrome.runtime.lastError?.message;
            fetch(`${COMPANION_URL}/report-inspect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...(resp || {}), mainWorldInfo, tabId: chatTab.id, lastError: err }),
            }).catch(() => {});
          });
        } else {
          fetch(`${COMPANION_URL}/report-inspect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'No chatgpt.com tab found in this Chrome profile' }),
          }).catch(() => {});
        }
      } else if (action === 'TEST_ATTACH') {
        const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const allTabs = await chrome.tabs.query({});
        const chatTab = (focusedTabs.length > 0 && (focusedTabs[0].url || '').includes('chatgpt.com'))
          ? focusedTabs[0]
          : (allTabs.find((t) => t.active && (t.url || '').includes('chatgpt.com')) || allTabs.find((t) => (t.url || '').includes('chatgpt.com')));
        if (chatTab) {
          await ensureContentScriptInjected(chatTab.id);
          chrome.tabs.sendMessage(chatTab.id, { action: 'TEST_ATTACH' }, (resp) => {
            fetch(`${COMPANION_URL}/report-inspect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(resp || { error: 'No response from tab' }),
            }).catch(() => {});
          });
        } else {
          fetch(`${COMPANION_URL}/report-inspect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'No chatgpt.com tab found in this Chrome profile' }),
          }).catch(() => {});
        }
      } else if (action === 'TEST_SETUP_AND_SEND') {
        const focusedTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const allTabs = await chrome.tabs.query({});
        const chatTab = (focusedTabs.length > 0 && (focusedTabs[0].url || '').includes('chatgpt.com'))
          ? focusedTabs[0]
          : (allTabs.find((t) => t.active && (t.url || '').includes('chatgpt.com')) || allTabs.find((t) => (t.url || '').includes('chatgpt.com')));
        if (chatTab) {
          await ensureContentScriptInjected(chatTab.id);
          const sampleJob = {
            job_id: 'test-job-001',
            original_position: 1,
            source_file_path: '/storage/uploads/facebook-import/FB-20261029-182451-0004/image_001.jpg',
            resolved_prompt: 'Edit the attached original interior photograph into ONE clean, detailed, professional architectural real-estate image.',
          };
          chrome.tabs.sendMessage(chatTab.id, { action: 'SETUP_AND_SEND_JOB', job: sampleJob }, (resp) => {
            fetch(`${COMPANION_URL}/report-inspect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(resp || { error: 'No response from tab' }),
            }).catch(() => {});
          });
        } else {
          fetch(`${COMPANION_URL}/report-inspect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'No chatgpt.com tab found in this Chrome profile' }),
          }).catch(() => {});
        }
      } else if (action === 'START_AUTOMATION') {
        startAutomation(payload)
          .then((result) => console.log('[BOLTHAVEN EXT] Automation start:', result))
          .catch((err) => console.warn('[BOLTHAVEN EXT] Automation start error:', err));
      } else if (action === 'START_TWO_STAGE_STAGING') {
        executeTwoStageStaging(payload).catch((err) => {
          if (twoStageAborted) return;
          console.warn('[BOLTHAVEN EXT] Two-stage staging warning:', err.message);
          fetch(`${COMPANION_URL}/two-stage-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_running: false, step: 'error', error: err.message }),
          }).catch(() => {});
        });
      } else if (action === 'STOP_AUTOMATION') {
        await stopAllExtensionAutomation();
        console.log('[BOLTHAVEN EXT] Automation stopped by companion: all tabs aborted');
      } else if (action === 'FOCUS_GROUP') {
        const { groupName, tabId, groupTabUrls, tabMode, workerCount, reuseSessionTabs } = payload || {};
        console.log('[BOLTHAVEN EXT] Direct tab group focus request:', groupName, tabId, tabMode, workerCount);
        if (tabId && !isNaN(Number(tabId))) {
          focusTab(Number(tabId));
        } else if (groupName) {
          ensureTabGroupOpen(groupName, groupTabUrls, tabMode, workerCount, reuseSessionTabs).catch((err) => {
            console.warn('[BOLTHAVEN EXT] Error ensuring tab group open:', err);
          });
        }
      } else if (action === 'OPEN_URL') {
        const { url } = payload || {};
        if (url) {
          chrome.tabs.create({ url, active: true });
        }
      }
      // If we received and processed a command, poll again quickly for any queued commands
      setTimeout(pollCompanion, 100);
    }
  } catch (e) {
    // Companion may not be running yet — silently ignore
  } finally {
    isPollingCompanion = false;
  }
}

// Poll every 500ms for swift reaction
setInterval(pollCompanion, 500);

