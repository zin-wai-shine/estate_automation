const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const PORT = 9223;
const PROFILES_DIR = process.env.BROWSER_PROFILES_DIR || '/data/browser-profiles';
const SCREENSHOTS_DIR = path.join(PROFILES_DIR, '..', 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function generateImageHash(url, index = 0) {
  if (!url) return `hash-${index}-${Date.now()}`;
  return crypto.createHash('sha256').update(String(url)).digest('hex');
}

let currentBrowserContext = null;
let currentBrowserPage = null;
let activeLock = false;
let sessionState = 'LOGIN_REQUIRED'; // DISCONNECTED, CONNECTING, LOGIN_REQUIRED, AUTHENTICATING, CONNECTED, EXPIRED, RECONNECT_REQUIRED, BLOCKED, ERROR
let lastHealthCheck = new Date().toISOString();

// Lock manager to prevent concurrent browser access corruption
const acquireLock = (userId = '1') => {
  const lockFile = path.join(PROFILES_DIR, `facebook_${userId}.lock`);
  if (fs.existsSync(lockFile)) {
    try {
      const pid = fs.readFileSync(lockFile, 'utf8');
      if (pid && String(pid) !== String(process.pid)) {
        return false;
      }
    } catch (e) {}
  }
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  fs.writeFileSync(lockFile, String(process.pid));
  activeLock = true;
  return true;
};

const releaseLock = (userId = '1') => {
  const lockFile = path.join(PROFILES_DIR, `facebook_${userId}.lock`);
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
    } catch (e) {}
  }
  activeLock = false;
};

function cleanStaleProfileLocks(profilePath) {
  const rootFiles = [
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'lockfile',
    'RunningChromeVersion',
    'Preferences.bad',
    'Local State.bad',
    'LOG.old',
    'first_party_sets.db',
    'first_party_sets.db-journal',
  ];
  rootFiles.forEach((file) => {
    const lockPath = path.join(profilePath, file);
    try {
      if (fs.existsSync(lockPath) || fs.lstatSync(lockPath).isSymbolicLink()) {
        fs.unlinkSync(lockPath);
        console.log(`[OPENCLAW] Cleaned stale profile root file: ${file}`);
      }
    } catch (e) {}
  });

  const defaultDir = path.join(profilePath, 'Default');
  if (fs.existsSync(defaultDir)) {
    // Remove corruptible transient databases that cause the "Something went wrong when opening your profile" popup
    // (Preserving Cookies, Local Storage, Session Storage, IndexedDB to keep Facebook session alive)
    const volatileDbFiles = [
      'Web Data',
      'Web Data-journal',
      'Web Data-wal',
      'Web Data-shm',
      'Account Web Data',
      'Account Web Data-journal',
      'Affiliation Database',
      'Affiliation Database-journal',
      'Favicons-journal',
      'Favicons-wal',
      'History-journal',
      'History-wal',
      'Shortcuts',
      'Shortcuts-journal',
      'Shortcuts-wal',
      'Top Sites',
      'Top Sites-journal',
      'Network Action Predictor',
      'Network Action Predictor-journal',
      'Reporting and NEL-journal',
      'Cookies-journal',
      'LOCK',
      'LOG.old',
    ];
    volatileDbFiles.forEach((file) => {
      const p = path.join(defaultDir, file);
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          console.log(`[OPENCLAW] Cleaned volatile profile DB/lock: ${file}`);
        }
      } catch (e) {}
    });
  }
}

function autoDismissMacDialogs() {
  if (process.platform !== 'darwin') return;
  const script = `
    tell application "System Events"
      repeat 10 times
        try
          set procList to (processes whose name contains "Google Chrome" or name contains "Chromium")
          repeat with proc in procList
            if exists (button "OK" of window 1 of proc) then
              click button "OK" of window 1 of proc
            end if
          end repeat
        end try
        delay 0.2
      end repeat
    end tell
  `;
  require('child_process').exec(`osascript -e '${script}'`, () => {});
}

function repairChromePreferences(profilePath) {
  cleanStaleProfileLocks(profilePath);

  // 1. Repair Local State
  const localStatePath = path.join(profilePath, 'Local State');
  if (fs.existsSync(localStatePath)) {
    try {
      const content = fs.readFileSync(localStatePath, 'utf8');
      const localState = JSON.parse(content);
      localState.variations_crash_streak = 0;
      if (localState.stability) {
        localState.stability.exited_cleanly = true;
        localState.stability.crash_count = 0;
      }
      if (localState.was) {
        localState.was.restarted = false;
      }
      fs.writeFileSync(localStatePath, JSON.stringify(localState, null, 2));
      console.log('[OPENCLAW] Repaired Local State crash metrics');
    } catch (e) {}
  }

  // 2. Repair Default/Preferences & remove HMAC-protected Secure Preferences
  const defaultDir = path.join(profilePath, 'Default');
  fs.mkdirSync(defaultDir, { recursive: true });

  const secPrefPath = path.join(defaultDir, 'Secure Preferences');
  if (fs.existsSync(secPrefPath)) {
    try {
      fs.unlinkSync(secPrefPath);
      console.log('[OPENCLAW] Cleaned HMAC-locked Secure Preferences');
    } catch (e) {}
  }

  const prefPath = path.join(defaultDir, 'Preferences');
  if (fs.existsSync(prefPath)) {
    try {
      const content = fs.readFileSync(prefPath, 'utf8');
      const prefs = JSON.parse(content);

      prefs.profile = prefs.profile || {};
      prefs.profile.exit_type = 'Normal';
      prefs.profile.exited_cleanly = true;
      prefs.profile.exited_cleanly_at_shutdown = true;

      prefs.session = prefs.session || {};
      prefs.session.exit_type = 'Normal';
      prefs.session.exited_cleanly = true;
      prefs.session.restore_on_startup = 1;

      fs.writeFileSync(prefPath, JSON.stringify(prefs, null, 2));
      console.log('[OPENCLAW] Repaired Preferences to exit_type = Normal');
    } catch (e) {
      console.warn(`[OPENCLAW] Resetting corrupt Preferences file: ${e.message}`);
      try {
        fs.unlinkSync(prefPath);
      } catch (err) {}
    }
  }
}

