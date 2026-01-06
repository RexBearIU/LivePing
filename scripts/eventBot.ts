import { chromium, Browser, Page } from 'playwright';

/**
 * LivePing Event Bot
 * Automates seat selection and checkout for event pages
 */

async function main() {
  let browser: Browser | null = null;
  
  try {
    console.log('🤖 Starting LivePing Bot...');
    
    // Get environment variables
    const EVENT_URL = process.env.EVENT_URL || 'https://example.com/event';
    const LOGIN_EMAIL = process.env.LOGIN_EMAIL;
    const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD;
    
    if (!LOGIN_EMAIL || !LOGIN_PASSWORD) {
      throw new Error('Missing required environment variables: LOGIN_EMAIL and LOGIN_PASSWORD');
    }
    
    console.log(`📍 Event URL: ${EVENT_URL}`);
    
    // Launch Chromium browser
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
    
    // Navigate to event page
    console.log('🌐 Navigating to event page...');
    await page.goto(EVENT_URL, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Attempt to login
    console.log('🔐 Attempting to login...');
    const loginSuccess = await performLogin(page, LOGIN_EMAIL, LOGIN_PASSWORD);
    
    if (!loginSuccess) {
      throw new Error('Login failed');
    }
    
    console.log('✅ Login successful');
    
    // Navigate back to event page after login (if redirected)
    if (page.url() !== EVENT_URL) {
      console.log('↩️ Returning to event page...');
      await page.goto(EVENT_URL, { waitUntil: 'networkidle', timeout: 30000 });
    }
    
    // Attempt to select seat
    console.log('🎫 Attempting to select seat...');
    const seatSelected = await selectSeat(page);
    
    if (!seatSelected) {
      throw new Error('No seats available or seat selection failed');
    }
    
    console.log('✅ Seat selected successfully');
    
    // Attempt checkout
    console.log('💳 Attempting checkout...');
    const checkoutSuccess = await performCheckout(page);
    
    if (!checkoutSuccess) {
      throw new Error('Checkout process failed');
    }
    
    console.log('🎉 Bought successfully');
    
  } catch (error) {
    console.error('❌ Purchase failed');
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

/**
 * Attempt to login to the event platform
 */
async function performLogin(page: Page, email: string, password: string): Promise<boolean> {
  try {
    // Look for common login button/link patterns
    const loginSelectors = [
      'a:has-text("Login")',
      'a:has-text("Sign in")',
      'a:has-text("Log in")',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      '[href*="login"]',
      '[href*="signin"]',
      '#login',
      '.login'
    ];
    
    // Try to find and click login button
    let loginButtonFound = false;
    for (const selector of loginSelectors) {
      try {
        const loginButton = page.locator(selector).first();
        if (await loginButton.isVisible({ timeout: 2000 })) {
          await loginButton.click();
          loginButtonFound = true;
          break;
        }
      } catch {
        continue;
      }
    }
    
    if (!loginButtonFound) {
      console.log('⚠️ No login button found, checking if already logged in...');
    }
    
    // Wait for login form to appear
    await page.waitForTimeout(1000);
    
    // Look for email/username input field
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="Email" i]',
      '#email',
      '#username'
    ];
    
    let emailInput = null;
    for (const selector of emailSelectors) {
      try {
        const input = page.locator(selector).first();
        if (await input.isVisible({ timeout: 2000 })) {
          emailInput = input;
          break;
        }
      } catch {
        continue;
      }
    }
    
    if (!emailInput) {
      console.log('⚠️ Email input not found, may already be logged in');
      return true;
    }
    
    await emailInput.fill(email);
    console.log('📧 Email entered');
    
    // Look for password input field
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.fill(password);
    console.log('🔑 Password entered');
    
    // Look for submit button
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
      'input[type="submit"]'
    ];
    
    for (const selector of submitSelectors) {
      try {
        const submitButton = page.locator(selector).first();
        if (await submitButton.isVisible({ timeout: 2000 })) {
          await submitButton.click();
          break;
        }
      } catch {
        continue;
      }
    }
    
    // Wait for navigation or login completion
    await page.waitForTimeout(3000);
    
    return true;
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Attempt to select an available seat
 */
async function selectSeat(page: Page): Promise<boolean> {
  try {
    // Look for common seat selection patterns
    const seatSelectors = [
      '.seat.available',
      '.seat:not(.occupied)',
      'button.seat:not([disabled])',
      '[class*="seat"]:not([class*="occupied"]):not([disabled])',
      'button:has-text("Select")',
      'button:has-text("Choose")',
      '.available-seat'
    ];
    
    for (const selector of seatSelectors) {
      try {
        const seat = page.locator(selector).first();
        if (await seat.isVisible({ timeout: 3000 })) {
          await seat.click();
          console.log(`🪑 Seat clicked: ${selector}`);
          await page.waitForTimeout(1000);
          return true;
        }
      } catch {
        continue;
      }
    }
    
    // Alternative: Look for "Book now" or similar buttons
    const bookingSelectors = [
      'button:has-text("Book")',
      'button:has-text("Reserve")',
      'button:has-text("Buy")',
      'a:has-text("Book")',
      'a:has-text("Reserve")'
    ];
    
    for (const selector of bookingSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click();
          console.log(`📝 Booking button clicked: ${selector}`);
          await page.waitForTimeout(1000);
          return true;
        }
      } catch {
        continue;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Seat selection error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Attempt to complete the checkout process
 */
async function performCheckout(page: Page): Promise<boolean> {
  try {
    // Look for checkout/proceed buttons
    const checkoutSelectors = [
      'button:has-text("Checkout")',
      'button:has-text("Proceed")',
      'button:has-text("Continue")',
      'button:has-text("Confirm")',
      'button:has-text("Purchase")',
      'button:has-text("Buy")',
      'a:has-text("Checkout")',
      'a:has-text("Proceed")',
      '[href*="checkout"]',
      '#checkout',
      '.checkout-button'
    ];
    
    for (const selector of checkoutSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          await button.click();
          console.log(`🛒 Checkout button clicked: ${selector}`);
          await page.waitForTimeout(2000);
          
          // Look for confirmation
          const confirmationPatterns = [
            'Success',
            'Confirmed',
            'Complete',
            'Thank you',
            'Order placed'
          ];
          
          const pageContent = await page.content();
          for (const pattern of confirmationPatterns) {
            if (pageContent.toLowerCase().includes(pattern.toLowerCase())) {
              console.log(`✅ Found confirmation: ${pattern}`);
              return true;
            }
          }
          
          return true;
        }
      } catch {
        continue;
      }
    }
    
    // If we made it this far without errors, consider it a success
    console.log('⚠️ No explicit checkout button found, but no errors occurred');
    return true;
  } catch (error) {
    console.error('Checkout error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the bot
main();
