import { chromium, Browser, Page } from 'playwright';
import { getHelperForUrl } from './helpers/siteRouter';
import { hasStartTimePassed } from './helpers/time';
import { detectCaptcha, handleAIResponse, requestGeminiActions } from './helpers/gemini';

const EXIT_CODE_START_TIME_NOT_REACHED = 3;
const AI_ACTION_DELAY_MS = Number.isFinite(Number(process.env.AI_ACTION_DELAY_MS))
  ? Number(process.env.AI_ACTION_DELAY_MS)
  : 500;

function buildWorkflowAllowlist(targetUrl: string): string[] {
  const normalizedTarget = targetUrl.toLowerCase();
  let origin = '';
  try {
    origin = new URL(targetUrl).origin.toLowerCase();
  } catch {
    // Fall back to path-based checks when URL parsing fails
  }

  const pathSegments = [
    '/login',
    '/signin',
    '/auth',
    '/account',
    '/seat',
    '/seats',
    '/ticket',
    '/tickets',
    '/cart',
    '/checkout',
    '/payment',
    '/confirm',
    '/order',
    '/captcha'
  ];

  const allowlist: string[] = [normalizedTarget];

  if (origin) {
    allowlist.push(origin);
    for (const segment of pathSegments) {
      allowlist.push(`${origin}${segment}`);
    }
  }

  allowlist.push(...pathSegments);
  return Array.from(new Set(allowlist));
}

function deriveAllowedOrigins(allowlist: string[]): string[] {
  return allowlist
    .filter((entry) => entry.startsWith('http'))
    .map((entry) => {
      try {
        return new URL(entry).origin.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => !!origin);
}

function isAllowedWorkflowUrl(url: string, allowlist: string[], allowedOrigins: string[]): boolean {
  const current = url.toLowerCase();
  try {
    const parsed = new URL(current);
    const parsedOrigin = parsed.origin.toLowerCase();
    const parsedPath = parsed.pathname.toLowerCase();
    const parsedHref = parsed.href.toLowerCase();
    return allowlist.some((allowed) => {
      const normalizedAllowed = allowed.toLowerCase();
      if (normalizedAllowed.startsWith('http')) {
        try {
          const allowedUrl = new URL(normalizedAllowed);
          const allowedOrigin = allowedUrl.origin.toLowerCase();
          const allowedPath = allowedUrl.pathname || '/';
          if (parsedOrigin !== allowedOrigin) {
            return false;
          }
          return parsedPath.startsWith(allowedPath.toLowerCase());
        } catch {
          return parsedHref.startsWith(normalizedAllowed);
        }
      }
      if (normalizedAllowed.startsWith('/')) {
        if (allowedOrigins.length > 0 && !allowedOrigins.includes(parsedOrigin)) {
          return false;
        }
        return parsedPath.startsWith(normalizedAllowed);
      }
      return parsedHref.startsWith(normalizedAllowed);
    });
  } catch {
    // If URL cannot be parsed, fall back to string prefix comparison
    return allowlist.some((allowed) => current.startsWith(allowed.toLowerCase()));
  }
}

async function guardWithGemini(
  page: Page,
  allowlist: string[],
  allowedOrigins: string[],
  reason: string
): Promise<void> {
  const unexpectedUrl = !isAllowedWorkflowUrl(page.url(), allowlist, allowedOrigins);
  const captchaDetected = await detectCaptcha(page);

  if (!unexpectedUrl && !captchaDetected) {
    return;
  }

  console.log(
    unexpectedUrl
      ? '⚠️ Page is outside expected workflow, requesting Gemini guidance...'
      : '⚠️ Captcha detected, requesting Gemini guidance...'
  );

  const instructions = await requestGeminiActions(page, {
    workflowUrls: allowlist,
    reason: `${reason} - ${unexpectedUrl ? 'unexpected workflow URL' : 'captcha detected'}`
  });

  if (!instructions.length) {
    console.log('ℹ️ No AI instructions received from Gemini.');
    return;
  }

  const executed = await handleAIResponse(page, instructions);
  if (executed) {
    await page.waitForTimeout(AI_ACTION_DELAY_MS);
  }
}

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
    const workflowAllowlist = buildWorkflowAllowlist(TARGET_URL);
    const workflowOrigins = deriveAllowedOrigins(workflowAllowlist);

    console.log(`📍 Event URL: ${TARGET_URL}`);
    console.log(`🔧 Using helper: ${helper.name}`);

    const headless = (process.env.HEADLESS ?? 'true').toLowerCase() !== 'false';

    console.log(`🚀 Launching Chromium browser (headless=${headless})...`);
    browser = await chromium.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    console.log('🌐 Navigating to event page...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await guardWithGemini(page, workflowAllowlist, workflowOrigins, 'After initial navigation');

    if (helper.prepare) {
      await helper.prepare(page, TARGET_URL);
    }

    console.log('🔐 Attempting to login...');
    const loginSuccess = await helper.login(page, LOGIN_EMAIL, LOGIN_PASSWORD);

    if (!loginSuccess) {
      throw new Error('Login failed');
    }

    console.log('✅ Login successful');
    await guardWithGemini(page, workflowAllowlist, workflowOrigins, 'Post-login guard');

    if (page.url() !== TARGET_URL) {
      console.log('↩️ Returning to event page...');
      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await guardWithGemini(page, workflowAllowlist, workflowOrigins, 'After returning to target');
    }

    console.log('🎫 Attempting to select seat...');
    await guardWithGemini(page, workflowAllowlist, workflowOrigins, 'Before seat selection');
    const seatSelected = await helper.selectSeat(page);

    if (!seatSelected) {
      await guardWithGemini(page, workflowAllowlist, workflowOrigins, 'Seat selection failed or blocked');
      throw new Error('No seats available or seat selection failed');
    }

    console.log('✅ Seat selected successfully');

    console.log('💳 Attempting checkout...');
    await guardWithGemini(page, workflowAllowlist, workflowOrigins, 'Before checkout');
    const checkoutSuccess = await helper.checkout(page);

    if (!checkoutSuccess) {
      await guardWithGemini(page, workflowAllowlist, workflowOrigins, 'Checkout failed or blocked');
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