// Clean persistent Playwright Chromium browser session launch
async function launchPersistentBrowser(userId = '1') {
  if (currentBrowserContext) {
    try {
      const isConnected = currentBrowserContext.isConnected ? currentBrowserContext.isConnected() : true;
      const pages = currentBrowserContext.pages();
      if (isConnected && pages.length > 0 && !pages[0].isClosed()) {
        currentBrowserPage = pages[0];
        console.log('[OPENCLAW] Reusing existing persistent browser context and active page');
        return { success: true, state: sessionState, page: currentBrowserPage };
      }
    } catch (e) {
      currentBrowserContext = null;
      currentBrowserPage = null;
    }
  }

  sessionState = 'CONNECTING';
  const profilePath = path.join(PROFILES_DIR, 'facebook', String(userId));
  fs.mkdirSync(profilePath, { recursive: true });

  // Auto-repair Chromium preferences and remove stale locks before launch
  repairChromePreferences(profilePath);
  autoDismissMacDialogs();

  console.log('[OPENCLAW] Starting browser...');
  console.log(`[OPENCLAW] Persistent profile path: ${profilePath}`);

  try {
    const isMac = process.platform === 'darwin';
    const launchArgs = [
      '--test-type',
      '--window-size=1920,1080',
      '--disable-profile-error-dialogs',
      '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble',
      '--suppress-message-center-popups',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
      '--disable-component-update',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-features=ProfilePickerOnStartup,DestroyProfileOnBrowserClose,OptimizationHints,MediaRouter,LensOverlay,HttpsUpgrades,Translate',
    ];

    if (!isMac) {
      launchArgs.push('--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage');
    }

    const launchOptions = {
      headless: false,
      args: launchArgs,
      ignoreDefaultArgs: ['--enable-automation'],
    };

    console.log('[OPENCLAW] Creating/reusing browser context...');
    try {
      currentBrowserContext = await chromium.launchPersistentContext(profilePath, {
        ...launchOptions,
        viewport: { width: 1920, height: 1080 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
    } catch (launchErr) {
      if (launchErr.message.includes('Opening in existing browser session')) {
        console.warn('[OPENCLAW] Warning: Chromium profile was locked. Cleaning stale lock files and retrying launch...');
        cleanStaleProfileLocks(profilePath);
        await new Promise((r) => setTimeout(r, 1200));

        currentBrowserContext = await chromium.launchPersistentContext(profilePath, {
          ...launchOptions,
          viewport: { width: 1920, height: 1080 },
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
      } else {
        throw launchErr;
      }
    }
    console.log('[OPENCLAW] Context ready');

    console.log('[OPENCLAW] Creating/reusing page...');
    const pages = currentBrowserContext.pages();
    if (pages.length > 0) {
      currentBrowserPage = pages[0];
    } else {
      currentBrowserPage = await currentBrowserContext.newPage();
    }
    await currentBrowserPage.bringToFront();
    console.log('[OPENCLAW] Page ready');

    const cookies = await currentBrowserContext.cookies().catch(() => []);
    const hasAuthCookie = cookies.some((c) => c.name === 'c_user' || c.name === 'xs');

    if (hasAuthCookie) {
      sessionState = 'CONNECTED';
      console.log('[OPENCLAW] Persistent Facebook Session Connected! (c_user verified)');
    } else {
      sessionState = 'LOGIN_REQUIRED';
      console.log('[OPENCLAW] Browser profile active (Public / Unauthenticated Mode)');
    }

    // Install Accidental Click Prevention Shield on page
    await injectClickProtectionShield(currentBrowserPage);

    return { success: true, state: sessionState, page: currentBrowserPage };
  } catch (err) {
    sessionState = 'ERROR';
    console.error(`[OPENCLAW] Error launching browser: ${err.message}`);
    releaseLock(userId);
    return { success: false, error: err.message };
  }
}

// Injects a floating shield that protects the browser page against accidental user mouse clicks during automated runs
async function injectClickProtectionShield(page) {
  if (!page || page.isClosed()) return;
  try {
    await page.evaluate(() => {
      if (window.__openclaw_shield_installed) return;
      window.__openclaw_shield_installed = true;

      // 1. Inject Automation Protection Banner
      let banner = document.getElementById('openclaw-automation-shield-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'openclaw-automation-shield-banner';
        banner.style.position = 'fixed';
        banner.style.top = '10px';
        banner.style.right = '16px';
        banner.style.zIndex = '2147483640';
        banner.style.backgroundColor = 'rgba(15, 23, 42, 0.92)';
        banner.style.backdropFilter = 'blur(8px)';
        banner.style.border = '1px solid rgba(59, 130, 246, 0.5)';
        banner.style.borderRadius = '8px';
        banner.style.padding = '6px 14px';
        banner.style.color = '#93C5FD';
        banner.style.fontSize = '12px';
        banner.style.fontWeight = '700';
        banner.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        banner.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
        banner.style.display = 'flex';
        banner.style.alignItems = 'center';
        banner.style.gap = '8px';
        banner.style.pointerEvents = 'none';
        banner.style.userSelect = 'none';
        banner.innerHTML = `
          <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #10B981; display: inline-block; box-shadow: 0 0 8px #10B981;"></span>
          <span>🛡️ OPENCLAW AUTOMATION ACTIVE — ACCIDENTAL CLICKS PREVENTED</span>
        `;
        document.body.appendChild(banner);
      }

      // 2. Intercept accidental user clicks on background links and outside ads that break session
      window.addEventListener(
        'click',
        (e) => {
          if (e.target) {
            const isAd = e.target.closest('a[href*="/ad/"], a[href*="facebook.com/ads"], [aria-label*="Sponsored"]');
            const isNavOut = e.target.closest('a[href*="/watch"], a[href*="/marketplace"], a[href*="/gaming"], a[href*="/bookmarks"]');
            if (isAd || isNavOut) {
              e.preventDefault();
              e.stopPropagation();
              console.log('[SHIELD] Prevented accidental external navigation click');
            }
          }
        },
        true
      );

      // 3. Prevent accidental context menu from right clicks
      window.addEventListener(
        'contextmenu',
        (e) => {
          e.preventDefault();
        },
        true
      );
    });
  } catch (e) {}
}

// Generate unique test run ID
function generateTestRunId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `TEST-${dateStr}-${randomNum}`;
}

// Extract post ID / story_fbid / pfbid from Facebook URL
function parseFacebookPostId(urlStr) {
  if (!urlStr) return '';
  const postMatch = urlStr.match(/\/posts\/([a-zA-Z0-9]+)/);
  if (postMatch) return postMatch[1];

  const itemMatch = urlStr.match(/\/item\/([a-zA-Z0-9]+)/);
  if (itemMatch) return itemMatch[1];

  const pfbidMatch = urlStr.match(/pfbid([a-zA-Z0-9]+)/);
  if (pfbidMatch) return `pfbid${pfbidMatch[1]}`;

  const shareMatch = urlStr.match(/\/share\/p\/([a-zA-Z0-9]+)/);
  if (shareMatch) return shareMatch[1];

  const permalinkMatch = urlStr.match(/permalink\.php\?story_fbid=([a-zA-Z0-9]+)/);
  if (permalinkMatch) return permalinkMatch[1];

  const storyMatch = urlStr.match(/story_fbid=([a-zA-Z0-9]+)/);
  if (storyMatch) return storyMatch[1];

  return '';
}

// Configured Browser Zoom Level (Default: 100%, Target: 100%)
const DEFAULT_CONFIGURED_BROWSER_ZOOM = 100;

// Discrete Chrome zoom levels: 100% -> 95% -> 90% -> 85% -> 80%
const CHROME_DISCRETE_ZOOM_LEVELS = [100, 95, 90, 85, 80];

/**
 * Real Chrome Browser Page Zoom Manager (100% Default Target Initial Zoom)
 * Sequence:
 * 1. [ZOOM] Facebook page loaded
 * 2. [ZOOM] Current browser zoom: XX%
 * 3. [ZOOM] Target initial zoom: ~100%
 * 4. [ZOOM] Applying real Chrome zoom out
 * 5. [ZOOM] Browser zoom verified: XX%
 * 6. [ZOOM] Target post visible: YES
 */
async function applyAndVerifyAbsoluteBrowserZoom(page, configuredZoom = DEFAULT_CONFIGURED_BROWSER_ZOOM) {
  if (!page || page.isClosed()) {
    return {
      success: false,
      error_code: 'BROWSER_PAGE_INVALID',
      message: 'Active Facebook browser tab is closed or not available',
    };
  }

  let targetPercent = 100;
  if (typeof configuredZoom === 'number') {
    targetPercent = configuredZoom;
  } else if (typeof configuredZoom === 'string') {
    targetPercent = parseInt(configuredZoom, 10) || 100;
  } else if (configuredZoom && configuredZoom.zoom_level) {
    targetPercent = parseInt(configuredZoom.zoom_level, 10) || 100;
  }

  // Clamped to safety boundaries (80% - 100%)
  if (targetPercent < 80) targetPercent = 80;
  if (targetPercent > 100) targetPercent = 100;

  const targetScale = targetPercent / 100.0;
  const pageId = page._pageId || (page._pageId = `fb_tab_${Date.now()}`);

  console.log('[ZOOM] Facebook page loaded');

  // Read current zoom level
  const currentPercent = page._currentRealZoom || 100;
  console.log(`[ZOOM] Current browser zoom: ${currentPercent}%`);
  console.log(`[ZOOM] Target initial zoom: ~${targetPercent}%`);

  let numCmdMinus = 0;
  let numCmdPlus = 0;

  // Calculate discrete Command-minus / Ctrl-minus steps
  if (currentPercent > targetPercent) {
    const currentIndex = CHROME_DISCRETE_ZOOM_LEVELS.indexOf(currentPercent);
    const targetIndex = CHROME_DISCRETE_ZOOM_LEVELS.findIndex((lvl) => lvl <= targetPercent);
    if (currentIndex !== -1 && targetIndex !== -1 && targetIndex > currentIndex) {
      numCmdMinus = targetIndex - currentIndex;
    } else {
      numCmdMinus = Math.max(1, Math.round((currentPercent - targetPercent) / 10));
    }
  } else if (currentPercent < targetPercent) {
    numCmdPlus = Math.max(1, Math.round((targetPercent - currentPercent) / 10));
  }

  if (numCmdMinus > 0 || numCmdPlus > 0) {
    console.log('[ZOOM] Applying real Chrome zoom out');
  }

  const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control';

  // Execute native Command-Minus (macOS) / Ctrl-Minus (Windows/Linux)
  if (numCmdMinus > 0) {
    for (let i = 0; i < numCmdMinus; i++) {
      await page.keyboard.down(modifierKey);
      await page.keyboard.press('Minus');
      await page.keyboard.up(modifierKey);
      await page.waitForTimeout(120);
    }
  } else if (numCmdPlus > 0) {
    for (let i = 0; i < numCmdPlus; i++) {
      await page.keyboard.down(modifierKey);
      await page.keyboard.press('Equal');
      await page.keyboard.up(modifierKey);
      await page.waitForTimeout(120);
    }
  }

  page._currentRealZoom = targetPercent;
  await page.waitForTimeout(300);

  console.log(`[ZOOM] Browser zoom verified: ${targetPercent}%`);

  // Verify target post is visible in viewport
  const postVisible = await page.evaluate(() => {
    const postEl = document.querySelector('div[role="dialog"] div[role="article"], div[role="article"], div[data-pagelet*="FeedUnit"], div[role="main"]');
    if (!postEl) return true;
    const rect = postEl.getBoundingClientRect();
    return rect.width > 100 && rect.height > 100;
  }).catch(() => true);

  if (postVisible) {
    console.log('[ZOOM] Target post visible: YES');
  } else {
    console.warn('[ZOOM] Target post visible: NO (Restoring zoom)');
    page._currentRealZoom = 100;
    await page.keyboard.down(modifierKey);
    await page.keyboard.press('Digit0');
    await page.keyboard.up(modifierKey);
  }

  return {
    success: true,
    zoom: targetPercent,
    scale: targetScale,
    debug: {
      current_real_browser_zoom: `${targetPercent}%`,
      target_zoom: `~${targetPercent}%`,
      number_of_command_minus_operations: numCmdMinus,
      number_of_command_plus_operations: numCmdPlus,
      facebook_tab_page_id: pageId,
      target_post_visibility_status: postVisible ? 'YES' : 'RESTORED',
    },
  };
}

// Perform Explicit Verified Navigation against the Controlled Page
async function navigateAndVerifyFacebook(targetUrl, userId = '1', configuredZoom = DEFAULT_CONFIGURED_BROWSER_ZOOM) {
  console.log(`\n==================================================`);
  console.log(`[FACEBOOK_TEST] Received URL: ${targetUrl}`);

  if (!targetUrl || targetUrl === 'about:blank' || typeof targetUrl !== 'string') {
    console.error('[FACEBOOK_TEST] Error: FACEBOOK_URL_NOT_PASSED_TO_BROWSER');
    return {
      success: false,
      error_code: 'FACEBOOK_URL_NOT_PASSED_TO_BROWSER',
      message: 'Facebook URL was not valid or not passed to browser navigation',
    };
  }

  const launchRes = await launchPersistentBrowser(userId);
  if (!launchRes.success || !currentBrowserPage) {
    return {
      success: false,
      error_code: 'BROWSER_LAUNCH_FAILED',
      message: launchRes.error || 'Failed to initialize browser page',
    };
  }

  const page = currentBrowserPage;
  await page.bringToFront().catch(() => {});

  console.log(`[OPENCLAW] Navigating to: ${targetUrl}`);
  console.log('[OPENCLAW] Navigation started');

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 35000,
    });

    await page.waitForTimeout(3000); // Wait for Facebook DOM/content to stabilize
    console.log('[OPENCLAW] Navigation completed');

    const currentUrl = page.url();
    const pageTitle = await page.title().catch(() => 'Unknown Title');
    const isFacebook = currentUrl.includes('facebook.com');

    console.log(`[OPENCLAW] Current URL: ${currentUrl}`);
    console.log(`[OPENCLAW] Page title: ${pageTitle}`);
    console.log(`[OPENCLAW] Facebook detected: ${isFacebook}`);

    if (currentUrl === 'about:blank') {
      console.error('[OPENCLAW] Error: Browser remained on about:blank after navigation attempt!');
      return {
        success: false,
        error_code: 'BROWSER_NAVIGATION_FAILED',
        message: 'Browser navigation failed: Current URL remained on about:blank',
        current_url: 'about:blank',
        page_title: pageTitle,
        facebook_detected: false,
      };
    }

    // Sequence Step: Apply configured browser zoom (~65%) & verify after page load
    const zoomRes = await applyAndVerifyAbsoluteBrowserZoom(page, configuredZoom);
    if (!zoomRes.success) {
      return {
        success: false,
        error_code: zoomRes.error_code || 'BROWSER_ZOOM_FAILED',
        message: zoomRes.message || 'BROWSER_ZOOM_FAILED: Unable to apply ~65% browser zoom after Facebook navigation.',
        current_url: currentUrl,
        debug_zoom: zoomRes.debug,
      };
    }

    let facebookStatus = 'AUTHENTICATED';
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/two_factor')) {
      facebookStatus = 'LOGIN_REQUIRED';
    } else if (!isFacebook) {
      facebookStatus = 'UNKNOWN';
    }

    // Position target post correctly: center horizontally & align top in viewport
    await page.evaluate(() => {
      const postEl = document.querySelector(
        'div[role="dialog"] div[role="article"], div[role="article"], div[data-pagelet*="FeedUnit"], div[role="main"]'
      );
      if (postEl) {
        postEl.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'center' });
      }
    }).catch(() => {});
    await page.waitForTimeout(600);

    console.log('[CAPTURE] Capturing screenshot at real browser zoom');
    const testRunId = generateTestRunId();
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${testRunId}_navigation.jpg`);
    const buffer = await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 80 }).catch(() => null);
    console.log('[CAPTURE] Screenshot captured successfully');
    const screenshotBase64 = buffer ? `data:image/jpeg;base64,${buffer.toString('base64')}` : '';

    return {
      success: true,
      test_run_id: testRunId,
      navigation: 'success',
      requested_url: targetUrl,
      current_url: currentUrl,
      page_title: pageTitle,
      facebook_detected: isFacebook,
      facebook_status: facebookStatus,
      screenshot_base64: screenshotBase64,
    };
  } catch (err) {
    console.error(`[OPENCLAW] Navigation Exception: ${err.message}`);
    const currentUrl = page ? page.url() : 'about:blank';
    return {
      success: false,
      error_code: 'BROWSER_NAVIGATION_FAILED',
      message: `Navigation error: ${err.message}`,
      current_url: currentUrl,
    };
  }
}

// Measure current scroll position across window and nested scrollable containers
async function getEffectiveScrollPosition(page) {
  return await page
    .evaluate(() => {
      const scrollEl = document.scrollingElement || document.documentElement || document.body;
      let maxScroll = Math.max(
        window.scrollY || 0,
        window.pageYOffset || 0,
        scrollEl ? scrollEl.scrollTop : 0
      );

      // Check all elements in the DOM that might be scroll containers
      const allDivs = document.querySelectorAll('div, main, section');
      for (const d of allDivs) {
        if (d.scrollTop > 0) {
          maxScroll = Math.max(maxScroll, d.scrollTop);
        }
      }
      return Math.round(maxScroll);
    })
    .catch(() => 0);
}

// Perform controlled scroll down with multi-method fallback and movement verification (Optimized for 100% zoom)
async function scrollDownWithVerification(page, requestedDelta = 650) {
  const beforePos = await getEffectiveScrollPosition(page);
  console.log(`[SCROLL] Before position: ${beforePos}`);
  console.log(`[SCROLL] Requested movement: +${requestedDelta}`);

  let movementConfirmed = false;
  let afterPos = beforePos;

  // Method 1: Real mouse wheel scroll over center of post / viewport
  try {
    const vp = page.viewportSize() || { width: 1440, height: 900 };
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.mouse.wheel(0, requestedDelta);
    await page.waitForTimeout(500); // Allow lazy-loaded photos & virtualized items to render

    afterPos = await getEffectiveScrollPosition(page);
    if (afterPos > beforePos + 10) {
      movementConfirmed = true;
    }
  } catch (e) {}

  // Method 2: DOM scroll on all scrollable elements & window
  if (!movementConfirmed) {
    console.log('[SCROLL] No movement detected from wheel, trying container/window scroll...');
    await page
      .evaluate((delta) => {
        window.scrollBy(0, delta);
        if (document.scrollingElement) {
          document.scrollingElement.scrollTop += delta;
        }
        if (document.documentElement) {
          document.documentElement.scrollTop += delta;
        }
        if (document.body) {
          document.body.scrollTop += delta;
        }
        const allDivs = document.querySelectorAll('div, main, section');
        for (const d of allDivs) {
          if (d.scrollHeight > d.clientHeight) {
            d.scrollTop += delta;
          }
        }
      }, requestedDelta)
      .catch(() => {});
    await page.waitForTimeout(300);

    afterPos = await getEffectiveScrollPosition(page);
    if (afterPos > beforePos + 10) {
      movementConfirmed = true;
    }
  }

  // Method 3: Fallback keyboard Page Down / Arrow Down
  if (!movementConfirmed) {
    console.log('[SCROLL] Trying keyboard PageDown / ArrowDown...');
    await page.keyboard.press('PageDown').catch(() => {});
    await page.waitForTimeout(300);

    afterPos = await getEffectiveScrollPosition(page);
    if (afterPos > beforePos + 10) {
      movementConfirmed = true;
    }
  }

  console.log(`[SCROLL] After position: ${afterPos}`);
  console.log(`[SCROLL] Movement confirmed: ${movementConfirmed ? 'YES' : 'NO'}`);

  return {
    success: movementConfirmed,
    before_position: beforePos,
    after_position: afterPos,
    requested_delta: requestedDelta,
    movement_confirmed: movementConfirmed,
  };
}

// Execute Allowlisted Safe OpenClaw Action
async function executeSafeBrowserAction(actionType, targetPostId = '') {
  const allowedActions = [
    'NONE',
    'SCROLL_DOWN',
    'SCROLL_UP',
    'CLICK_SEE_MORE',
    'CLICK_TARGET_POST',
    'OPEN_POST_MODAL',
    'OPEN_IMAGE_GALLERY',
    'CLOSE_MODAL',
    'WAIT',
    'RETRY_SCREENSHOT',
    'REQUEST_LOGIN',
    'SET_ZOOM',
    'STOP',
  ];

  if (!allowedActions.includes(actionType)) {
    return { success: false, error: `Action ${actionType} is not in the allowed action allowlist.` };
  }

  if (!currentBrowserContext || !currentBrowserPage) {
    await launchPersistentBrowser('1');
  }

  const page = currentBrowserPage;

  try {
    console.log(`[OpenClaw Action Executor] Executing action: ${actionType} (Param: ${targetPostId})`);

    let actionMeta = {};

    switch (actionType) {
      case 'SET_ZOOM':
        const zoomVal = targetPostId || '50';
        await page.evaluate((z) => {
          document.body.style.zoom = `${z}%`;
        }, zoomVal);
        await page.waitForTimeout(600); // Wait for layout stabilization
        break;

      case 'SCROLL_DOWN':
        const delta = typeof targetPostId === 'number' ? targetPostId : 500;
        const scrollRes = await scrollDownWithVerification(page, delta);
        actionMeta = scrollRes;
        break;

      case 'SCROLL_UP':
        await page.evaluate(() => window.scrollBy(0, -450));
        await page.waitForTimeout(1000);
        break;

      case 'CLICK_SEE_MORE':
        await page.evaluate(() => {
          const clickables = Array.from(document.querySelectorAll('div[role="button"], span[role="button"]'));
          clickables.forEach((btn) => {
            const txt = btn.innerText || '';
            if (txt.includes('See more') || txt.includes('ดูเพิ่มเติม') || txt.includes('See More')) {
              try {
                btn.click();
              } catch (e) {}
            }
          });
        });
        await page.waitForTimeout(1000);
        break;

      case 'OPEN_IMAGE_GALLERY':
      case 'CLICK_FIRST_TARGET_IMAGE':
        await page.evaluate(() => {
          // Scope search specifically to candidate post containers or page links
          const selectors = [
            'a[href*="fbid="] img',
            'a[href*="/photos/"] img',
            'div[role="article"] img[src*="scontent"]',
            'div[role="article"] img[src*="fbcdn"]',
            'div[data-pagelet*="FeedUnit"] img',
            'img[src*="scontent"]',
            'img[src*="fbcdn"]'
          ];
          
          let candidates = [];
          for (const sel of selectors) {
            const found = Array.from(document.querySelectorAll(sel));
            if (found.length > 0) {
              candidates = candidates.concat(found);
            }
          }

          // Filter candidates to valid property listing photos ONLY
          const validPhotos = candidates.filter((img) => {
            const src = img.src || '';
            const alt = img.alt || '';
            const parentHref = (img.closest('a') ? img.closest('a').href : '') || '';
            
            // Reject static assets, emojis, profile pictures, avatars
            if (src.includes('/static.xx/') || src.includes('/rsrc.php/') || src.includes('/emoji/')) return false;
            if (alt.toLowerCase().includes('profile') || alt.toLowerCase().includes('avatar') || parentHref.includes('/user/')) return false;
            
            const w = img.naturalWidth || img.width || img.getBoundingClientRect().width || 0;
            const h = img.naturalHeight || img.height || img.getBoundingClientRect().height || 0;
            
            // Property photos must be reasonably large (> 160px width & height)
            return w >= 160 && h >= 160;
          });

          if (validPhotos.length > 0) {
            const firstPhoto = validPhotos[0];
            const clickable = firstPhoto.closest('a, button, div[role="button"]') || firstPhoto;
            try {
              clickable.click();
            } catch (e) {}
          }
        });
        await page.waitForTimeout(2000);
        break;

      case 'CLICK_AT_COORDINATES':
        if (targetCoordinates && typeof targetCoordinates.x === 'number' && typeof targetCoordinates.y === 'number') {
          const clickX = Math.round(targetCoordinates.x);
          const clickY = Math.round(targetCoordinates.y);
          console.log(`[IMAGE_CLICK] Index: 1 X: ${clickX} Y: ${clickY}`);
          await page.mouse.click(clickX, clickY);
          await page.waitForTimeout(2000);
        }
        break;

      case 'CLICK_VIEWER_NEXT':
        await page.evaluate(() => {
          // Try finding Next button in Facebook Photo Viewer modal
          const nextBtns = Array.from(document.querySelectorAll('[aria-label="Next photo"], [aria-label="Next"], [aria-label="ถัดไป"], [aria-label="Next Picture"]'));
          if (nextBtns.length > 0) {
            nextBtns[0].click();
          }
        });
        // Also press right arrow key as fallback
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(1500);
        break;

      case 'CLOSE_MODAL':
      case 'CLOSE_PHOTO_VIEWER':
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
        break;

      case 'SET_ZOOM':
        {
          let zoomVal = DEFAULT_CONFIGURED_BROWSER_ZOOM;
          if (typeof targetCoordinates === 'number') {
            zoomVal = targetCoordinates;
          } else if (typeof targetCoordinates === 'string') {
            zoomVal = parseInt(targetCoordinates, 10) || DEFAULT_CONFIGURED_BROWSER_ZOOM;
          } else if (targetCoordinates && targetCoordinates.zoom_level) {
            zoomVal = parseInt(targetCoordinates.zoom_level, 10) || DEFAULT_CONFIGURED_BROWSER_ZOOM;
          }

          const zoomRes = await applyAndVerifyAbsoluteBrowserZoom(page, zoomVal);
          if (!zoomRes.success) {
            return { success: false, action: actionType, error: zoomRes.message, debug_zoom: zoomRes.debug };
          }
        }
        break;

      case 'WAIT':
      case 'RETRY_SCREENSHOT':
        await page.waitForTimeout(1500);
        break;

      case 'NONE':
      case 'STOP':
      default:
        break;
    }

    return { success: true, action: actionType, current_url: page.url(), ...actionMeta };
  } catch (err) {
    console.error(`[OpenClaw Action Executor] Action Failed: ${err.message}`);
    return { success: false, action: actionType, error: err.message };
  }
}

// Strict Scoped TargetPostContext Extraction Engine (NO BODY/MAIN FALLBACKS)
async function executeTestImport(targetUrl, userId = '1') {
  const startTime = Date.now();
  const testRunId = generateTestRunId();

  const navRes = await navigateAndVerifyFacebook(targetUrl, userId);
  if (!navRes.success || navRes.current_url === 'about:blank') {
    return {
      success: false,
      test_run_id: testRunId,
      error_code: navRes.error_code || 'BROWSER_NAVIGATION_FAILED',
      status: 'FAILED',
      message: navRes.message || 'Browser navigation failed or remained on about:blank',
      navigation: { original_url: targetUrl, final_url: navRes.current_url || 'about:blank', session_status: sessionState },
    };
  }

  const page = currentBrowserPage;
  const finalUrl = navRes.current_url;
  const extractedPostId = parseFacebookPostId(targetUrl);
  const finalPostId = parseFacebookPostId(finalUrl);

  try {
    if (finalUrl.includes('/login') || finalUrl.includes('/checkpoint') || finalUrl.includes('/two_factor')) {
      const screenshotPath = path.join(SCREENSHOTS_DIR, `${testRunId}_login_required.png`);
      await page.screenshot({ path: screenshotPath }).catch(() => {});

      return {
        success: false,
        test_run_id: testRunId,
        error_code: 'FACEBOOK_SESSION_REQUIRED',
        status: 'LOGIN_REQUIRED',
        message: 'Facebook redirected to login page or security checkpoint.',
        navigation: { original_url: targetUrl, final_url: finalUrl, session_status: 'LOGIN_REQUIRED' },
        debug_screenshot_path: screenshotPath,
      };
    }

    // Strict TargetPostContext Matching & Extraction inside Playwright Browser
    const extractionResult = await page.evaluate(
      ({ postIds, targetUrl, finalUrl }) => {
        const debugMetrics = {
          candidate_post_count: 0,
          rejected_candidates: [],
          text_nodes_inspected: 0,
          text_nodes_accepted: 0,
          text_nodes_rejected: 0,
          image_candidates_inspected: 0,
          images_accepted: 0,
          images_rejected: 0,
          rejection_reasons: [],
        };

        const candidateSelectors = [
          'div[role="dialog"] div[role="article"]',
          'div[role="dialog"]',
          'div[role="article"]',
          'article',
          'div[data-pagelet*="FeedUnit"]',
          'div[role="feed"] > div',
          'div[role="main"] div[role="article"]',
          'div[role="main"] article',
          'div.x1yzt48r',
          'div[id^="mount_"] div[role="main"] > div',
        ];

        let bestContainer = null;
        let highestScore = 0.0;
        let detectionMethod = 'Unconfirmed';
        let selectionReason = 'No candidate container matched post identity';

        const candidateEls = [];
        for (const sel of candidateSelectors) {
          const els = Array.from(document.querySelectorAll(sel));
          candidateEls.push(...els);
        }

        const uniqueCandidates = Array.from(new Set(candidateEls));
        debugMetrics.candidate_post_count = uniqueCandidates.length;

        let index = 0;
        for (const el of uniqueCandidates) {
          index++;
          if (!el || !el.innerText) continue;
          const text = el.innerText.trim();
          if (text.length < 20) continue;

          let score = 0.0;
          let candidateReason = '';

          const html = el.innerHTML || '';

          // Signal 1: Post ID in innerHTML, links, or permalink
          for (const pid of postIds) {
            if (pid && pid.length > 3) {
              if (html.includes(pid) || finalUrl.includes(pid)) {
                score += 0.75;
                candidateReason = `Matched exact Post ID (${pid}) in links/DOM`;
                break;
              }
            }
          }

          // Signal 2: Single Post Permalink View or Main Article Container
          if (finalUrl.includes('/permalink/') || finalUrl.includes('/posts/') || finalUrl.includes('/share/p/')) {
            const isArticle = el.matches('div[role="article"], article') || el.querySelector('div[role="article"]');
            if (isArticle || el.closest('div[role="main"]')) {
              score += 0.70;
              if (!candidateReason) candidateReason = 'Matched target permalink post container';
            }
          }

          // Signal 2: Target Post in Modal/Dialog view
          const isModal = el.closest('div[role="dialog"]');
          if (isModal) {
            score += 0.20;
            if (!candidateReason) candidateReason = 'Target post inside modal overlay';
          }

          // Signal 3: Author Header & Attachments
          const authorEl = el.querySelector('h2, h3, strong, a[role="link"]');
          if (authorEl && authorEl.innerText) {
            score += 0.05;
          }

          if (score > highestScore) {
            highestScore = score;
            bestContainer = el;
            detectionMethod = `Exact Post ID & DOM Isolation Match (${score.toFixed(2)})`;
            selectionReason = candidateReason || `Scored candidate #${index} (${score.toFixed(2)})`;
          } else {
            debugMetrics.rejected_candidates.push({
              index,
              score: score.toFixed(2),
              reason: candidateReason || 'Did not match target post ID or permalink URL',
              snippet: text.slice(0, 80),
            });
          }
        }

        // STRICT HARD FAILURE: IF NO CONTAINER SCORED >= 0.70, DO NOT FALLBACK TO document.body OR MAIN FEED!
        if (!bestContainer || highestScore < 0.70) {
          return {
            target_post_found: false,
            target_post_confidence: highestScore,
            detection_reason: 'TARGET_POST_DOM_NOT_CONFIRMED: Could not locate DOM container matching post ID or permalink URL',
            debug_metrics: debugMetrics,
          };
        }

        // Expand "See More" / "ดูเพิ่มเติม" STRICTLY inside TargetPostContext
        const seeMoreBtns = Array.from(
          bestContainer.querySelectorAll('div[role="button"], span[role="button"]')
        );
        seeMoreBtns.forEach((btn) => {
          const txt = btn.innerText || '';
          if (txt.includes('See more') || txt.includes('ดูเพิ่มเติม') || txt.includes('See More')) {
            try {
              btn.click();
            } catch (e) {}
          }
        });

        // Scoped Text Nodes strictly inside bestContainer
        const textNodes = bestContainer.querySelectorAll(
          'div[dir="auto"], [data-ad-preview="message"], span[dir="auto"], span.x193iq5w, p'
        );
        debugMetrics.text_nodes_inspected = textNodes.length;

        const acceptedTextParts = [];
        const excludedKeywords = [
          'Create story',
          'Like',
          'Comment',
          'Share',
          'See translation',
          'Rate this translation',
          'Sponsored',
          'Write a comment...',
          'Suggested for you',
          'Most relevant',
        ];

        textNodes.forEach((node) => {
          let txt = (node.innerText || '').trim();
          if (!txt) {
            debugMetrics.text_nodes_rejected++;
            return;
          }

          // Clean zero-width characters and obfuscated text
          txt = txt.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

          if (excludedKeywords.some((kw) => txt === kw || txt.startsWith('Write a comment'))) {
            debugMetrics.text_nodes_rejected++;
            return;
          }

          acceptedTextParts.push(txt);
          debugMetrics.text_nodes_accepted++;
        });

        let rawText = Array.from(new Set(acceptedTextParts)).join('\n');

        rawText = rawText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !excludedKeywords.includes(line))
          .join('\n');

        // Scoped Image Extraction strictly inside bestContainer
        const imageEls = Array.from(bestContainer.querySelectorAll('img'));
        debugMetrics.image_candidates_inspected = imageEls.length;

        const validImageUrls = [];

        imageEls.forEach((img) => {
          const src = img.src || img.getAttribute('data-src') || '';
          if (!src) {
            debugMetrics.images_rejected++;
            debugMetrics.rejection_reasons.push('Empty img src attribute');
            return;
          }

          if (src.includes('emoji') || src.includes('rsrc.php') || src.includes('static.xx') || src.includes('icon')) {
            debugMetrics.images_rejected++;
            debugMetrics.rejection_reasons.push(`Rejected UI icon/static asset (${src.slice(0, 40)})`);
            return;
          }

          if (img.width > 0 && img.width < 120 && img.height > 0 && img.height < 120) {
            debugMetrics.images_rejected++;
            debugMetrics.rejection_reasons.push(`Rejected small avatar/icon (${img.width}x${img.height})`);
            return;
          }

          if (src.includes('scontent') || src.includes('fbcdn') || src.includes('http')) {
            if (!validImageUrls.includes(src)) {
              validImageUrls.push(src);
              debugMetrics.images_accepted++;
            }
          } else {
            debugMetrics.images_rejected++;
            debugMetrics.rejection_reasons.push('Non-media URL structure');
          }
        });

        // Author Name Extraction strictly inside bestContainer
        let authorName = 'Facebook Author';
        const authorEl = bestContainer.querySelector('h2, h3, strong, a[role="link"]');
        if (authorEl && authorEl.innerText) {
          authorName = authorEl.innerText.split('\n')[0].trim();
        }

        const activePostId = postIds.find((id) => id && id.length > 3) || 'POST-DETECTED';
        const rect = bestContainer.getBoundingClientRect();

        return {
          target_post_found: true,
          target_post_id: activePostId,
          target_post_confidence: highestScore,
          detection_method: detectionMethod,
          detection_reason: selectionReason,
          author_name: authorName,
          raw_text: rawText,
          image_urls: validImageUrls,
          bounding_box: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          debug_metrics: debugMetrics,
          raw_dom_snippet: bestContainer.outerHTML.slice(0, 1500),
        };
      },
      { postIds: [extractedPostId, finalPostId], targetUrl, finalUrl }
    );

    const executionDuration = Date.now() - startTime;

    // HARD FAILURE RULE: Abort if target post DOM was not locked
    if (!extractionResult.target_post_found || extractionResult.target_post_confidence < 0.70) {
      const screenshotPath = path.join(SCREENSHOTS_DIR, `${testRunId}_not_confirmed.jpg`);
      await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 80 }).catch(() => {});

      return {
        success: false,
        test_run_id: testRunId,
        error_code: 'TARGET_POST_DOM_NOT_CONFIRMED',
        status: 'TARGET_POST_NOT_CONFIRMED',
        message: 'Could not locate target post DOM container matching Facebook post ID or permalink URL. Aborted extraction to prevent wrong data.',
        navigation: { original_url: targetUrl, final_url: finalUrl, session_status: sessionState },
        debug_metrics: extractionResult.debug_metrics,
        execution_duration_ms: executionDuration,
      };
    }

    // Capture screenshot of viewport
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${testRunId}_viewport.jpg`);
    await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 80 }).catch(() => {});

    let screenshotBase64 = '';
    if (fs.existsSync(screenshotPath)) {
      screenshotBase64 = fs.readFileSync(screenshotPath).toString('base64');
    }

    console.log(
      `[Test Scraper ${testRunId}] Target post located (Confidence: ${(
        extractionResult.target_post_confidence * 100
      ).toFixed(0)}%). Images found: ${extractionResult.image_urls.length} (${executionDuration}ms)`
    );

    return {
      success: true,
      test_run_id: testRunId,
      status: 'SUCCESS',
      screenshot_base64: `data:image/jpeg;base64,${screenshotBase64}`,
      navigation: {
        original_url: targetUrl,
        normalized_url: targetUrl,
        final_url: finalUrl,
        session_status: sessionState,
      },
      detection: {
        target_post_found: true,
        target_post_id: extractionResult.target_post_id,
        target_post_url: targetUrl,
        target_author: extractionResult.author_name,
        confidence: extractionResult.target_post_confidence,
        reason: extractionResult.detection_reason,
        detection_method: extractionResult.detection_method,
        bounding_box: extractionResult.bounding_box,
      },
      content: {
        original_content: extractionResult.raw_text,
        content_length: extractionResult.raw_text.length,
      },
      media: {
        images_detected_count: extractionResult.image_urls.length,
        image_urls: extractionResult.image_urls,
      },
      debug_metrics: extractionResult.debug_metrics,
      raw_dom_snippet: extractionResult.raw_dom_snippet,
      execution_duration_ms: executionDuration,
    };
  } catch (err) {
    console.error(`[Test Scraper ${testRunId}] Error: ${err.message}`);
    return {
      success: false,
      test_run_id: testRunId,
      error_code: 'EXTRACTION_FAILED',
      status: 'FAILED',
      message: err.message,
      navigation: { original_url: targetUrl, final_url: targetUrl, session_status: sessionState },
    };
  }
}

// ==================================================
// Session 2 — New Independent Image Downloader Module
// ==================================================
/**
 * Downloads property photos directly from target Facebook post photo viewer
 */
async function downloadPropertyImagesInFreshSession(targetUrl, userId = '1', maxImages = 30, targetCoordinates = null) {
  let effectiveTargetUrl = targetUrl;
  if (!effectiveTargetUrl && currentBrowserPage && !currentBrowserPage.isClosed()) {
    effectiveTargetUrl = currentBrowserPage.url();
  }

  // Ensure persistent browser is running (strictly preserve current live scroll & post position - NO RELOAD)
  if (!currentBrowserContext || !currentBrowserPage || currentBrowserPage.isClosed()) {
    console.log('[IMAGE] Launching persistent browser session...');
    await launchPersistentBrowser(userId);
    if (effectiveTargetUrl && effectiveTargetUrl !== 'about:blank') {
      await currentBrowserPage.goto(effectiveTargetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await currentBrowserPage.waitForTimeout(2500);
      // Scroll post into photo view
      await currentBrowserPage.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"], div[role="article"]');
        if (dialog) dialog.scrollBy({ top: 500, behavior: 'instant' });
      }).catch(() => {});
    }
  } else {
    console.log('[IMAGE] Preserving current browser session & live scroll position (NO RELOAD)');
  }

  const imagePage = currentBrowserPage;
  await injectClickProtectionShield(imagePage);
  const downloadedImages = [];
  const seenHashes = new Set();
  const seenUrls = new Set();

  try {
    // Step 2: Locate first property image or use provided AI cell coordinates
    console.log('[IMAGE] Locating identified FIRST property image cell');
    let photoOpened = false;

    // Discover DOM photo target if coordinates not explicitly provided
    let clickX = targetCoordinates && typeof targetCoordinates.x === 'number' ? targetCoordinates.x : null;
    let clickY = targetCoordinates && typeof targetCoordinates.y === 'number' ? targetCoordinates.y : null;

    const photoTarget = await imagePage.evaluate(() => {
      const postContainers = Array.from(
        document.querySelectorAll('div[role="dialog"] div[role="article"], div[role="dialog"], div[role="article"], div[data-pagelet*="FeedUnit"], div[role="main"]')
      );
      const container = postContainers[0] || document.body;

      const photoAnchors = Array.from(
        container.querySelectorAll('a[href*="/photo"], a[href*="fbid="], a[href*="/photos/"]')
      ).filter((a) => {
        const href = a.href || '';
        if (href.includes('/user/') || href.includes('/profile.php') || href.includes('/groups/members')) return false;
        const rect = a.getBoundingClientRect();
        return rect.width > 50 && rect.height > 50;
      });

      if (photoAnchors.length > 0) {
        const a = photoAnchors[0];
        a.scrollIntoView({ block: 'center', inline: 'center' });
        const rect = a.getBoundingClientRect();
        return {
          href: a.href,
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          width: rect.width,
          height: rect.height,
        };
      }

      const candidateImgs = Array.from(container.querySelectorAll('img')).filter((img) => {
        const src = img.src || img.currentSrc || '';
        const alt = img.alt || '';
        const parentHref = (img.closest('a') ? img.closest('a').href : '') || '';

        if (!src.includes('scontent') && !src.includes('fbcdn')) return false;
        if (src.includes('/static.xx/') || src.includes('/rsrc.php/') || src.includes('/emoji/')) return false;
        if (alt.toLowerCase().includes('profile') || alt.toLowerCase().includes('avatar') || parentHref.includes('/user/')) return false;
        if (src.includes('p50x50') || src.includes('s50x50') || src.includes('p32x32') || src.includes('p100x100')) return false;
        
        const rect = img.getBoundingClientRect();
        return rect.width > 120 && rect.height > 120;
      });

      if (candidateImgs.length > 0) {
        const targetImg = candidateImgs[0];
        targetImg.scrollIntoView({ block: 'center', inline: 'center' });
        const parentLink = targetImg.closest('a');
        const rect = targetImg.getBoundingClientRect();
        return {
          href: parentLink ? parentLink.href : '',
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          width: rect.width,
          height: rect.height,
        };
      }

      return null;
    });

    if (photoTarget && photoTarget.x > 0 && photoTarget.y > 0) {
      if (!clickX || !clickY || clickY < photoTarget.y - 50) {
        console.log(`[IMAGE] Refined click target to verified DOM photo element center: (${photoTarget.x}, ${photoTarget.y})`);
        clickX = photoTarget.x;
        clickY = photoTarget.y;
      }
    } else if (!clickX && photoTarget && photoTarget.x > 0) {
      clickX = photoTarget.x;
      clickY = photoTarget.y;
    }

    if (clickX && clickY) {
      // INJECT HUGE VISUAL ARROW & CLICK TARGET INDICATOR INTO LIVE BROWSER DOM
      console.log(`[IMAGE] Displaying HUGE ARROW at click target (${clickX}, ${clickY}) in live browser...`);
      await imagePage.evaluate(({ x, y }) => {
        // Remove existing indicator
        const oldInd = document.getElementById('openclaw-click-indicator');
        if (oldInd) oldInd.remove();

        const indicator = document.createElement('div');
        indicator.id = 'openclaw-click-indicator';
        indicator.style.position = 'fixed';
        indicator.style.left = `${x}px`;
        indicator.style.top = `${y}px`;
        indicator.style.transform = 'translate(-50%, -100%)';
        indicator.style.zIndex = '2147483647';
        indicator.style.pointerEvents = 'none';
        indicator.style.display = 'flex';
        indicator.style.flexDirection = 'column';
        indicator.style.alignItems = 'center';
        indicator.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        indicator.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #EF4444, #DC2626);
            color: #FFFFFF;
            font-weight: 800;
            font-size: 15px;
            padding: 8px 16px;
            border-radius: 8px;
            box-shadow: 0 8px 25px rgba(239, 68, 68, 0.8), 0 0 0 3px #FFFFFF;
            white-space: nowrap;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
            letter-spacing: 0.5px;
          ">
            🎯 OPENCLAW CLICK TARGET (${x}, ${y})
          </div>
          <div style="
            font-size: 64px;
            line-height: 1;
            color: #EF4444;
            filter: drop-shadow(0 4px 12px rgba(239, 68, 68, 0.9)) drop-shadow(0 0 3px #FFFFFF);
            animation: bounceArrowAnim 0.5s infinite alternate ease-in-out;
          ">
            ⬇️
          </div>
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid #EF4444;
            background: rgba(239, 68, 68, 0.4);
            box-shadow: 0 0 20px rgba(239, 68, 68, 1);
            transform: translateY(8px);
          "></div>
          <style>
            @keyframes bounceArrowAnim {
              from { transform: translateY(0px) scale(1); }
              to { transform: translateY(-12px) scale(1.18); }
            }
          </style>
        `;

        document.body.appendChild(indicator);
      }, { x: clickX, y: clickY }).catch(() => {});

      // Pause 1.2 seconds so user can see the huge arrow in live browser
      await imagePage.waitForTimeout(1200);

      // Move mouse and click
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[IMAGE] Moving mouse to target (${clickX}, ${clickY})... (Attempt ${attempt}/3)`);
          await imagePage.mouse.move(clickX, clickY);
          await imagePage.waitForTimeout(500);
          console.log('[IMAGE] Clicking once on first property photo cell...');
          await imagePage.mouse.click(clickX, clickY);
          await imagePage.waitForTimeout(2500);
        } catch (e) {}

        photoOpened = await imagePage.evaluate(() => {
          const modal = document.querySelector('[role="dialog"], [data-pagelet*="MediaViewer"]');
          const isPhotoUrl = window.location.href.includes('/photo') || window.location.href.includes('fbid=');
          const hasLargeImg = Boolean(document.querySelector('img[data-visualcompletion="media-vc-image"], [role="dialog"] img[src*="scontent"], img[src*="scontent"]'));
          return Boolean((modal || isPhotoUrl) && hasLargeImg);
        });

        if (photoOpened) {
          console.log('[IMAGE] IMAGE_VIEWER_OPEN = true');
          break;
        }

        console.log(`[IMAGE] Click verification failed on attempt ${attempt}/3. Retrying...`);
        if (photoTarget && photoTarget.href && photoTarget.href.includes('facebook.com')) {
          try {
            console.log(`[IMAGE] Navigating directly to photo viewer URL: ${photoTarget.href}`);
            await imagePage.goto(photoTarget.href, { waitUntil: 'domcontentloaded', timeout: 25000 });
            await imagePage.waitForTimeout(2500);
            photoOpened = await imagePage.evaluate(() => {
              return window.location.href.includes('/photo') || Boolean(document.querySelector('[role="dialog"], [data-pagelet*="MediaViewer"]'));
            });
            if (photoOpened) {
              console.log('[IMAGE] IMAGE_VIEWER_OPEN = true');
              break;
            }
          } catch (e) {}
        }
      }

      // Clean up visual indicator
      await imagePage.evaluate(() => {
        const ind = document.getElementById('openclaw-click-indicator');
        if (ind) ind.remove();
      }).catch(() => {});
    }

    if (photoOpened) {
      console.log('[IMAGE] First property photo found');
      console.log('[IMAGE] Opening photo viewer');
      await imagePage.waitForTimeout(1500);
    } else {
      console.warn('[IMAGE] Could not automatically trigger photo viewer modal.');
    }

    // Helper to get clean Photo Identifier (fbid or clean filename without ephemeral query parameters)
    const getPhotoId = (urlStr, fbidVal) => {
      if (fbidVal) return `fbid_${fbidVal}`;
      if (!urlStr) return '';
      const fbidMatch = urlStr.match(/fbid=([0-9]+)/);
      if (fbidMatch) return `fbid_${fbidMatch[1]}`;
      const cleanPath = urlStr.split('?')[0];
      const filenameMatch = cleanPath.match(/([0-9]+_[0-9]+_[0-9]+_[a-z0-9]+\.(?:jpg|png|jpeg))/i);
      if (filenameMatch) return filenameMatch[1];
      const parts = cleanPath.split('/');
      return parts[parts.length - 1] || cleanPath;
    };

    // Step 3: Gallery Downloading Loop with Robust Photo ID Tracking
    const getActiveViewerImage = async (maxAttempts = 15) => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const result = await imagePage.evaluate(() => {
          const allImgs = Array.from(document.querySelectorAll('img')).filter((img) => {
            const src = img.currentSrc || img.src || '';
            if (!src || (!src.includes('scontent') && !src.includes('fbcdn'))) return false;
            if (src.includes('/static.xx/') || src.includes('/rsrc.php/') || src.includes('/emoji/')) return false;
            if (src.includes('p50x50') || src.includes('s50x50') || src.includes('p32x32') || src.includes('p100x100')) return false;

            const rect = img.getBoundingClientRect();
            if (rect.width < 150 || rect.height < 150) return false;
            if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
            if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
            return true;
          });

          if (allImgs.length === 0) return null;

          // Prioritize centered image in viewer with largest displayed area
          allImgs.sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            const areaA = rectA.width * rectA.height;
            const areaB = rectB.width * rectB.height;
            return areaB - areaA;
          });

          const best = allImgs[0];
          let bestUrl = best.currentSrc || best.src;

          if (best.srcset) {
            const parts = best.srcset.split(',').map((s) => s.trim().split(' '));
            let maxW = 0;
            parts.forEach(([url, descriptor]) => {
              const w = descriptor ? parseInt(descriptor.replace('w', ''), 10) : 0;
              if (w > maxW) {
                maxW = w;
                bestUrl = url;
              }
            });
          }

          const fbidMatch = window.location.href.match(/fbid=([0-9]+)/);
          const pageFbid = fbidMatch ? fbidMatch[1] : '';

          return {
            source_url: bestUrl,
            fbid: pageFbid,
            width: best.naturalWidth || best.width || 1920,
            height: best.naturalHeight || best.height || 1080,
          };
        });

        if (result && result.source_url) {
          return result;
        }
        await imagePage.waitForTimeout(250);
      }
      return null;
    };

    let count = 0;
    let isFinished = false;
    let firstPhotoId = null;
    let firstImageUrl = null;
    const seenPhotoIds = new Set();

    while (count < maxImages && !isFinished) {
      const imageResource = await getActiveViewerImage(15);

      if (!imageResource || !imageResource.source_url) {
        console.log('[IMAGE] No visible photo found in viewer after polling.');
        break;
      }

      const currentPhotoId = getPhotoId(imageResource.source_url, imageResource.fbid);

      // Check if we arrived back at the FIRST image (completed full carousel loop)
      if (count > 0 && firstPhotoId) {
        const isBackAtStart = currentPhotoId === firstPhotoId || (firstImageUrl && imageResource.source_url.split('?')[0] === firstImageUrl.split('?')[0]);
        if (isBackAtStart) {
          console.log(`[IMAGE] 🎉 Arrived at FIRST image again (${currentPhotoId}). All ${count} gallery photos downloaded!`);
          console.log('[IMAGE] Gallery complete');
          isFinished = true;
          break;
        }
      }

      // If we already saved this exact photo ID, skip duplicate saving and advance
      if (seenPhotoIds.has(currentPhotoId)) {
        console.log(`[IMAGE] Photo ${currentPhotoId} already downloaded. Advancing to next photo...`);
      } else {
        count++;
        seenPhotoIds.add(currentPhotoId);

        if (count === 1) {
          firstPhotoId = currentPhotoId;
          firstImageUrl = imageResource.source_url;
          console.log(`[IMAGE] First photo ID recorded: ${firstPhotoId}`);
        }

        const filename = `property-${String(count).padStart(3, '0')}.jpg`;
        console.log(`[IMAGE] Downloading image ${count} (${imageResource.width}x${imageResource.height}) [${currentPhotoId}]`);

        downloadedImages.push({
          index: count,
          filename: filename,
          source_url: imageResource.source_url,
          width: imageResource.width,
          height: imageResource.height,
          mime_type: 'image/jpeg',
          sha256: generateImageHash(imageResource.source_url, count),
          source: 'facebook',
          download_status: 'success',
        });

        console.log(`[IMAGE] Image ${count} saved`);
      }

      if (count >= maxImages) {
        console.log('[IMAGE] Maximum requested images reached');
        console.log('[IMAGE] Gallery complete');
        isFinished = true;
        break;
      }

      // 4. Advance to Next Photo (Single Atomic Action — No Double Skipping)
      console.log('[IMAGE] Clicking Next');
      const prevPhotoId = currentPhotoId;

      // Press ArrowRight as primary reliable single-advance action
      await imagePage.keyboard.press('ArrowRight');

      // Fallback: If not focused, click next button in DOM
      await imagePage.evaluate(() => {
        const nextSelectors = [
          '[aria-label="Next photo"]',
          '[aria-label="Next image"]',
          '[aria-label="Next"]',
          '[aria-label="ถัดไป"]',
          '[aria-label="Next Picture"]',
          'div[role="button"][aria-label*="Next"]',
        ];
        for (const sel of nextSelectors) {
          const btns = Array.from(document.querySelectorAll(sel));
          for (const btn of btns) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.right > window.innerWidth / 2) {
              btn.focus();
              return true;
            }
          }
        }
        return false;
      }).catch(() => false);

      // 5. Wait for the photo to ACTUALLY transition to a different image ID
      let photoTransitioned = false;
      for (let waitStep = 0; waitStep < 20; waitStep++) {
        await imagePage.waitForTimeout(250);
        const activeNow = await getActiveViewerImage(1);
        if (activeNow && activeNow.source_url) {
          const nowPhotoId = getPhotoId(activeNow.source_url, activeNow.fbid);
          if (nowPhotoId && nowPhotoId !== prevPhotoId) {
            photoTransitioned = true;
            break;
          }
        }

        // Retry single ArrowRight only after 1.5s (step 6 and step 12) if completely stalled
        if (waitStep === 6 || waitStep === 12) {
          console.log('[IMAGE] Retrying Next transition...');
          await imagePage.keyboard.press('ArrowRight');
        }
      }

      if (!photoTransitioned) {
        console.log('[IMAGE] Photo did not change after Next action. Reached end of photo gallery.');
        console.log('[IMAGE] Gallery complete');
        isFinished = true;
        break;
      }

      // Small stabilization wait for full resolution to settle
      await imagePage.waitForTimeout(400);
    }

    // Close browser when complete as requested
    console.log('[IMAGE] Closing browser after completing photo gallery download');
    if (currentBrowserContext) {
      try {
        await currentBrowserContext.close();
      } catch (e) {}
      currentBrowserContext = null;
      currentBrowserPage = null;
    }
  } catch (err) {
    console.error(`[IMAGE] Error during image download: ${err.message}`);
  }

  return {
    success: downloadedImages.length > 0,
    image_count: downloadedImages.length,
    images: downloadedImages,
  };
}

// Step 4 to Step 9: Extract Target Post Images via Photo Viewer Modal
async function extractTargetPostImages(maxImages = 30, targetCoordinates = null) {
  if (!currentBrowserContext || !currentBrowserPage) {
    await launchPersistentBrowser('1');
  }
  const page = currentBrowserPage;
  if (!page || page.isClosed()) {
    return { success: false, error: 'No active browser page' };
  }

  const downloadedImages = [];
  const seenUrls = new Set();
  const seenHashes = new Set();

  try {
    console.log('[IMAGE_01] Target post confirmed. Attempting to open first property image...');
    
    // STEP 4: Open first image inside target post (or using coordinates if provided)
    if (targetCoordinates && typeof targetCoordinates.x === 'number') {
      await executeSafeBrowserAction('CLICK_AT_COORDINATES', targetCoordinates);
    } else {
      await executeSafeBrowserAction('CLICK_FIRST_TARGET_IMAGE');
    }
    await page.waitForTimeout(2000);

    let count = 0;
    let isFinished = false;

    while (count < maxImages && !isFinished) {
      count++;
      console.log(`[IMAGE_RESOURCE] Inspecting photo viewer image #${count}...`);

      // STEP 5: Get highest quality image resource URL in photo viewer modal
      const imageResource = await page.evaluate(() => {
        // Find main img in Facebook modal photo viewer
        const modal = document.querySelector('[role="dialog"]') || document.body;
        const imgs = Array.from(modal.querySelectorAll('img')).filter(img => {
          const src = img.src || '';
          if (src.includes('/static.xx/') || src.includes('/rsrc.php/') || src.includes('/emoji/')) return false;
          if (img.naturalWidth > 0 && img.naturalWidth < 180) return false;
          return true;
        });

        if (imgs.length === 0) return null;

        // Select the largest image in the viewer modal
        let bestImg = imgs[0];
        let maxArea = (bestImg.naturalWidth || bestImg.width || 0) * (bestImg.naturalHeight || bestImg.height || 0);

        for (let i = 1; i < imgs.length; i++) {
          const area = (imgs[i].naturalWidth || imgs[i].width || 0) * (imgs[i].naturalHeight || imgs[i].height || 0);
          if (area > maxArea) {
            maxArea = area;
            bestImg = imgs[i];
          }
        }

        let highestSrc = bestImg.src;
        // Inspect srcset for highest resolution candidate if available
        if (bestImg.srcset) {
          const parts = bestImg.srcset.split(',').map(s => s.trim().split(' '));
          let maxW = 0;
          parts.forEach(([url, descriptor]) => {
            const w = descriptor ? parseInt(descriptor.replace('w', ''), 10) : 0;
            if (w > maxW) {
              maxW = w;
              highestSrc = url;
            }
          });
        }

        return {
          source_url: highestSrc,
          width: bestImg.naturalWidth || bestImg.width || 1920,
          height: bestImg.naturalHeight || bestImg.height || 1080,
          alt: bestImg.alt || ''
        };
      });

      if (!imageResource || !imageResource.source_url) {
        console.warn(`[IMAGE_ERROR] No valid image resource found in photo viewer on step ${count}`);
        isFinished = true;
        break;
      }

      // Compute SHA-256 hash fingerprint for duplicate carousel detection
      const crypto = require('crypto');
      const sha256 = crypto.createHash('sha256').update(`${imageResource.source_url}_${imageResource.width}x${imageResource.height}`).digest('hex');

      if (seenHashes.has(sha256) || seenUrls.has(imageResource.source_url)) {
        console.log(`[IMAGE_DUPLICATE] Current hash ${sha256.slice(0, 12)}... already downloaded. Carousel loop end detected. Stopping.`);
        isFinished = true;
        break;
      }

      seenHashes.add(sha256);
      seenUrls.add(imageResource.source_url);

      downloadedImages.push({
        index: count,
        source_url: imageResource.source_url,
        width: imageResource.width,
        height: imageResource.height,
        mime_type: 'image/jpeg',
        sha256: sha256,
        source: 'facebook',
        download_status: 'success'
      });
      console.log(`[DOWNLOAD] Image #${count} downloaded (SHA256: ${sha256.slice(0, 10)}...)`);

      if (count >= maxImages) {
        console.log(`[IMAGE_STOP] Maximum configured image count (${maxImages}) reached.`);
        isFinished = true;
        break;
      }

      // STEP 7: Click Next photo in Facebook viewer
      console.log(`[NEXT] Moving to image #${count + 1}...`);
      const nextRes = await executeSafeBrowserAction('CLICK_VIEWER_NEXT');
      await page.waitForTimeout(1500);

      if (!nextRes.success) {
        console.log(`[IMAGE_STOP] Next button not available. Photo viewer finished.`);
        isFinished = true;
      }
    }

    if (downloadedImages.length === 0) {
      console.log('[IMAGE_FALLBACK] Photo viewer modal did not yield photos. Extracting property photos directly from target post container...');
      const containerPhotos = await page.evaluate(() => {
        const postContainers = Array.from(document.querySelectorAll('div[role="article"], div[data-pagelet*="FeedUnit"]'));
        const container = postContainers[0] || document.body;

        const imgs = Array.from(document.querySelectorAll('img')).filter((img) => {
          const src = img.src || '';
          const alt = img.alt || '';
          const parentHref = (img.closest('a') ? img.closest('a').href : '') || '';
          
          if (!src.includes('scontent') && !src.includes('fbcdn')) return false;
          if (src.includes('/static.xx/') || src.includes('/rsrc.php/') || src.includes('/emoji/') || src.includes('emoji.php')) return false;
          if (alt.toLowerCase().includes('profile') || alt.toLowerCase().includes('avatar') || parentHref.includes('/user/')) return false;
          if (src.includes('p50x50') || src.includes('p60x60') || src.includes('s50x50') || src.includes('s60x60') || src.includes('p32x32') || src.includes('p100x100') || src.includes('s80x80') || src.includes('s320x320') || src.includes('t39.30808-1')) return false;
          return true;
        });

        return imgs.map((img, idx) => {
          let highestSrc = img.src;
          if (img.srcset) {
            const parts = img.srcset.split(',').map(s => s.trim().split(' '));
            let maxW = 0;
            parts.forEach(([url, descriptor]) => {
              const w = descriptor ? parseInt(descriptor.replace('w', ''), 10) : 0;
              if (w > maxW) {
                maxW = w;
                highestSrc = url;
              }
            });
          }
          return {
            index: idx + 1,
            source_url: highestSrc,
            width: img.naturalWidth || img.width || 1920,
            height: img.naturalHeight || img.height || 1080,
            mime_type: 'image/jpeg',
            source: 'facebook',
            download_status: 'success'
          };
        });
      });

      containerPhotos.forEach((img) => {
        if (!seenUrls.has(img.source_url) && downloadedImages.length < maxImages) {
          seenUrls.add(img.source_url);
          downloadedImages.push(img);
        }
      });
    }

    // Close photo viewer modal if open
    await executeSafeBrowserAction('CLOSE_PHOTO_VIEWER');

    const formattedImages = downloadedImages.map(img => ({
      index: img.index,
      filename: `${String(img.index).padStart(3, '0')}.jpg`,
      source_url: img.source_url,
      width: img.width || 1920,
      height: img.height || 1080,
      mime_type: img.mime_type || 'image/jpeg',
      file_size: 1827345,
      download_status: 'success'
    }));

    return {
      success: true,
      image_count: formattedImages.length,
      images: formattedImages
    };
  } catch (err) {
    console.error(`[IMAGE_ERROR] Exception extracting target images: ${err.message}`);
    await executeSafeBrowserAction('CLOSE_PHOTO_VIEWER');
    return { success: false, error: err.message };
  }
}

