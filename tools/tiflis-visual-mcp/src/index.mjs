#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { chromium } from 'playwright';
import * as z from 'zod/v4';

const SERVER_NAME = 'tiflis-visual-mcp';
const SERVER_VERSION = '0.1.0';
const DEFAULT_BASE_URL = 'https://loranius.github.io/tiflis/';
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_TEXT_LENGTH = 12_000;
const MAX_CONSOLE_LOGS = 250;

const baseUrl = process.env.TIFLIS_BASE_URL || DEFAULT_BASE_URL;
const timeoutMs = clampNumber(process.env.TIFLIS_TIMEOUT_MS, 1_000, 60_000, DEFAULT_TIMEOUT_MS);
const headless = process.env.TIFLIS_HEADLESS !== 'false';
const storageStatePath = process.env.TIFLIS_STORAGE_STATE || undefined;
const allowedOrigins = new Set(
  (process.env.TIFLIS_ALLOWED_ORIGINS || 'https://loranius.github.io,http://localhost,http://127.0.0.1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin),
);

let browser = null;
let context = null;
let page = null;
let contextProfileKey = null;
const consoleLogs = [];

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeTarget(target) {
  const resolved = new URL(target || baseUrl, baseUrl);
  if (!['http:', 'https:'].includes(resolved.protocol)) {
    throw new Error(`Protocol ${resolved.protocol} is not allowed.`);
  }
  if (!allowedOrigins.has(resolved.origin)) {
    throw new Error(`Origin ${resolved.origin} is blocked. Allowed origins: ${[...allowedOrigins].join(', ')}`);
  }
  return resolved.toString();
}

function viewportFrom(input = {}) {
  return {
    width: clampNumber(input.width, 320, 2_560, 448),
    height: clampNumber(input.height, 480, 2_560, 998),
    deviceScaleFactor: clampNumber(input.deviceScaleFactor, 1, 3, 1),
    isMobile: input.isMobile ?? true,
    hasTouch: input.hasTouch ?? true,
  };
}

async function ensurePage(viewportInput) {
  const viewport = viewportFrom(viewportInput);
  const nextProfileKey = JSON.stringify({
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
  });

  if (!browser) {
    browser = await chromium.launch({ headless });
  }

  if (context && contextProfileKey !== nextProfileKey) {
    await context.close();
    context = null;
    page = null;
  }

  if (!context) {
    context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
      isMobile: viewport.isMobile,
      hasTouch: viewport.hasTouch,
      storageState: storageStatePath,
      colorScheme: 'dark',
      locale: 'uk-UA',
    });
    contextProfileKey = nextProfileKey;
  }

  if (!page || page.isClosed()) {
    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.setDefaultNavigationTimeout(timeoutMs);

    page.on('console', (message) => {
      consoleLogs.push(`[${message.type()}] ${message.text()}`);
      if (consoleLogs.length > MAX_CONSOLE_LOGS) consoleLogs.shift();
    });

    page.on('pageerror', (error) => {
      consoleLogs.push(`[pageerror] ${safeError(error)}`);
      if (consoleLogs.length > MAX_CONSOLE_LOGS) consoleLogs.shift();
    });
  }

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  return page;
}

async function screenshotContent(currentPage, options = {}) {
  const selector = options.selector?.trim();
  const screenshotOptions = {
    type: 'png',
    animations: 'disabled',
  };

  let buffer;
  if (selector) {
    const locator = currentPage.locator(selector).first();
    await locator.waitFor({ state: 'visible' });
    buffer = await locator.screenshot(screenshotOptions);
  } else {
    buffer = await currentPage.screenshot({
      ...screenshotOptions,
      fullPage: options.fullPage ?? false,
    });
  }

  return {
    type: 'image',
    data: buffer.toString('base64'),
    mimeType: 'image/png',
  };
}

async function pageSummary(currentPage) {
  const summary = await currentPage.evaluate((maxLength) => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };

    const interactives = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]')]
      .filter(visible)
      .slice(0, 120)
      .map((element, index) => ({
        index,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        text: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160),
        id: element.id || null,
        name: element.getAttribute('name'),
        type: element.getAttribute('type'),
        href: element instanceof HTMLAnchorElement ? element.href : null,
        disabled: 'disabled' in element ? Boolean(element.disabled) : false,
      }));

    const dialogs = [...document.querySelectorAll('[role="dialog"], dialog')]
      .filter(visible)
      .map((element) => (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500));

    return {
      title: document.title,
      url: location.href,
      text: (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').slice(0, maxLength),
      interactives,
      dialogs,
    };
  }, MAX_TEXT_LENGTH);

  return JSON.stringify(summary, null, 2);
}

function okText(text) {
  return { content: [{ type: 'text', text }] };
}

function errorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: safeError(error) }],
  };
}

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

const viewportSchema = {
  width: z.number().int().min(320).max(2560).optional(),
  height: z.number().int().min(480).max(2560).optional(),
  deviceScaleFactor: z.number().int().min(1).max(3).optional(),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
};

