const { chromium } = require('playwright');
const fs = require('fs');

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log(JSON.stringify({ success: false, error: 'Email and password required' }));
    process.exit(1);
  }

  let browser;
  try {
    const launchOptions = { headless: true };
    const systemChromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (fs.existsSync(systemChromePath)) {
      launchOptions.executablePath = systemChromePath;
    }

    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // 1. Navigate to Facebook Login Page
    await page.goto('https://www.facebook.com/login/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    // Accept Cookie consent if presented
    try {
      const cookieBtn = page.locator('button[data-cookiebanner="accept_only_essential_button"], button[title="Allow essential and optional cookies"], button:has-text("Allow"), button:has-text("Accept")');
      if (await cookieBtn.isVisible({ timeout: 2000 })) {
        await cookieBtn.click();
      }
    } catch (e) {}

    // 2. Locate and fill Email & Password inputs
    const emailSelector = 'input[name="email"], #email';
    const passSelector = 'input[name="pass"], #pass';

    await page.waitForSelector(emailSelector, { timeout: 8000 });
    await page.fill(emailSelector, email);
    await page.fill(passSelector, password);

    // 3. Submit form by pressing Enter
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
      page.keyboard.press('Enter')
    ]);

    // 4. Evaluate authentication result
    const url = page.url();
    const cookies = await context.cookies();
    const hasUserCookie = cookies.some(c => c.name === 'c_user' || c.name === 'xs');

    const pageContent = await page.content();
    const isErrorPage = pageContent.includes('The password you’ve entered is incorrect') || 
                        pageContent.includes('The email address you entered isn\'t connected') ||
                        pageContent.includes('Invalid username or password') ||
                        url.includes('login/device-based') ||
                        url.includes('login_attempt');

    if (hasUserCookie || (!isErrorPage && url.includes('facebook.com') && !url.includes('login'))) {
      console.log(JSON.stringify({ success: true, email: email, url: url }));
    } else {
      console.log(JSON.stringify({
        success: false,
        error: 'Facebook authentication rejected: The email or password entered is incorrect.',
        url: url
      }));
    }

  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message || 'Playwright browser execution error' }));
  } finally {
    if (browser) await browser.close();
  }
}

main();