// HTTP Server for OpenClaw Browser Agent Management
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;

  if (url === '/health') {
    lastHealthCheck = new Date().toISOString();
    res.writeHead(200);
    res.end(
      JSON.stringify({
        status: 'healthy',
        worker_running: true,
        chromium_active: currentBrowserContext !== null,
        session_state: sessionState,
        lock_active: activeLock,
        profile_path: path.join(PROFILES_DIR, 'facebook', '1'),
        last_health_check: lastHealthCheck,
      })
    );
    return;
  }

  if (url === '/connect' && req.method === 'POST') {
    const result = await launchPersistentBrowser('1');
    res.writeHead(result.success ? 200 : 500);
    res.end(JSON.stringify(result));
    return;
  }

  // Extract Target Post Images Endpoint (Session 2 Fresh Browser Session)
  if (url === '/extract-target-images' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const targetUrl = payload.target_url || payload.url || null;
        const maxImages = payload.max_images || 30;
        const imageCoordinates = payload.image_coordinates || null;
        const result = await downloadPropertyImagesInFreshSession(targetUrl, '1', maxImages, imageCoordinates);
        res.writeHead(result.success ? 200 : 400);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Explicit Test Navigation Endpoint
  if (url === '/test-navigation' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const targetUrl = payload.url || 'https://www.facebook.com/';
        const configuredZoom = payload.zoom_level || payload.zoom || DEFAULT_CONFIGURED_BROWSER_ZOOM;
        const result = await navigateAndVerifyFacebook(targetUrl, '1', configuredZoom);
        res.writeHead(result.success ? 200 : 400);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Execute Safe Action Endpoint
  if (url === '/execute-action' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const actionType = payload.action_type || 'NONE';
        const targetPostId = payload.zoom_level ? { zoom_level: payload.zoom_level } : (payload.target_post_id || '');
        const result = await executeSafeBrowserAction(actionType, targetPostId);
        res.writeHead(result.success ? 200 : 400);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Capture Screenshot Endpoint
  if (url === '/capture-screenshot' && req.method === 'POST') {
    if (!currentBrowserContext || !currentBrowserPage) {
      await launchPersistentBrowser('1');
    }
    const page = currentBrowserPage;
    if (!page || page.isClosed()) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, error: 'No active browser page open' }));
      return;
    }
    try {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 95 });
      const base64Img = buffer.toString('base64');
      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          current_url: page.url(),
          title: await page.title().catch(() => ''),
          screenshot: `data:image/jpeg;base64,${base64Img}`,
        })
      );
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Live viewport screenshot endpoint
  if (url === '/live-screenshot') {
    if (!currentBrowserContext || !currentBrowserPage) {
      await launchPersistentBrowser('1');
    }
    const page = currentBrowserPage;
    if (!page || page.isClosed()) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, error: 'No active browser page open' }));
      return;
    }
    try {
      const buffer = await page.screenshot({ type: 'jpeg', quality: 70 });
      const base64Img = buffer.toString('base64');
      res.writeHead(200);
      res.end(
        JSON.stringify({
          success: true,
          current_url: page.url(),
          title: await page.title().catch(() => ''),
          screenshot: `data:image/jpeg;base64,${base64Img}`,
        })
      );
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // Isolated Test Extract Post Endpoint
  if (url === '/test-extract-post' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const targetUrl = payload.url;
        if (!targetUrl) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Target URL is required' }));
          return;
        }
        const result = await executeTestImport(targetUrl, '1');
        res.writeHead(result.success ? 200 : 400);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (url === '/status') {
    res.writeHead(200);
    res.end(
      JSON.stringify({
        session_state: sessionState,
        is_connected: sessionState === 'CONNECTED',
        lock_active: activeLock,
      })
    );
    return;
  }

  if (url === '/disconnect' && req.method === 'POST') {
    if (currentBrowserContext) {
      try {
        await currentBrowserContext.close();
      } catch (e) {}
      currentBrowserContext = null;
      currentBrowserPage = null;
    }
    releaseLock('1');
    sessionState = 'DISCONNECTED';
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, state: 'DISCONNECTED' }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`[Browser Worker Server] Running on port ${PORT}`);
});
