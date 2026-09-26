/**
 * Visual diff of real pages against the design images in .design-refs/ (gitignored).
 *
 *   npm run visual-diff                 # every scenario
 *   npm run visual-diff -- login        # scenarios whose name contains "login"
 *   npm run visual-diff -- --tag=r1     # suffix output files (keep one set per round)
 *
 * Starts a Vite dev server with MSW (VITE_MOCKS_INCLUDE=auth), opens each scenario in Chromium at
 * a fixed viewport and language, and writes to .design-refs/_diff/:
 *   <name>.actual.png, and for scenarios with a design image <name>.diff.png (pixelmatch) plus the
 *   share of differing pixels, overall and per named region of the design.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REFS = path.join(ROOT, '.design-refs');
const OUT = path.join(REFS, '_diff');
const B01 = path.join(REFS, 'Inter1', 'B01_onboarding-auth');
const PORT = 5199;

interface Region {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Scenario {
  name: string;
  path: string;
  language: 'vi' | 'en';
  viewport: { width: number; height: number };
  /** Design image to compare with; screenshot only when absent. */
  design?: string;
  /** Named areas of the design, reported separately. */
  regions?: Region[];
  prepare?: (page: Page) => Promise<void>;
}

const PANEL_REGIONS: Region[] = [
  { name: 'panel: logo', x: 0, y: 30, w: 684, h: 60 },
  { name: 'panel: hero', x: 0, y: 180, w: 684, h: 160 },
  { name: 'panel: card', x: 0, y: 385, w: 684, h: 410 },
  { name: 'panel: tagline', x: 0, y: 950, w: 684, h: 40 },
];

const LOGIN_REGIONS: Region[] = [
  ...PANEL_REGIONS,
  { name: 'form: back link', x: 684, y: 40, w: 756, h: 36 },
  { name: 'form: heading', x: 684, y: 145, w: 756, h: 85 },
  { name: 'form: email field', x: 684, y: 280, w: 756, h: 95 },
  { name: 'form: password field', x: 684, y: 395, w: 756, h: 95 },
  { name: 'form: sign-in button', x: 684, y: 510, w: 756, h: 70 },
  { name: 'form: divider + Google', x: 684, y: 600, w: 756, h: 110 },
  { name: 'form: Google note', x: 684, y: 715, w: 756, h: 55 },
  { name: 'form: footer', x: 684, y: 900, w: 756, h: 124 },
];

// Same design shifted down by the alert (the alert pushes the fields 67px lower)
const INVALID_REGIONS: Region[] = [
  ...PANEL_REGIONS,
  { name: 'form: back link', x: 684, y: 40, w: 756, h: 36 },
  { name: 'form: heading', x: 684, y: 145, w: 756, h: 85 },
  { name: 'form: alert', x: 684, y: 240, w: 756, h: 95 },
  { name: 'form: email field', x: 684, y: 347, w: 756, h: 95 },
  { name: 'form: password field', x: 684, y: 462, w: 756, h: 95 },
  { name: 'form: sign-in button', x: 684, y: 577, w: 756, h: 70 },
  { name: 'form: divider + Google', x: 684, y: 667, w: 756, h: 110 },
  { name: 'form: Google note', x: 684, y: 782, w: 756, h: 55 },
  { name: 'form: footer', x: 684, y: 900, w: 756, h: 124 },
];

const DESKTOP = { width: 1440, height: 1024 };

const submitWrongPassword = async (page: Page) => {
  await page.locator('input[autocomplete="username"]').fill('alex.morgan@acme.example');
  await page.locator('input[autocomplete="current-password"]').fill('wrongpass1');
  await page.locator('form button[type="submit"]').click();
  await page.getByRole('alert').waitFor();
};

const SCENARIOS: Scenario[] = [
  {
    name: 'login-en-1440',
    path: '/login',
    language: 'en',
    viewport: DESKTOP,
    design: path.join(B01, 'UC05_GUEST_Sign_In.png'),
    regions: LOGIN_REGIONS,
  },
  {
    name: 'login-invalid-en-1440',
    path: '/login',
    language: 'en',
    viewport: DESKTOP,
    design: path.join(B01, 'UC05_GUEST_Sign_In_Invalid_Credentials.png'),
    regions: INVALID_REGIONS,
    prepare: submitWrongPassword,
  },
  { name: 'login-vi-1440', path: '/login', language: 'vi', viewport: DESKTOP },
  {
    name: 'login-invalid-vi-1440',
    path: '/login',
    language: 'vi',
    viewport: DESKTOP,
    prepare: submitWrongPassword,
  },
  { name: 'login-vi-768', path: '/login', language: 'vi', viewport: { width: 768, height: 1024 } },
  { name: 'login-vi-390', path: '/login', language: 'vi', viewport: { width: 390, height: 844 } },
];

