# LivePing

A CI/CD-ready Playwright bot that automates event seat booking. Runs on GitHub Actions with scheduled execution and email notifications.

## Features

- 🤖 **Automated Booking**: Playwright-powered browser automation for seat selection
- ⏰ **Scheduled Execution**: Runs every minute via GitHub Actions cron
- 📧 **Email Notifications**: Sends results (success/failure) via email
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
- `EVENT_URL`: URL of the event page to monitor
- `LOGIN_EMAIL`: Login email/username for the event platform
- `LOGIN_PASSWORD`: Login password for the event platform

#### Email Notification Secrets:
- `MAIL_USERNAME`: SMTP username (e.g., your Gmail address)
- `MAIL_PASSWORD`: SMTP password (for Gmail, use an [App Password](https://support.google.com/accounts/answer/185833))
- `MAIL_TO`: Email address to receive notifications

### 4. Enable GitHub Actions

1. Go to your repository → Actions tab
2. Enable workflows if prompted
3. The bot will run every minute automatically via cron schedule

## Local Testing

Test the bot locally before deploying:

```bash
export EVENT_URL="https://your-event-page.com"
export LOGIN_EMAIL="your-email@example.com"
export LOGIN_PASSWORD="your-password"

npm run bot
```

## How It Works

1. **Launch**: Chromium browser launches in headless mode
2. **Navigate**: Goes to the configured event URL
3. **Login**: Attempts to login using provided credentials
4. **Select Seat**: Searches for available seats and attempts to select one
5. **Checkout**: Attempts to complete the checkout process
6. **Result**: Logs "Bought successfully" or "Purchase failed"
7. **Notify**: Sends email notification with the result

## Workflow Schedule

The GitHub Actions workflow runs:
- **Every minute** via cron: `* * * * *`
- **Manually** via workflow_dispatch (Actions tab → Run workflow)

⚠️ **Note**: Running every minute may be aggressive for some event platforms. Consider adjusting to a more conservative schedule (e.g., every 5-10 minutes) to avoid rate limiting or IP blocking. See the Customization section below.

## Customization

### Modify the Bot Script

Edit `scripts/eventBot.ts` to customize:
- Selector patterns for login, seats, checkout buttons
- Timeout values
- Error handling
- Additional logic

### Adjust Schedule

Edit `.github/workflows/event-bot.yml`:
```yaml
schedule:
  - cron: '*/5 * * * *'  # Every 5 minutes
  - cron: '0 * * * *'    # Every hour
```

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

### Email notifications not working
- Verify all `MAIL_*` secrets are configured
- For Gmail, ensure "Less secure app access" is enabled OR use App Password
- Check SMTP server settings

### Seats not found
- The bot looks for common seat selector patterns
- You may need to customize selectors in `scripts/eventBot.ts`
- Use browser DevTools to inspect the event page structure

## License

MIT
