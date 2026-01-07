# LivePing

A CI/CD-ready Playwright bot that automates event seat booking. Runs on GitHub Actions with scheduled execution and email notifications.

## Features

- 🤖 **Automated Booking**: Playwright-powered browser automation for seat selection
- ⏰ **Workflow Dispatch**: Manual trigger with optional start time guard
- 📧 **GitHub Notifications**: Posts results (success/failure) using GitHub issues/notifications
- 🔒 **Secure**: Uses GitHub Secrets for credentials
- 🚀 **Zero Infrastructure**: Runs entirely on GitHub Actions

## Setup

### 1. Fork/Clone Repository

```bash
git clone https://github.com/RexBearIU/LivePing.git
cd LivePing
```

### 2. Install Dependencies (for local testing)

```bash
npm install
npm run install-playwright
```

### 3. Configure GitHub Secrets

Go to your repository settings → Secrets and variables → Actions, and add:

#### Required Secrets:
- `LOGIN_EMAIL`: Login email/username for the event platform
- `LOGIN_PASSWORD`: Login password for the event platform
- `GEMINI_API_KEY` (optional locally, recommended in CI): Google Gemini API key for AI-guided recovery when encountering CAPTCHAs or unexpected pages.

#### Optional Notification Variable:
- `NOTIFY_USERS` (Repository variable): Space-separated GitHub usernames or teams (e.g., `username1 username2 org/team-name`, rendered as `@username1 @username2 @org/team-name`).
  The workflow normalizes usernames (strips leading `@`, adds it back) and mentions them in the notification issue
  (GitHub notifications/email settings apply).

### 4. Enable GitHub Actions

1. Go to your repository → Actions tab
2. Enable workflows if prompted
3. The bot will run every minute automatically via cron schedule

## Local Testing

Test the bot locally before deploying:

```bash
export TARGET_URL="https://your-event-page.com"
export LOGIN_EMAIL="your-email@example.com"
export LOGIN_PASSWORD="your-password"
export START_TIME="2026-01-06T16:00:00Z" # optional
# export HEADLESS=false # optional: view the browser locally (defaults to true, including in CI)

npm run bot
```

## How It Works

1. **Launch**: Chromium browser launches in headless mode
2. **Start Guard**: Exits early if the provided `start_time` has not been reached
3. **Navigate**: Goes to the configured event URL
4. **Login**: Attempts to login using provided credentials
5. **Select Seat**: Searches for available seats and attempts to select one
6. **Checkout**: Attempts to complete the checkout process
7. **Result**: Logs "Bought successfully" or "Purchase failed"
8. **Notify**: Creates a GitHub issue notification with the result (mentions `NOTIFY_USERS` if set)

### Gemini-assisted recovery

- The bot monitors its workflow (login → seat selection → checkout) and common CAPTCHA indicators.
- When the current page does not match the expected workflow or a CAPTCHA is detected, it captures the DOM and screenshot, sends them to Gemini, and executes the returned JSON instructions (`click` / `type`) to move forward.
- Set `GEMINI_API_KEY` to enable this behavior. Without it, the bot skips the Gemini step.

## Workflow Trigger

Use **Actions → LivePing Manual Runner → Run workflow** and provide:
- `target_url` (required): Event page to monitor
- `start_time` (optional): ISO timestamp (UTC). The bot exits early until this time.

The workflow loops for up to 10 minutes, retrying every 5 minutes until a success occurs.

## Customization

### Modify the Bot Script

Edit `scripts/eventBot.ts` to customize:
- Selector patterns for login, seats, checkout buttons
- Timeout values
- Error handling
- Additional logic

### Adjust Schedule

Edit `.github/workflows/liveping.yml` to change the loop duration or sleep interval.

## Security Notes

- Never commit credentials to the repository
- Use GitHub Secrets for all sensitive data
- For Gmail SMTP, use App Passwords, not your regular password
- Review Playwright security best practices

## Troubleshooting

### Bot fails to login
- Verify `LOGIN_EMAIL` and `LOGIN_PASSWORD` secrets are correct
- Check if the event platform uses CAPTCHA (may need additional handling)
- Review bot logs in Actions tab

### Notifications not arriving
- Ensure the users listed in `NOTIFY_USERS` have access to the repo
- Users must watch the repository or have GitHub notifications enabled for issue creations/mentions
- Check that `NOTIFY_USERS` uses valid GitHub usernames/teams (prefix not required; it is added automatically)

### Seats not found
- The bot looks for common seat selector patterns
- You may need to customize selectors in `scripts/eventBot.ts`
- Use browser DevTools to inspect the event page structure

## License

MIT
