import type { GenerativeModel } from '@google/generative-ai';
import { Page } from 'playwright';

export type SupportedAction = 'click' | 'type';

export interface AIInstruction {
  action: SupportedAction;
  selector: string;
  value?: string;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash-latest';
const MAX_DOM_CHARS = 100_000;
const MAX_SELECTOR_LENGTH = 500;
const MAX_VALUE_LENGTH = 500;

let googleGenAIModulePromise: Promise<typeof import('@google/generative-ai')> | undefined;
const cachedModels = new Map<string, GenerativeModel>();

async function getGeminiModel(apiKey: string): Promise<GenerativeModel> {
  const cached = cachedModels.get(apiKey);
  if (cached) {
    return cached;
  }

  googleGenAIModulePromise ??= import('@google/generative-ai');

  const { GoogleGenerativeAI } = await googleGenAIModulePromise;
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
  cachedModels.set(apiKey, model);
  return model;
}

function extractJsonPayload(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed;
  }

  const bare = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return bare ? bare[0].trim() : null;
}

function isValidInstruction(instruction: Partial<AIInstruction>): instruction is AIInstruction {
  const selector = typeof instruction.selector === 'string' ? instruction.selector.trim() : '';
  return (
    !!instruction &&
    (instruction.action === 'click' || instruction.action === 'type') &&
    selector.length > 0 &&
    selector.length <= MAX_SELECTOR_LENGTH &&
    !selector.includes('\n') &&
    (instruction.action === 'click' ||
      (typeof instruction.value === 'string' && instruction.value.length <= MAX_VALUE_LENGTH))
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
    console.warn('⚠️ GEMINI_API_KEY not set; skipping Gemini assistance. Set this env var to enable DOM/screenshot guidance.');
    return [];
  }

  const [domContent, screenshot] = await Promise.all([
    page.content(),
    page.screenshot()
  ]);
  const domPayload = domContent.length > MAX_DOM_CHARS ? domContent.slice(0, MAX_DOM_CHARS) : domContent;

  const workflowList = options.workflowUrls.join('\n- ');
  const prompt = [
    'You are assisting a Playwright bot with the workflow: login -> seat selection -> checkout -> notification.',
    'The page may contain a captcha or be outside the expected workflow.',
    `Current URL: ${page.url()}`,
    `Reason for request: ${options.reason}`,
    'Expected workflow URLs or patterns:',
    `- ${workflowList}`,
    'Use the provided DOM and screenshot to decide the next action.',
    'Respond with ONLY a JSON array (or a single JSON object) of instructions. You may wrap the JSON in ```json``` fences if needed, but no additional prose.',
    'Each instruction must be one of:',
    '{"action":"click","selector":"<css selector>"}',
    '{"action":"type","selector":"<css selector>","value":"<text to enter>"}',
    'Prefer minimal steps that move the flow forward toward checkout.',
    'If no meaningful action is possible, return an empty JSON array []'
  ].join('\n');

  let model: GenerativeModel;
  try {
    model = await getGeminiModel(apiKey);
  } catch (error) {
    console.error('Failed to initialize Gemini SDK client:', error instanceof Error ? error.message : error);
    return [];
  }

  let textResponse = '';
  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${prompt}\n\nDOM (truncated if large):\n${domPayload}` },
            { inlineData: { mimeType: 'image/png', data: screenshot.toString('base64') } }
          ]
        }
      ]
    });
    const response = result?.response;
    if (!response) {
      console.error('Gemini SDK returned an empty response.');
      return [];
    }
    try {
      textResponse = (await response.text())?.trim() ?? '';
    } catch (error) {
      console.error('Failed to read Gemini response text:', error instanceof Error ? error.message : error);
      return [];
    }
  } catch (error) {
    console.error('Gemini API error (SDK):', error instanceof Error ? error.message : error);
    return [];
  }

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
      if (!isValidInstruction(instruction)) {
        continue;
      }
      const selector = instruction.selector.trim();

      if (instruction.action === 'click') {
        await page.locator(selector).first().click({ timeout: 5000 });
        executed = true;
        continue;
      }

      if (instruction.action === 'type' && typeof instruction.value === 'string') {
        const safeValue = instruction.value.slice(0, MAX_VALUE_LENGTH);
        const input = page.locator(selector).first();
        await input.fill(safeValue);
        executed = true;
      }
    } catch (error) {
      const valueInfo =
        instruction.action === 'type' && typeof instruction.value === 'string'
          ? ` value="${instruction.value}"`
          : '';
      console.warn(
        `⚠️ Failed to execute AI instruction (${instruction.action} ${instruction.selector}${valueInfo}):`,
        error instanceof Error ? error.message : error
      );
      continue;
    }
  }

  return executed;
}
