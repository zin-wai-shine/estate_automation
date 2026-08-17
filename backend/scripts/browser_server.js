const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 9223;
const PROFILES_DIR = process.env.BROWSER_PROFILES_DIR || '/data/browser-profiles';
const SCREENSHOTS_DIR = path.join(PROFILES_DIR, '..', 'screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

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
  const lockFiles = [
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'lockfile',
    'Web Data-journal',
    'Preferences.bad',
    'Local State.bad',
    'LOG.old',
  ];
  lockFiles.forEach((file) => {
    const lockPath = path.join(profilePath, file);
    try {
      if (fs.existsSync(lockPath) || fs.lstatSync(lockPath).isSymbolicLink()) {
        fs.unlinkSync(lockPath);
        console.log(`[OPENCLAW] Cleaned stale Chromium profile lock: ${file}`);
      }
    } catch (e) {}
  });

  const defaultDir = path.join(profilePath, 'Default');
  if (fs.existsSync(defaultDir)) {
    const journalFiles = [
      'Web Data-journal',
      'Web Data-wal',
      'Web Data-shm',
      'Favicons-journal',
      'Favicons-wal',
      'History-journal',
      'History-wal',
      'Shortcuts-journal',
      'Shortcuts-wal',
      'Top Sites-journal',
      'Cookies-journal',
      'LOCK',
    ];
    journalFiles.forEach((file) => {
      const p = path.join(defaultDir, file);
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          console.log(`[OPENCLAW] Cleaned SQLite journal lock: ${file}`);
        }
      } catch (e) {}
    });
  }
}

function repairChromePreferences(profilePath) {
  cleanStaleProfileLocks(profilePath);

  const defaultDir = path.join(profilePath, 'Default');
  fs.mkdirSync(defaultDir, { recursive: true });
  const prefPath = path.join(defaultDir, 'Preferences');

  if (fs.existsSync(prefPath)) {
    try {
      const content = fs.readFileSync(prefPath, 'utf8');
      const prefs = JSON.parse(content);

      prefs.profile = prefs.profile || {};
      prefs.profile.exit_type = 'Normal';
      prefs.profile.exited_cleanly = true;
      prefs.session = prefs.session || {};
      prefs.session.exited_cleanly = true;

      fs.writeFileSync(prefPath, JSON.stringify(prefs, null, 2));
      console.log('[OPENCLAW] Repaired Chromium Preferences to exit_type = Normal');
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

  console.log('[OPENCLAW] Starting browser...');
  console.log(`[OPENCLAW] Persistent profile path: ${profilePath}`);

  try {
    const isMac = process.platform === 'darwin';
    const launchArgs = [
      '--window-size=1280,800',
      '--disable-profile-error-dialogs',
      '--no-first-run',
      '--no-default-browser-check',
      '--password-store=basic',
      '--use-mock-keychain',
      '--disable-infobars',
      '--disable-component-update',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-features=Translate,OptimizationHints,MediaRouter,DestroyProfileOnBrowserClose,LensOverlay,HttpsUpgrades',
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
        viewport: { width: 1280, height: 800 },
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
          viewport: { width: 1280, height: 800 },
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

    return { success: true, state: sessionState, page: currentBrowserPage };
  } catch (err) {
    sessionState = 'ERROR';
    console.error(`[OPENCLAW] Error launching browser: ${err.message}`);
    releaseLock(userId);
    return { success: false, error: err.message };
  }
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

// Perform Explicit Verified Navigation against the Controlled Page
async function navigateAndVerifyFacebook(targetUrl, userId = '1') {
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

    await page.waitForTimeout(3000);
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

    let facebookStatus = 'AUTHENTICATED';
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl.includes('/two_factor')) {
      facebookStatus = 'LOGIN_REQUIRED';
    } else if (!isFacebook) {
      facebookStatus = 'UNKNOWN';
    }

    const testRunId = generateTestRunId();
    const screenshotPath = path.join(SCREENSHOTS_DIR, `${testRunId}_navigation.jpg`);
    const buffer = await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 80 }).catch(() => null);
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

    switch (actionType) {
      case 'SET_ZOOM':
        const zoomVal = targetPostId || '50';
        await page.evaluate((z) => {
          document.body.style.zoom = `${z}%`;
        }, zoomVal);
        await page.waitForTimeout(600); // Wait for layout stabilization
        break;

      case 'SCROLL_DOWN':
        await page.evaluate(() => window.scrollBy(0, 450));
        await page.waitForTimeout(1000);
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
        await page.evaluate(() => {
          const img = document.querySelector('div[role="article"] img, div[data-pagelet*="FeedUnit"] img');
          if (img) {
            try {
              img.click();
            } catch (e) {}
          }
        });
        await page.waitForTimeout(1500);
        break;

      case 'CLOSE_MODAL':
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
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

    return { success: true, action: actionType, current_url: page.url() };
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

  // Explicit Test Navigation Endpoint
  if (url === '/test-navigation' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const targetUrl = payload.url || 'https://www.facebook.com/';
        const result = await navigateAndVerifyFacebook(targetUrl, '1');
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
        const targetPostId = payload.target_post_id || '';
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
      const buffer = await page.screenshot({ type: 'jpeg', quality: 80 });
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
