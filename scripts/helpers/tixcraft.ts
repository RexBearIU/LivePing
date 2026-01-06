import { performCheckout, performLogin, selectSeat, SiteHelper } from './common';

const loginSelectors = {
  loginButtons: [
    'a:has-text("登入")',
    'a:has-text("Sign in")',
    'button:has-text("登入")',
    'button:has-text("Login")',
    '#loginBtn',
    '[href*="login"]'
  ],
  emailInputs: [
    'input#uid',
    'input[name="uid"]',
    'input[type="email"]',
    'input[name="email"]'
  ],
  submitButtons: [
    'button#btnLogin',
    'button:has-text("登入")',
    'button:has-text("Login")',
    'input[type="submit"]'
  ]
};

const seatSelectors = {
  seats: [
    '.zone .area-list button:not([disabled])',
    'button:has-text("立即購票")',
    'a:has-text("立即購票")',
    '.seat.available'
  ],
  bookingButtons: ['button:has-text("立即購票")', 'a:has-text("立即購票")']
};

const checkoutSelectors = {
  checkoutButtons: [
    'button:has-text("同意")',
    'button:has-text("下一步")',
    'button:has-text("確認訂單")',
    'button:has-text("結帳")',
    'button:has-text("付款")'
  ],
  confirmationPatterns: ['成功', '完成', '已確認', 'Thank you', 'Order placed']
};

export const tixcraftHelper: SiteHelper = {
  name: 'tixcraft',
  login: (page, email, password) => performLogin(page, email, password, loginSelectors),
  selectSeat: (page) => selectSeat(page, seatSelectors),
  checkout: (page) => performCheckout(page, checkoutSelectors)
};
