// Run after npm run build: node tests/hub-library.browser.mjs
// Exercises the real production UI; only auth and hub persistence are stubbed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve, extname, sep } from 'node:path';

register('./typescript-loader.mjs', import.meta.url);
const { PREDEFINED_HUB_TEMPLATES: templates } = await import('../src/app/shared/templates/predefined-hub-templates.ts');
const root = resolve('dist/browser');
const output = resolve('../../tmp-visual-qa/hub-library');
const profile = await mkdtemp(resolve(tmpdir(), 'hub-library-chrome-'));
await mkdir(output, { recursive: true });
const hubs = templates.slice(0, 3).map((template, i) => ({
  _id: `qa-hub-${i}`, hubName: template.name, layout: template.createLayout(),
}));
const server = createServer(async (req, res) => {
  let file = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end();
  if (!extname(file)) file = resolve(root, 'index.html');
  try {
    const bytes = await readFile(file);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = spawn(process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(done => setTimeout(done, ms));
const exceptions = [];
const report = { templates: [], viewports: [], savedViewports: [], creation: {}, exceptions };
let socket;
let createAttempts = 0;
let created;
let failCreation = true;
let releaseCreation;

try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await delay(100); }
  }
  assert(port, 'Chrome debugging port available');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.onopen = done; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((done, reject) => {
    const id = ++sequence;
    pending.set(id, { done, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  socket.onmessage = async ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) handler?.reject(new Error(JSON.stringify(message.error)));
      else handler?.done(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails);
    } else if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      let body = [];
      let responseCode = 200;
      if (request.url.endsWith('/auth/me')) body = { _id: 'qa-user', email: 'qa@example.test', name: 'QA' };
      else if (request.url.endsWith('/hub/mine')) body = hubs;
      else if (request.method === 'POST') {
        createAttempts++;
        created = JSON.parse(request.postData);
        responseCode = failCreation ? 503 : 200;
        body = failCreation ? { message: 'Temporary failure' } : { _id: 'qa-created', ...created };
        // Hold the successful request until the test observes the pending state.
        // A fixed delay races with screenshots/CDP work on a busy GPU machine.
        if (!failCreation) await new Promise(done => { releaseCreation = done; });
      }
      await send('Fetch.fulfillRequest', { requestId, responseCode, responseHeaders: [
        { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, OPTIONS' },
        { name: 'Access-Control-Allow-Headers', value: 'content-type' },
      ], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    }
  };
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };
  const click = async selector => {
    const point = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.top < 0 || r.bottom > innerHeight + 1 || r.left < 0 || r.right > innerWidth + 1) {
        throw Error('Control must be visible without scrolling: ' + ${JSON.stringify(selector)});
      }
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  const screenshot = async name => {
    await evaluate('window.scrollTo(0, 0)');
    await delay(200);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(output, name), Buffer.from(shot.data, 'base64'));
  };
  const resize = async (width, height) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await delay(200);
  };
  const assertViewportFits = async label => {
    const bounds = await evaluate(`(() => {
      const selectors = '.hub-topbar, .scene-header, .library-tabs, .template-browser-heading, .template-mobile-picker, .template-card, .template-spotlight, .template-details, .template-copy h3, .template-copy p, .template-features, .template-use-button, .template-error, .hub-preview-panel, .hub-information, .hub-actions, .hub-picker, .empty-state';
      const outside = [...document.querySelectorAll(selectors)].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1);
      }).map(el => ({ class: el.className, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom }));
      return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight, scrollX, scrollY, outside };
    })()`);
    assert(bounds.pageWidth <= bounds.width, `${label}: no horizontal page scrolling`);
    assert(bounds.pageHeight <= bounds.height, `${label}: no vertical page scrolling`);
    assert.equal(bounds.scrollY, 0, `${label}: selection does not scroll the page`);
    assert.deepEqual(bounds.outside, [], `${label}: content is fully visible, not clipped`);
    return bounds;
  };
  const previewMetrics = selector => evaluate(`(() => {
    const preview = document.querySelector(${JSON.stringify(selector)});
    const shell = preview.querySelector('.hub-preview-shell').getBoundingClientRect();
    const canvas = preview.querySelector('.broadcast-preview');
    const parent = preview.parentElement.getBoundingClientRect();
    const surface = canvas.getBoundingClientRect();
    const scale = surface.width / 1920;
    const text = [...preview.querySelectorAll('.text-layer, .team-kills, .roster-name, .roster-stat, .roster-kda')].map(el => ({
      value: el.textContent.trim(), fontSize: parseFloat(getComputedStyle(el).fontSize),
      nativeHeight: el.getBoundingClientRect().height / scale,
      clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
      clipped: el.scrollWidth > el.clientWidth + 1,
    }));
    return { width: shell.width, height: shell.height, surfaceWidth: surface.width, surfaceHeight: surface.height,
      fitsParent: shell.left >= parent.left - 1 && shell.right <= parent.right + 1 && shell.top >= parent.top - 1 && shell.bottom <= parent.bottom + 1,
      nativeWidth: parseFloat(getComputedStyle(canvas).width), scale, text };
  })()`);
  const assertPreview = metrics => {
    assert.equal(metrics.nativeWidth, 1920, 'Preview uses native broadcast dimensions');
    assert(metrics.scale > 0, 'Preview is visible: ' + JSON.stringify(metrics));
    assert(metrics.fitsParent, 'Entire preview fits its available space without clipping');
    assert(Math.abs(metrics.width / metrics.height - 16 / 9) < 0.01, 'Preview keeps 16:9');
    assert(Math.abs(metrics.surfaceWidth - metrics.width) < 1, 'Entire canvas fits preview width');
    assert(Math.abs(metrics.surfaceHeight - metrics.height) < 1, 'Entire canvas fits preview height');
    const clipped = metrics.text.filter(text => text.clipped);
    assert.equal(clipped.length, 0, 'Preview text fits its layers: ' + JSON.stringify(clipped));
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await resize(1600, 900);
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://api.your-production-domain.com/*' }] });
  await send('Page.navigate', { url: `${origin}/hubs` });
  await waitFor(`document.querySelectorAll('.template-card').length === 7 && document.querySelector('.template-featured-preview .broadcast-preview')?.getBoundingClientRect().width > 0`);
  await evaluate('document.fonts.ready');
  await screenshot('initial.png');
  const baseline = new Map();
  for (let i = 0; i < templates.length; i++) {
    await click(`.template-card:nth-child(${i + 1})`);
    await delay(550);
    await waitFor(`document.querySelector('.template-copy h3')?.textContent === ${JSON.stringify(templates[i].name)}`);
    const featured = await previewMetrics('.template-featured-preview app-hub-preview');
    const thumbnail = await previewMetrics(`.template-card:nth-child(${i + 1}) app-hub-preview`);
    assertPreview(featured);
    assertPreview(thumbnail);
    await assertViewportFits(templates[i].name);
    assert.equal(await evaluate(`document.querySelectorAll('.template-card[aria-pressed="true"]').length`), 1);
    assert.equal(createAttempts, 0, 'Browsing does not create a hub');
    for (let index = 0; index < featured.text.length; index++) {
      assert.equal(thumbnail.text[index].fontSize, featured.text[index].fontSize, 'Thumbnail typography matches large preview');
      assert(Math.abs(thumbnail.text[index].nativeHeight - featured.text[index].nativeHeight) < 0.1, 'Text scales proportionally');
    }
    baseline.set(templates[i].id, featured.text);
    report.templates.push({ name: templates[i].name, featuredWidth: featured.width, thumbnailWidth: thumbnail.width, textElements: featured.text.length });
  }
  await click('.template-card:first-child');
  await screenshot('desktop.png');

  const viewports = [[1611, 768], [1280, 720], [1366, 600], [1024, 768], [768, 1024], [390, 844], [375, 667], [320, 740], [844, 390]];
  for (const [width, height] of viewports) {
    await resize(width, height);
    await assertViewportFits(`Templates at ${width} × ${height}`);
    const bounds = await evaluate(`(() => {
      const list = document.querySelector('.template-list').getBoundingClientRect();
      return { viewport: innerWidth, page: document.documentElement.scrollWidth,
        clippedCards: [...document.querySelectorAll('.template-card')].filter(el => { const r = el.getBoundingClientRect(); return r.left < list.left - 1 || r.right > list.right + 1; }).length,
        clippedCopy: [...document.querySelectorAll('.template-copy h3, .template-copy p, .template-use-button')].filter(el => el.scrollWidth > el.clientWidth + 1).length };
    })()`);
    assert(bounds.page <= bounds.viewport, `No horizontal page overflow at ${width}px`);
    assert.equal(bounds.clippedCards, 0, `All template cards fit at ${width}px`);
    assert.equal(bounds.clippedCopy, 0, `Template description and action fit at ${width}px`);
    const metrics = await previewMetrics('.template-featured-preview app-hub-preview');
    assertPreview(metrics);
    const original = baseline.get(templates[0].id);
    metrics.text.forEach((text, i) => {
      assert.equal(text.fontSize, original[i].fontSize, 'Native text sizes survive viewport resize');
      assert(Math.abs(text.nativeHeight - original[i].nativeHeight) < 0.1, 'Rendered text scales after resize');
    });
    report.viewports.push({ width, height, ...bounds, previewWidth: metrics.width });
    if (width === 1611 || width === 390) await screenshot(`${width === 390 ? 'mobile' : 'short-desktop'}.png`);
  }

  await resize(1600, 900);
  await click('.library-tab:first-child');
  await waitFor(`!!document.querySelector('.hub-preview-panel .broadcast-preview')`);
  for (let i = 0; i < hubs.length; i++) {
    await click(`.hub-picker-dot:nth-child(${i + 1})`);
    await delay(550);
    assert.equal(await evaluate(`document.querySelector('.selected-hub-heading h2').textContent`), hubs[i].hubName);
    assertPreview(await previewMetrics('.hub-preview-frame app-hub-preview'));
    await assertViewportFits(`Saved hub ${i + 1}`);
  }
  await screenshot('saved-hubs.png');
  for (const [width, height] of viewports) {
    await resize(width, height);
    await assertViewportFits(`Saved hubs at ${width} × ${height}`);
    const metrics = await previewMetrics('.hub-preview-frame app-hub-preview');
    report.savedViewports.push({ width, height, previewWidth: metrics.width });
    if (!metrics.scale) await screenshot('saved-hubs-layout-failure.png');
    assertPreview(metrics);
  }
  await resize(390, 844);
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Saved hubs fit on mobile');
  assertPreview(await previewMetrics('.hub-preview-frame app-hub-preview'));
  await screenshot('saved-hubs-mobile.png');
  await click('.library-tab:nth-child(2)');
  await evaluate(`(() => { const picker = document.querySelector('.template-mobile-picker select'); picker.value = 'atelier-broadcast'; picker.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(`document.querySelector('.template-copy h3')?.textContent === 'Atelier'`);
  assert.equal(await evaluate(`document.querySelector('.template-card[aria-pressed="true"]').getAttribute('aria-label')`), 'Preview Atelier', 'Mobile dropdown keeps the gallery selection in sync');
  await evaluate(`(() => { const picker = document.querySelector('.template-mobile-picker select'); picker.value = 'foundry-broadcast'; picker.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(`document.querySelector('.template-copy h3')?.textContent === 'Foundry'`);
  await click('.template-use-button');
  await waitFor(`!!document.querySelector('.template-error')`);
  await assertViewportFits('Template creation error');
  assert.equal(createAttempts, 1);
  assert.equal(await evaluate(`document.querySelector('.template-use-button').disabled`), false, 'Can retry after a failed request');
  failCreation = false;
  await click('.template-use-button');
  await waitFor(`document.querySelector('.template-use-button')?.disabled`);
  await evaluate(`document.querySelector('.template-use-button').click()`);
  assert.equal(createAttempts, 2, 'Pending creation cannot be submitted twice');
  releaseCreation();
  await waitFor(`!!document.querySelector('.canvas-base .scorebug')`);
  assert.equal(createAttempts, 2, 'Pending creation cannot be submitted twice');
  assert.equal(created.hubName, 'Foundry');
  assert.equal(created.layout.templateId, 'foundry-broadcast');
  assert.equal(await evaluate('location.pathname'), '/editor');
  report.creation = { attempts: createAttempts, template: created.layout.templateId, editorOpened: true };
  assert.deepEqual(exceptions, [], 'No browser runtime exceptions');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  socket?.close();
  browser.kill();
  await new Promise(done => server.close(done));
  await delay(350);
  // Only remove the unique temporary Chrome profile created by this script.
  if (profile.startsWith(resolve(tmpdir(), 'hub-library-chrome-'))) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
  }
}
