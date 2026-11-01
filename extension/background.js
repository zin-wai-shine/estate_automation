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

    return groups.map((g) => {
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

/** Ensure a tab has the content script injected (always re-injects to guarantee latest version). */
async function ensureContentScriptInjected(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    await delay(250);
    return true;
  } catch (e) {
    return await pingTab(tabId);
  }
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

function acquireAttachmentMutex() {
  let release;
  const newLock = new Promise((resolve) => {
    release = resolve;
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

      // Send SETUP_AND_SEND_JOB to the tab
      const setupRes = await new Promise((resolve) => {
        chrome.tabs.sendMessage(slot.tabId, { action: 'SETUP_AND_SEND_JOB', job }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from tab setup' });
          }
        });
      });

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
  'https://chatgpt.com/c/6ad49918-a4f0-83ec-acf5-efb0ef516adc',
  'https://chatgpt.com/c/6ad49924-7dd0-83ec-8205-768c67420600',
  'https://chatgpt.com/c/6ad4992a-66e8-83ec-9b11-c5e727e258d9',
  'https://chatgpt.com/c/6ad4992b-135c-83ec-b042-8c92220921d7',
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
  const clean = (groupName || 'enhance').toLowerCase().trim();
  const isHero = clean.includes('hero') || clean.includes('create') || clean.includes('stage');
  const count = isHero ? 1 : Math.max(1, Math.min(8, parseInt(workerCount, 10) || 4));
  const resolvedName = isHero ? 'FB Hero' : (groupName || 'Enhance IMG');

  console.log(`[BOLTHAVEN EXT] 🎯 Opening regular tab(s) for "${resolvedName}" (count: ${count}, mode: ${tabMode}) — No tab groups created`);

  // 1. If any old tab groups with this title exist, ungroup their tabs so they become regular tabs
  try {
    const allGroups = await chrome.tabGroups.query({});
    for (const g of allGroups) {
      const gt = (g.title || '').toLowerCase().trim();
      if (gt && (gt.includes('hero') || gt.includes('enhance') || clean.includes(gt) || gt.includes(clean))) {
        const gTabs = await chrome.tabs.query({ groupId: g.id });
        if (gTabs.length > 0) {
          console.log(`[BOLTHAVEN EXT] Ungrouping tabs from legacy group "${g.title}"...`);
          await chrome.tabs.ungroup(gTabs.map((t) => t.id)).catch(() => {});
        }
      }
    }
  } catch (e) {}

  // 2. Find existing open ChatGPT tabs
  const allTabs = await chrome.tabs.query({});
  const chatGPTTabs = allTabs.filter((t) => (t.url || t.pendingUrl || '').includes('chatgpt.com'));

  // Prioritize tabs matching target URLs if provided
  const targetUrls = Array.isArray(customUrls) && customUrls.length > 0
    ? customUrls
    : (isHero ? ['https://chatgpt.com/'] : ENHANCE_CHATGPT_DEFAULT_URLS);

  const targetKeys = new Set(targetUrls.map(getConversationKey).filter(Boolean));
  const matchedTabs = chatGPTTabs.filter((t) => {
    const k = getTabKey(t);
    return k && targetKeys.has(k);
  });

  let selectedTabs = [];
  if (matchedTabs.length > 0) {
    selectedTabs = matchedTabs.slice(0, count);
  }

  // Fill up to count from any other open ChatGPT tabs
  if (selectedTabs.length < count) {
    const selectedIds = new Set(selectedTabs.map((t) => t.id));
    for (const t of chatGPTTabs) {
      if (!selectedIds.has(t.id)) {
        selectedTabs.push(t);
        selectedIds.add(t.id);
        if (selectedTabs.length >= count) break;
      }
    }
  }

  // If still fewer than count, open missing tabs directly as regular tabs!
  const needed = count - selectedTabs.length;
  if (needed > 0) {
    console.log(`[BOLTHAVEN EXT] Opening ${needed} regular tab(s)...`);
    for (let i = 0; i < needed; i++) {
      const urlToOpen = targetUrls[selectedTabs.length + i] || targetUrls[0] || 'https://chatgpt.com/';
      const newTab = await chrome.tabs.create({ url: urlToOpen, active: false });
      selectedTabs.push(newTab);
    }
  }


  // Close any empty initial "New Tab" pages
  try {
    const blankTabs = (await chrome.tabs.query({}))
      .filter((t) => (t.url || '').includes('newtab') || (t.title || '').toLowerCase() === 'new tab');
    blankTabs.forEach((bt) => chrome.tabs.remove(bt.id).catch(() => {}));
  } catch (e) {}

  const finalTabIds = selectedTabs.map((t) => t.id).slice(0, count);
  await saveSessionTabs(resolvedName, finalTabIds);

  if (finalTabIds.length > 0) {
    await focusTab(finalTabIds[0]);
  }

  console.log(`[BOLTHAVEN EXT] ✓ Ready: ${finalTabIds.length} regular tab(s) active:`, finalTabIds);
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
    console.warn('[BOLTHAVEN EXT] Automation already running, ignoring start request');
    return { success: false, error: 'Automation already running' };
  }

  const mySessionId = ++automationSessionId;
  twoStageAborted = false;

  // 1. Immediately ensure the worker tabs are open, expanded, and focused
  await ensureTabGroupOpen(groupName || 'Enhance IMG', groupTabUrls, tabMode, maxWorkers, reuseSessionTabs).catch(() => {});
  if (mySessionId !== automationSessionId) {
    return { success: false, error: 'Automation cancelled by user' };
  }

  // 2. Wait for ChatGPT worker tabs to be ready (up to 30s)
  let activeTabIds = [];
  const waitDeadline = Date.now() + 30000;
  console.log(`[BOLTHAVEN EXT] Resolving open ChatGPT worker tabs for automation (maxWorkers: ${maxWorkers})...`);

  while (Date.now() < waitDeadline) {
    if (mySessionId !== automationSessionId) {
      return { success: false, error: 'Automation cancelled by user' };
    }
    try {
      // Priority 1: Pick tabs that belong strictly to the connected Tab Group (e.g. Enhance IMG / Enhance Image)
      const allGroups = await chrome.tabGroups.query({});
      const targetGroupName = (groupName || 'enhance').toLowerCase().trim();
      const targetGroup = allGroups.find((g) => {
        const title = (g.title || '').toLowerCase().trim();
        return (
          title.includes(targetGroupName) ||
          targetGroupName.includes(title) ||
          (targetGroupName.includes('enhance') && title.includes('enhance')) ||
          (targetGroupName.includes('hero') && title.includes('hero'))
        );
      });

      if (targetGroup) {
        const groupTabs = await chrome.tabs.query({ groupId: targetGroup.id });
        if (groupTabs.length >= maxWorkers) {
          activeTabIds = groupTabs.map((t) => t.id).slice(0, maxWorkers);
          console.log(`[BOLTHAVEN EXT] Selected all ${activeTabIds.length} tabs strictly from Tab Group "${targetGroup.title}":`, activeTabIds);
          break;
        } else if (groupTabs.length > 0 && Date.now() > waitDeadline - 8000) {
          activeTabIds = groupTabs.map((t) => t.id).slice(0, maxWorkers);
          console.log(`[BOLTHAVEN EXT] Selected ${activeTabIds.length} available tabs from Tab Group "${targetGroup.title}":`, activeTabIds);
          break;
        }
      }

      // Priority 2: If tabMode === 'new_tabs', use this group's remembered worker tabs
      if (tabMode === 'new_tabs') {
        const validSession = await loadAliveSessionTabs(groupName || 'Enhance IMG');
        if (validSession.length > 0) {
          activeTabIds = validSession.slice(0, maxWorkers);
          console.log(`[BOLTHAVEN EXT] Selected ${activeTabIds.length} remembered tabs for "${groupName}" (new_tabs mode):`, activeTabIds);
          break;
        }
      }

      const allTabs = await chrome.tabs.query({});
      const realTabIdSet = new Set(allTabs.map((t) => t.id));

      if (Array.isArray(tabIds) && tabIds.length > 0) {
        const valid = tabIds.filter((id) => typeof id === 'number' && realTabIdSet.has(id));
        if (valid.length > 0) {
          activeTabIds = valid.slice(0, maxWorkers);
          break;
        }
      }

      // Priority 2: Match tabs by worker conversation URL keys
      const targetKeys = new Set((groupTabUrls && groupTabUrls.length > 0 ? groupTabUrls : ENHANCE_CHATGPT_DEFAULT_URLS).map(getConversationKey).filter(Boolean));
      const matchedWorkerTabs = allTabs.filter((t) => {
        const k = getTabKey(t);
        return k && targetKeys.has(k);
      });
      if (matchedWorkerTabs.length > 0) {
        activeTabIds = matchedWorkerTabs.map((t) => t.id).slice(0, maxWorkers);
        console.log(`[BOLTHAVEN EXT] Selected ${activeTabIds.length} worker tabs by conversation URL:`, activeTabIds);
        break;
      }

      // Priority 3: Fallback to any open ChatGPT tabs
      const chatGPTTabs = allTabs.filter((t) => (t.url || '').includes('chatgpt.com'));
      if (chatGPTTabs.length > 0) {
        activeTabIds = chatGPTTabs.map((t) => t.id).slice(0, maxWorkers);
        break;
      }
    } catch (e) {
      console.warn('[BOLTHAVEN EXT] Error resolving active ChatGPT tabs:', e);
    }
    await delay(1000);
  }

  if (mySessionId !== automationSessionId) {
    return { success: false, error: 'Automation cancelled by user' };
  }

  activeTabIds = activeTabIds.slice(0, maxWorkers);

  if (activeTabIds.length < maxWorkers) {
    const needed = maxWorkers - activeTabIds.length;
    console.log(`[BOLTHAVEN EXT] Opening ${needed} additional ChatGPT worker tab(s) to reach ${maxWorkers} workers...`);
    for (let i = 0; i < needed; i++) {
      const idx = activeTabIds.length;
      const targetUrl = (groupTabUrls && groupTabUrls[idx]) || 'https://chatgpt.com/';
      const created = await chrome.tabs.create({ url: targetUrl, active: false });
      activeTabIds.push(created.id);
    }
  }

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

  console.log(`[BOLTHAVEN EXT] Starting sequential tab initialization for ${automation.tabSlots.length} tabs...`);

  // Sequentially setup and send each tab in strict order: Tab 1 (Image 1) -> Tab 2 (Image 2) -> Tab 3 (Image 3) -> Tab 4 (Image 4)
  (async () => {
    for (let i = 0; i < automation.tabSlots.length; i++) {
      if (!automation.isRunning || mySessionId !== automationSessionId) break;
      const initialJob = jobs[i];
      if (!initialJob) break;

      console.log(`[BOLTHAVEN EXT] Starting Tab Slot ${i + 1}/${automation.tabSlots.length} with Image #${initialJob.original_position}...`);
      processSlot(i, mySessionId, initialJob);

      // Wait until this slot completes its setup & send phase before starting the next tab
      await delay(200);
      await acquireAttachmentMutex().then((release) => {
        release();
      });
      await delay(200);
    }
  })();

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
  if (stored.profileKey && stored.profileKey !== 'Profile 14') {
    return { profileName: stored.profileName || 'Note Zin Wai', profileKey: stored.profileKey };
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
      if (email.includes('notezinwai') || email.includes('zin')) {
        await chrome.storage.local.set({ profileName: 'Note Zin Wai (Profile 2)', profileKey: 'Profile 2', email });
        return { profileName: 'Note Zin Wai', profileKey: 'Profile 2' };
      } else if (email.includes('hsuyeenandar417') || email.includes('hsu')) {
        await chrome.storage.local.set({ profileName: 'Hsu (Profile 14)', profileKey: 'Profile 14', email });
        return { profileName: 'Hsu', profileKey: 'Profile 14' };
      }
    }
  } catch (e) {}
  return {
    profileName: stored.profileName || 'Active Chrome Profile',
    profileKey: stored.profileKey || 'Profile 2',
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
      console.log('[BOLTHAVEN EXT] Received command from companion:', action);
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
            fetch(`${COMPANION_URL}/report-inspect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...(resp || {}), mainWorldInfo }),
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

