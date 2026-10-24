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
    console.error('[BOLTHAVEN EXT] Error discovering tab groups:', err);
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
    console.error('[BOLTHAVEN EXT] Error focusing tab:', e);
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

/** Ensure a tab has the content script injected (for tabs that were already open). */
async function ensureContentScriptInjected(tabId) {
  await waitForTabComplete(tabId, 25000);
  let alive = await pingTab(tabId);
  if (alive) return true;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      await delay(600);
      alive = await pingTab(tabId);
      if (alive) return true;
    } catch (e) {
      console.warn(`[BOLTHAVEN EXT] Content script injection attempt ${attempt + 1} on tab ${tabId}:`, e.message);
      await delay(800);
    }
  }
  return false;
}

/**
 * Report a completed job to the BoltHaven backend.
 * This moves the job from READY_FOR_USER → COMPLETED.
 */
async function reportJobComplete(jobId, resultUrl) {
  try {
    await fetch(`${BOLTHAVEN_URL}/api/browser/jobs/${jobId}/complete-from-tab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result_url: resultUrl,
        completed_via: 'chatgpt_tab_automation',
      }),
    });
    console.log('[BOLTHAVEN EXT] Reported job complete:', jobId);
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

/**
 * Process one job on a given tab slot.
 * When done (success or fail), automatically picks the next pending job
 * from the shared queue and processes it on the same slot.
 */
async function processSlot(slotIndex) {
  const slot = automation.tabSlots[slotIndex];
  if (!slot) return;

  while (automation.queue.length > 0 && automation.isRunning) {
    const job = automation.queue.shift(); // take the next pending job
    slot.busy = true;
    slot.currentJob = job;

    console.log(
      `[BOLTHAVEN EXT] Tab ${slot.tabId} → processing job ${job.job_id} (Image #${job.original_position})`
    );

    // Focus this tab
    await focusTab(slot.tabId);

    // Make sure content script is injected
    await ensureContentScriptInjected(slot.tabId);

    try {
      const result = await dispatchJobToTab(slot.tabId, job);

      if (result && result.success) {
        automation.completedCount++;
        await reportJobComplete(job.job_id, result.result?.result_url || '');
        console.log(`[BOLTHAVEN EXT] ✓ Job ${job.job_id} completed on tab ${slot.tabId}`);

        // Notify BoltHaven UI of progress
        notifyProgress();
      } else {
        automation.failedCount++;
        await reportJobFailed(job.job_id, result?.error || 'Unknown content script error');
        console.warn(`[BOLTHAVEN EXT] ✗ Job ${job.job_id} failed:`, result?.error);
      }
    } catch (err) {
      automation.failedCount++;
      await reportJobFailed(job.job_id, err.message);
      console.error(`[BOLTHAVEN EXT] Exception processing job ${job.job_id}:`, err);
    }

    slot.busy = false;
    slot.currentJob = null;

    // Brief pause between images on the same tab to avoid rate limits
    await delay(1500);
  }

  // This slot has finished; check if all slots are done
  const allDone = automation.tabSlots.every((s) => !s.busy && automation.queue.length === 0);
  if (allDone && automation.isRunning) {
    finishAutomation();
  }
}

function notifyProgress() {
  const total = automation.completedCount + automation.failedCount + automation.queue.length;
  // Notify the companion service so the frontend can poll queue status
  fetch(`${COMPANION_URL}/automation-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_id: automation.propertyId,
      completed: automation.completedCount,
      failed: automation.failedCount,
      remaining: automation.queue.length,
    }),
  }).catch(() => {});
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
    }),
  }).catch(() => {});
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
  let { tabIds, jobs, propertyId } = payload || {};

  if (automation.isRunning) {
    console.warn('[BOLTHAVEN EXT] Automation already running, ignoring start request');
    return { success: false, error: 'Automation already running' };
  }

  // 1. Wait for ChatGPT worker tabs to open and finish loading in Chrome (up to 30s)
  let activeTabIds = [];
  const waitDeadline = Date.now() + 30000;
  console.log('[BOLTHAVEN EXT] Resolving open ChatGPT worker tabs (will wait for tabs to load)...');

  while (Date.now() < waitDeadline) {
    try {
      const allTabs = await chrome.tabs.query({});
      const realTabIdSet = new Set(allTabs.map((t) => t.id));

      if (Array.isArray(tabIds) && tabIds.length > 0) {
        const valid = tabIds.filter((id) => typeof id === 'number' && realTabIdSet.has(id));
        if (valid.length > 0) {
          activeTabIds = valid;
          break;
        }
      }

      const chatGPTTabs = allTabs.filter((t) => (t.url || '').includes('chatgpt.com'));
      if (chatGPTTabs.length > 0) {
        // Take up to 4 ChatGPT tabs
        activeTabIds = chatGPTTabs.map((t) => t.id).slice(0, 4);
        break;
      }
    } catch (e) {
      console.warn('[BOLTHAVEN EXT] Error resolving active ChatGPT tabs:', e);
    }
    await delay(1000);
  }

  if (activeTabIds.length === 0) {
    return { success: false, error: 'No active ChatGPT worker tabs found. Please ensure ChatGPT tabs are open.' };
  }

  // 2. If jobs not passed or empty, fetch pending jobs from the backend queue
  if ((!jobs || jobs.length === 0) && propertyId) {
    try {
      const qRes = await fetch(`${BOLTHAVEN_URL}/api/browser/queue/${propertyId}`);
      if (qRes.ok) {
        const qData = await qRes.json();
        const rawJobs = qData.queue || qData.jobs || [];
        jobs = rawJobs.filter((j) => {
          const s = String(j.status || '').toUpperCase();
          return s === 'PENDING' || s === 'READY_FOR_USER';
        });
      }
    } catch (fetchErr) {
      console.warn('[BOLTHAVEN EXT] Could not fetch queue from backend:', fetchErr);
    }
  }

  if (!jobs || jobs.length === 0) {
    return { success: false, error: 'No pending jobs found for this property' };
  }

  console.log(
    `[BOLTHAVEN EXT] Starting automation: ${jobs.length} images distributed across ${activeTabIds.length} tabs`
  );

  // Initialise automation state
  automation.isRunning = true;
  automation.propertyId = propertyId;
  automation.queue = [...jobs];
  automation.completedCount = 0;
  automation.failedCount = 0;
  automation.tabSlots = activeTabIds.map((tabId) => ({ tabId, busy: false, currentJob: null }));

  // Launch one concurrent worker per tab slot (up to 4 parallel tabs)
  for (let i = 0; i < automation.tabSlots.length; i++) {
    processSlot(i); // intentionally NOT awaited — all slots run in parallel
  }

  return { success: true, message: `Automation started: ${jobs.length} jobs on ${activeTabIds.length} tabs` };
}

// ─── Message Router ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Image download handler via chrome.downloads API
  if (request.action === 'DOWNLOAD_IMAGE') {
    chrome.downloads.download(
      {
        url: request.url,
        filename: request.filename || `enhanced_${Date.now()}.png`,
        saveAs: false,
        conflictAction: 'overwrite',
      },
      (downloadId) => {
        sendResponse({ success: Boolean(downloadId), downloadId });
      }
    );
    return true;
  }

  // Fetch image as base64 to avoid CSP/Mixed content restrictions on ChatGPT page
  if (request.action === 'FETCH_IMAGE_BASE64') {
    let targetUrl = request.url || '';
    if (targetUrl.startsWith('/')) {
      targetUrl = `${BOLTHAVEN_URL}${targetUrl}`;
    }
    fetch(targetUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} fetching image`);
        return r.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => sendResponse({ success: true, dataUrl: reader.result });
        reader.onerror = (e) => sendResponse({ success: false, error: e.message });
        reader.readAsDataURL(blob);
      })
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
    automation.isRunning = false;
    automation.queue = [];
    sendResponse({ success: true, message: 'Automation stopped' });
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

