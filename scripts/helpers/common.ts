import { Page } from 'playwright';

export interface LoginSelectors {
  loginButtons?: string[];
  emailInputs?: string[];
  submitButtons?: string[];
}

export interface SeatSelectors {
  seats?: string[];
  bookingButtons?: string[];
}

export interface CheckoutSelectors {
  checkoutButtons?: string[];
  confirmationPatterns?: string[];
}

export interface SiteHelper {
  name: string;
  login(page: Page, email: string, password: string): Promise<boolean>;
  selectSeat(page: Page): Promise<boolean>;
  checkout(page: Page): Promise<boolean>;
  prepare?: (page: Page, targetUrl: string) => Promise<void>;
}

const defaultLoginSelectors: Required<LoginSelectors> = {
  loginButtons: [
    'a:has-text("Login")',
    'a:has-text("Sign in")',
    'a:has-text("Log in")',
    'button:has-text("Login")',
    'button:has-text("Sign in")',
    '[href*="login"]',
    '[href*="signin"]',
    '#login',
    '.login'
  ],
  emailInputs: [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="Email" i]',
    '#email',
    '#username'
  ],
  submitButtons: [
    'button[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'input[type="submit"]'
  ]
};

const defaultSeatSelectors: Required<SeatSelectors> = {
  seats: [
    '.seat.available',
    '.seat:not(.occupied)',
    'button.seat:not([disabled])',
    '[class*="seat"]:not([class*="occupied"]):not([disabled])',
    'button:has-text("Select")',
    'button:has-text("Choose")',
    '.available-seat'
  ],
  bookingButtons: [
    'button:has-text("Book")',
    'button:has-text("Reserve")',
    'button:has-text("Buy")',
    'a:has-text("Book")',
    'a:has-text("Reserve")'
  ]
};

const defaultCheckoutSelectors: Required<CheckoutSelectors> = {
  checkoutButtons: [
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
  ],
  confirmationPatterns: [
    'Success',
    'Confirmed',
    'Complete',
    'Thank you',
    'Order placed'
  ]
};

export async function performLogin(
  page: Page,
  email: string,
  password: string,
  overrides: LoginSelectors = {}
): Promise<boolean> {
  const loginSelectors = overrides.loginButtons ?? defaultLoginSelectors.loginButtons;
  const emailSelectors = overrides.emailInputs ?? defaultLoginSelectors.emailInputs;
  const submitSelectors = overrides.submitButtons ?? defaultLoginSelectors.submitButtons;

  try {
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

    await page.waitForTimeout(1000);

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

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.fill(password);
    console.log('🔑 Password entered');

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

    await page.waitForTimeout(3000);

    return true;
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function selectSeat(
  page: Page,
  overrides: SeatSelectors = {}
): Promise<boolean> {
  const seatSelectors = overrides.seats ?? defaultSeatSelectors.seats;
  const bookingSelectors = overrides.bookingButtons ?? defaultSeatSelectors.bookingButtons;

  try {
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

export async function performCheckout(
  page: Page,
  overrides: CheckoutSelectors = {}
): Promise<boolean> {
  const checkoutSelectors = overrides.checkoutButtons ?? defaultCheckoutSelectors.checkoutButtons;
  const confirmationPatterns =
    overrides.confirmationPatterns ?? defaultCheckoutSelectors.confirmationPatterns;

  try {
    for (const selector of checkoutSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 3000 })) {
          await button.click();
          console.log(`🛒 Checkout button clicked: ${selector}`);
          await page.waitForTimeout(2000);

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

    console.log('⚠️ No explicit checkout button found');
    return false;
  } catch (error) {
    console.error('Checkout error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export const defaultHelper: SiteHelper = {
  name: 'default',
  login: (page, email, password) => performLogin(page, email, password),
  selectSeat: (page) => selectSeat(page),
  checkout: (page) => performCheckout(page)
};
