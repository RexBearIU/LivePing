import { Page } from 'playwright';

export type SupportedAction = 'click' | 'type';

export interface AIInstruction {
  action: SupportedAction;
  selector: string;
  value?: string;
}

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

function extractJsonPayload(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  const bare = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return bare ? bare[0].trim() : null;
}

function isValidInstruction(instruction: Partial<AIInstruction>): instruction is AIInstruction {
  return (
    !!instruction &&
    (instruction.action === 'click' || instruction.action === 'type') &&
    typeof instruction.selector === 'string' &&
    instruction.selector.trim().length > 0 &&
    (instruction.action === 'click' || typeof instruction.value === 'string')
  );
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    'div.g-recaptcha',
    '[id*="captcha"]',
    '[class*="captcha"]',
    'input[name*="captcha"]',
    'input[id*="captcha"]',
    'img[src*="captcha"]',
    '[aria-label*="captcha" i]'
  ];

  for (const selector of captchaSelectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: 1000 })) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export async function requestGeminiActions(
  page: Page,
  options: { workflowUrls: string[]; reason: string }
): Promise<AIInstruction[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY not set; skipping Gemini assistance.');
    return [];
  }

  const [domContent, screenshot] = await Promise.all([
    page.content(),
    page.screenshot({ fullPage: true })
  ]);

  const workflowList = options.workflowUrls.join('\n- ');
  const prompt = [
    'You are assisting a Playwright bot with the workflow: login -> seat selection -> checkout -> notification.',
    'The page may contain a captcha or be outside the expected workflow.',
    `Current URL: ${page.url()}`,
    `Reason for request: ${options.reason}`,
    'Expected workflow URLs or patterns:',
    `- ${workflowList}`,
    'Use the provided DOM and screenshot to decide the next action.',
    'Respond with ONLY a JSON array (or a single JSON object) of instructions. No prose, no code fences.',
    'Each instruction must be one of:',
    '{"action":"click","selector":"<css selector>"}',
    '{"action":"type","selector":"<css selector>","value":"<text to enter>"}',
    'Prefer minimal steps that move the flow forward toward checkout.',
    'If no meaningful action is possible, return an empty JSON array []'
  ].join('\n');

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${prompt}\n\nDOM:\n${domContent}` },
            { inline_data: { mime_type: 'image/png', data: screenshot.toString('base64') } }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    return [];
  }

  const json = (await response.json()) as any;
  const textResponse =
    json?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part?.text ?? '')
      .join('')
      .trim() ?? '';

  if (!textResponse) {
    return [];
  }

  const payload = extractJsonPayload(textResponse);
  if (!payload) {
    console.warn('⚠️ Gemini response did not contain JSON payload.');
    return [];
  }

  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) {
      return parsed.filter(isValidInstruction);
    }
    if (isValidInstruction(parsed)) {
      return [parsed];
    }
    console.warn('⚠️ Gemini JSON payload is not a valid instruction set.');
    return [];
  } catch (error) {
    console.error('Failed to parse Gemini response JSON:', error instanceof Error ? error.message : error);
    return [];
  }
}

export async function handleAIResponse(page: Page, instructions: AIInstruction[]): Promise<boolean> {
  if (!instructions.length) {
    return false;
  }

  let executed = false;
  for (const instruction of instructions) {
    try {
      if (instruction.action === 'click') {
        await page.locator(instruction.selector).first().click({ timeout: 5000 });
        executed = true;
        continue;
      }

      if (instruction.action === 'type' && typeof instruction.value === 'string') {
        const input = page.locator(instruction.selector).first();
        await input.fill(instruction.value);
        executed = true;
      }
    } catch (error) {
      console.warn(
        `⚠️ Failed to execute AI instruction (${instruction.action} ${instruction.selector}):`,
        error instanceof Error ? error.message : error
      );
      continue;
    }
  }

  return executed;
}