// ── Two-Stage Staging Orchestration (Group 2: Tab 1 Prompt -> Tab 2 Staging) ──
async function executeTwoStageStaging(payload) {
  const { profileKey, groupName, initialPrompt, referenceImage, condoImages, condoName } = payload;
  console.log(`[BOLTHAVEN EXT] 🚀 Starting Two-Stage Staging for "${condoName}" in group "${groupName}"...`);

  await fetch(`${COMPANION_URL}/two-stage-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_running: true, step: 'locating_tab_group', condo_name: condoName }),
  }).catch(() => {});

  // 1. Locate the target tab group (e.g. "FB Hero")
  const groups = await new Promise((r) => chrome.tabGroups.query({}, r));
  const cleanTarget = (groupName || 'fb hero').toLowerCase().trim();
  const matchGroup = (groups || []).find((g) => {
    const t = (g.title || '').toLowerCase().trim();
    return t && (t.includes(cleanTarget) || cleanTarget.includes(t));
  });

  if (!matchGroup) {
    throw new Error(`Tab group "${groupName}" not found in current Chrome profile.`);
  }

  // 2. Query tabs in this group
  const tabs = await new Promise((r) => chrome.tabs.query({ groupId: matchGroup.id }, r));
  if (!tabs || tabs.length < 2) {
    throw new Error(`Tab group "${groupName}" must contain at least 2 tabs (found ${tabs ? tabs.length : 0}).`);
  }

  const tab1 = tabs[0];
  const tab2 = tabs[1];

  // 3. Step 1: Focus Tab 1 and extract generated prompt
  console.log('[BOLTHAVEN EXT] Focusing Tab 1:', tab1.id, tab1.title);
  await focusTab(tab1.id);
  await new Promise((r) => setTimeout(r, 600));

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

  const extractedPrompt = stage1Response.extractedPrompt || '';
  console.log('[BOLTHAVEN EXT] ✓ Stage 1 prompt extracted, length:', extractedPrompt.length);

  await fetch(`${COMPANION_URL}/two-stage-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'stage1_completed',
      extracted_prompt: extractedPrompt,
      message: 'Tab 1 prompt extracted successfully! Proceeding to Tab 2...'
    }),
  }).catch(() => {});

  // 4. Step 2: Focus Tab 2 and assemble images + prompt
  console.log('[BOLTHAVEN EXT] Focusing Tab 2:', tab2.id, tab2.title);
  await focusTab(tab2.id);
  await new Promise((r) => setTimeout(r, 800));

  await fetch(`${COMPANION_URL}/two-stage-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'stage2_running',
      message: 'Pasting reference image, condo images 1, 2, 3, and prompt in Tab 2...'
    }),
  }).catch(() => {});

  const stage2Response = await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab2.id, {
      action: 'EXECUTE_STAGE2_STAGING',
      extractedPrompt,
      referenceImage, // manual example image pasted 1st
      condoImages,    // 1.png, 2.png, 3.png pasted 2nd
    }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res || !res.success) return reject(new Error(res?.error || 'Failed to execute staging in Tab 2'));
      resolve(res);
    });
  });

  console.log('[BOLTHAVEN EXT] ✓ Stage 2 completed successfully!');
  await fetch(`${COMPANION_URL}/two-stage-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      is_running: false,
      step: 'completed',
      extracted_prompt: extractedPrompt,
      images_attached: stage2Response.imagesAttached || 0,
      message: 'Stage 2 submitted with reference photo, condo images 1,2,3, and prompt!'
    }),
  }).catch(() => {});
}

