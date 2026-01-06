import { chromium, Browser } from 'playwright';
import { getHelperForUrl } from './helpers/siteRouter';
import { hasStartTimePassed } from './helpers/time';

const EXIT_CODE_START_TIME_NOT_REACHED = 3;

async function main() {
  let browser: Browser | null = null;

  try {
    console.log('🤖 Starting LivePing Bot...');

    const TARGET_URL = process.env.TARGET_URL || process.env.EVENT_URL;
    const START_TIME = process.env.START_TIME;
    const LOGIN_EMAIL = process.env.LOGIN_EMAIL;
    const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;

    if (!TARGET_URL) {
      throw new Error('Missing required environment variable: TARGET_URL');
    }

    if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
      throw new Error('Missing required environment variables: LOGIN_EMAIL and LOGIN_PASSWORD');
    }

    if (!hasStartTimePassed(START_TIME)) {
      process.exitCode = EXIT_CODE_START_TIME_NOT_REACHED;
      return;
    }

    const helper = getHelperForUrl(TARGET_URL);

    console.log(`📍 Event URL: ${TARGET_URL}`);
    console.log(`🔧 Using helper: ${helper.name}`);

    console.log('🚀 Launching Chromium browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    console.log('🌐 Navigating to event page...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

    if (helper.prepare) {
      await helper.prepare(page, TARGET_URL);
    }

    console.log('🔐 Attempting to login...');
    const loginSuccess = await helper.login(page, LOGIN_EMAIL, LOGIN_PASSWORD);

    if (!loginSuccess) {
      throw new Error('Login failed');
    }

    console.log('✅ Login successful');

    if (page.url() !== TARGET_URL) {
      console.log('↩️ Returning to event page...');
      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    }

    console.log('🎫 Attempting to select seat...');
    const seatSelected = await helper.selectSeat(page);

    if (!seatSelected) {
      throw new Error('No seats available or seat selection failed');
    }

    console.log('✅ Seat selected successfully');

    console.log('💳 Attempting checkout...');
    const checkoutSuccess = await helper.checkout(page);

    if (!checkoutSuccess) {
      throw new Error('Checkout process failed');
    }

    console.log('🎉 Bought successfully');
  } catch (error) {
    console.error('❌ Purchase failed');
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

main();