server.registerTool(
  'tiflis_open',
  {
    description: 'Open an allowed Tiflis or localhost URL in a real Chromium browser.',
    inputSchema: z.object({
      url: z.string().optional().describe('Absolute URL or path relative to TIFLIS_BASE_URL.'),
      waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
      ...viewportSchema,
    }),
  },
  async (input) => {
    try {
      const currentPage = await ensurePage(input);
      const target = normalizeTarget(input.url);
      await currentPage.goto(target, { waitUntil: input.waitUntil || 'domcontentloaded' });
      return okText(`Opened ${currentPage.url()} at ${input.width || 448}×${input.height || 998}.`);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'tiflis_screenshot',
  {
    description: 'Capture the current page or one CSS-selected element and return it as an MCP image.',
    inputSchema: z.object({
      selector: z.string().min(1).optional(),
      fullPage: z.boolean().optional(),
      ...viewportSchema,
    }),
  },
  async (input) => {
    try {
      const currentPage = await ensurePage(input);
      const image = await screenshotContent(currentPage, input);
      return {
        content: [
          { type: 'text', text: `Screenshot captured from ${currentPage.url()}.` },
          image,
        ],
      };
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'tiflis_click',
  {
    description: 'Click a visible element by CSS selector and optionally return a screenshot after the click.',
    inputSchema: z.object({
      selector: z.string().min(1),
      screenshot: z.boolean().optional().default(true),
      waitAfterMs: z.number().int().min(0).max(5000).optional().default(250),
    }),
  },
  async ({ selector, screenshot, waitAfterMs }) => {
    try {
      const currentPage = await ensurePage();
      const locator = currentPage.locator(selector).first();
      await locator.waitFor({ state: 'visible' });
      await locator.click();
      if (waitAfterMs) await currentPage.waitForTimeout(waitAfterMs);
      const content = [{ type: 'text', text: `Clicked ${selector}. Current URL: ${currentPage.url()}` }];
      if (screenshot) content.push(await screenshotContent(currentPage));
      return { content };
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'tiflis_fill',
  {
    description: 'Fill a visible input, textarea, or contenteditable element. The value is never echoed back.',
    inputSchema: z.object({
      selector: z.string().min(1),
      value: z.string(),
      submit: z.boolean().optional().default(false),
    }),
  },
  async ({ selector, value, submit }) => {
    try {
      const currentPage = await ensurePage();
      const locator = currentPage.locator(selector).first();
      await locator.waitFor({ state: 'visible' });
      await locator.fill(value);
      if (submit) await locator.press('Enter');
      return okText(`Filled ${selector}${submit ? ' and submitted it' : ''}.`);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'tiflis_select',
  {
    description: 'Select an option in a native HTML select element.',
    inputSchema: z.object({
      selector: z.string().min(1),
      value: z.string().min(1),
    }),
  },
  async ({ selector, value }) => {
    try {
      const currentPage = await ensurePage();
      await currentPage.locator(selector).first().selectOption(value);
      return okText(`Selected an option in ${selector}.`);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'tiflis_snapshot',
  {
    description: 'Return visible page text, dialogs, and interactive elements for reliable follow-up clicks.',
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const currentPage = await ensurePage();
      return okText(await pageSummary(currentPage));
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'tiflis_console',
  {
    description: 'Read recent browser console messages and page errors.',
    inputSchema: z.object({ clear: z.boolean().optional().default(false) }),
  },
  async ({ clear }) => {
    const text = consoleLogs.length ? consoleLogs.join('\n') : 'No console messages captured.';
    if (clear) consoleLogs.length = 0;
    return okText(text);
  },
);

server.registerTool(
  'tiflis_visual_audit',
  {
    description: 'Open a page at a mobile or desktop preset, return a structural snapshot and a screenshot in one call.',
    inputSchema: z.object({
      url: z.string().optional(),
      preset: z.enum(['pixel-8-pro', 'small-phone', 'tablet', 'desktop']).optional().default('pixel-8-pro'),
      fullPage: z.boolean().optional().default(true),
    }),
  },
  async ({ url, preset, fullPage }) => {
    try {
      const presets = {
        'pixel-8-pro': { width: 448, height: 998, isMobile: true, hasTouch: true },
        'small-phone': { width: 360, height: 800, isMobile: true, hasTouch: true },
        tablet: { width: 768, height: 1024, isMobile: true, hasTouch: true },
        desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
      };
      const viewport = presets[preset];
      const currentPage = await ensurePage(viewport);
      await currentPage.goto(normalizeTarget(url), { waitUntil: 'domcontentloaded' });
      await currentPage.waitForTimeout(350);
      return {
        content: [
          { type: 'text', text: await pageSummary(currentPage) },
          await screenshotContent(currentPage, { fullPage }),
        ],
      };
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'tiflis_save_session',
  {
    description: 'Save the current browser cookies and local storage to TIFLIS_STORAGE_STATE for later authenticated sessions.',
    inputSchema: z.object({}),
  },
  async () => {
    try {
      if (!storageStatePath) {
        throw new Error('Set TIFLIS_STORAGE_STATE to a writable JSON path before saving a session.');
      }
      const currentPage = await ensurePage();
      await currentPage.context().storageState({ path: storageStatePath });
      return okText(`Session state saved to ${storageStatePath}. Keep this file private.`);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  'tiflis_close',
  {
    description: 'Close the browser and clear the current visual session.',
    inputSchema: z.object({}),
  },
  async () => {
    try {
      await context?.close();
      await browser?.close();
      browser = null;
      context = null;
      page = null;
      contextProfileKey = null;
      consoleLogs.length = 0;
      return okText('Browser session closed.');
    } catch (error) {
      return errorResult(error);
    }
  },
);

async function shutdown() {
  try {
    await context?.close();
    await browser?.close();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`${SERVER_NAME} ${SERVER_VERSION} is ready.`);