// ─── Companion Polling Loop ──────────────────────────────────────────────────
// Poll the companion service every 2 seconds for pending automation commands.
// This bridges Node.js companion → Chrome extension without native messaging setup.

let isPollingCompanion = false;
let pollCycleCount = 0;

async function pollCompanion() {
  if (isPollingCompanion) return;
  isPollingCompanion = true;
  try {
    // Every 5th cycle (~4s), push live tab group data to companion so counts stay accurate
    pollCycleCount++;
    if (pollCycleCount % 5 === 0) {
      try {
        const stored = await chrome.storage.local.get(['profileName', 'profileKey']);
        const profileName = stored.profileName || 'Hsu (Profile 14)';
        const profileKey = stored.profileKey || 'Profile 14';
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

    const resp = await fetch(`${COMPANION_URL}/poll-command`);
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.status === 'command' && data.command) {
      const { action, payload } = data.command;
      console.log('[BOLTHAVEN EXT] Received command from companion:', action);
      if (action === 'START_AUTOMATION') {
        const result = await startAutomation(payload);
        console.log('[BOLTHAVEN EXT] Automation start:', result);
      } else if (action === 'START_TWO_STAGE_STAGING') {
        executeTwoStageStaging(payload).catch((err) => {
          console.error('[BOLTHAVEN EXT] Two-stage staging error:', err);
          fetch(`${COMPANION_URL}/two-stage-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_running: false, step: 'error', error: err.message }),
          }).catch(() => {});
        });
      } else if (action === 'STOP_AUTOMATION') {
        automation.isRunning = false;
        automation.queue = [];
        if (Array.isArray(automation.tabSlots)) {
          automation.tabSlots.forEach((slot) => {
            if (slot.tabId) {
              chrome.tabs.sendMessage(slot.tabId, { action: 'STOP_TAB_JOB' }).catch(() => {});
            }
          });
        }
        console.log('[BOLTHAVEN EXT] Automation stopped by companion: all tabs aborted');
      } else if (action === 'FOCUS_GROUP') {
        const { groupName, tabId, groupTabUrls } = payload || {};
        console.log('[BOLTHAVEN EXT] Focus group request:', groupName, tabId);
        if (tabId && !isNaN(Number(tabId))) {
          focusTab(Number(tabId));
        } else if (groupName) {
          chrome.tabGroups.query({}, (groups) => {
            const clean = (groupName || 'enhance').toLowerCase().trim();
            const match = (groups || []).find((g) => {
              const gt = (g.title || '').toLowerCase().trim();
              return gt && (gt.includes(clean) || clean.includes(gt));
            });
            if (match) {
              chrome.tabGroups.update(match.id, { collapsed: false }).catch(() => {});
              chrome.tabs.query({ groupId: match.id }, (tabs) => {
                if (tabs && tabs.length > 0) {
                  focusTab(tabs[0].id);
                }
              });
            } else if (groupTabUrls && groupTabUrls.length > 0) {
              Promise.all(groupTabUrls.map((u) => chrome.tabs.create({ url: u, active: false }))).then((newTabs) => {
                const tabIds = newTabs.map((t) => t.id);
                chrome.tabs.group({ tabIds }, (groupId) => {
                  chrome.tabGroups.update(groupId, { title: groupName || 'Enhance IMG', color: 'blue', collapsed: false }).catch(() => {});
                  if (tabIds.length > 0) {
                    focusTab(tabIds[0]);
                  }
                });
              });
            }
          });
        }
      }
    }
  } catch (e) {
    // Companion may not be running yet — silently ignore
  } finally {
    isPollingCompanion = false;
  }
}

// Poll every 800ms for swift reaction
setInterval(pollCompanion, 800);