const percent = (part: number, total: number) => `${((part / total) * 100).toFixed(2)}%`;

const compare = (scenario: Scenario, actualPng: Buffer, tag: string) => {
  const expected = PNG.sync.read(fs.readFileSync(scenario.design!));
  const actual = PNG.sync.read(actualPng);
  const { width, height } = expected;
  if (actual.width !== width || actual.height !== height) {
    throw new Error(
      `${scenario.name}: size ${actual.width}×${actual.height} ≠ design ${width}×${height}`
    );
  }
  const diff = new PNG({ width, height });
  // threshold 0.1 = pixelmatch default; anti-aliased pixels are detected and not counted
  const changed = pixelmatch(expected.data, actual.data, diff.data, width, height, {
    threshold: 0.1,
  });
  fs.writeFileSync(path.join(OUT, `${scenario.name}${tag}.diff.png`), PNG.sync.write(diff));

  console.log(`\n${scenario.name}: ${percent(changed, width * height)} pixels differ`);
  console.log(`  ${'region'.padEnd(26)} ${'diff'.padStart(7)}  ${'best ±1px'.padStart(9)}`);
  for (const region of scenario.regions ?? []) {
    const count = diffInRegion(expected, actual, region, 0, 0);
    // A region that matches much better when moved by 1px is misplaced, not just rendered differently
    let best = count;
    let shift = '';
    for (const [dx, dy] of NEIGHBOURS) {
      const shifted = diffInRegion(expected, actual, region, dx, dy);
      if (shifted < best) {
        best = shifted;
        shift = `actual is ${dx ? `${dx > 0 ? 'right' : 'left'} ` : ''}${dy ? (dy > 0 ? 'down' : 'up') : ''}`;
      }
    }
    const area = region.w * region.h;
    console.log(
      `  ${region.name.padEnd(26)} ${percent(count, area).padStart(7)}  ${percent(best, area).padStart(9)}  ${shift}`
    );
  }
};

const NEIGHBOURS = [-1, 0, 1].flatMap((dx) =>
  [-1, 0, 1].filter((dy) => dx !== 0 || dy !== 0).map((dy) => [dx, dy] as const)
);

/**
 * Differing pixels of a region (inset by 1px, so a 1px shift stays inside the image), with the
 * actual screenshot shifted by (dx, dy).
 */
const diffInRegion = (expected: PNG, actual: PNG, region: Region, dx: number, dy: number) => {
  const w = region.w - 2;
  const h = region.h - 2;
  const crop = (img: PNG, ox: number, oy: number) => {
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(img, out, region.x + 1 + ox, region.y + 1 + oy, w, h, 0, 0);
    return out.data;
  };
  return pixelmatch(crop(expected, 0, 0), crop(actual, dx, dy), undefined, w, h, {
    threshold: 0.1,
  });
};

const main = async () => {
  const args = process.argv.slice(2);
  const tag = args.find((a) => a.startsWith('--tag='))?.slice('--tag='.length);
  const filters = args.filter((a) => !a.startsWith('--'));
  const suffix = tag ? `.${tag}` : '';
  const scenarios = SCENARIOS.filter(
    (s) => filters.length === 0 || filters.some((f) => s.name.includes(f))
  );

  fs.mkdirSync(OUT, { recursive: true });
  process.env.VITE_USE_MOCKS = 'true';
  process.env.VITE_MOCKS_INCLUDE = 'auth';

  const server = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: PORT, strictPort: true, host: '127.0.0.1' },
  });
  await server.listen();
  // Grayscale anti-aliasing like the design exports (Windows Chromium defaults to LCD subpixel)
  const browser = await chromium.launch({ args: ['--disable-lcd-text'] });

  try {
    for (const scenario of scenarios) {
      const context = await browser.newContext({
        viewport: scenario.viewport,
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
      });
      await context.addInitScript((language) => {
        localStorage.setItem('learnup.language', language);
      }, scenario.language);
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}${scenario.path}`, { waitUntil: 'networkidle' });
      await page.locator('main h1').waitFor();
      await scenario.prepare?.(page);
      // The design shows the idle page: no focused control, no caret
      await page.evaluate(async () => {
        (document.activeElement as HTMLElement | null)?.blur();
        await document.fonts.ready;
      });
      await page.mouse.move(0, 0);

      const png = await page.screenshot({ fullPage: false });
      fs.writeFileSync(path.join(OUT, `${scenario.name}${suffix}.actual.png`), png);
      if (scenario.design) compare(scenario, png, suffix);
      else console.log(`\n${scenario.name}: screenshot only`);
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`\nOutput: ${path.relative(ROOT, OUT)}`);
};

await main();
