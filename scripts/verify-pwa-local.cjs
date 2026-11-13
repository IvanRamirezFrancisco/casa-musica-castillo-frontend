// Local production-build smoke test. No external request is forwarded.
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve('dist/frontend/browser');
  const worker = 'assets/pdfjs/pdf.worker.min.mjs';
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'ngsw.json'), 'utf8'));
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(hash(path.join(root, worker)), hash(path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs')));
  assert(manifest.assetGroups.find(g => g.name === 'app-shell').urls.includes('/' + worker));
  assert(!JSON.stringify(manifest.dataGroups).includes('/api/auth'));
  const chrome = [process.env.CHROME_BIN,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(p => p && fs.existsSync(p));
  if (!chrome) throw new Error('Set CHROME_BIN to an installed Chrome/Chromium executable');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'castillo-pwa-'));
  let version = 1;
  let browser, ws;
  const checks = { workerMatchesPackage: true, workerPrecached: true, noAuthDataGroup: true };
  const proxy = http.createServer((_req, res) => { res.writeHead(502); res.end('External network blocked by local test'); });
  proxy.on('connect', (_req, socket) => { socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); });
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon' };
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (pathname === '/dependency-hardening-probe.html') { res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Security-Policy', "connect-src 'self'"); res.end('<!doctype html><title>Local SW probe</title>'); return; }
    if (pathname === '/__network_probe') { res.writeHead(200); res.end('network'); return; }
    if (file === root || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    // Test-only restriction: application/API requests cannot reach production or local backends.
    res.setHeader('Content-Security-Policy', "connect-src 'self'");
    if (pathname === '/ngsw.json' && version === 2) {
      res.end(JSON.stringify({ ...manifest, appData: { dependencyHardeningLocalProbe: 2 } }));
    } else res.end(fs.readFileSync(file));
  });
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (fn, label) => {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) { try { const value = await fn(); if (value) return value; } catch {} await pause(150); }
    throw new Error('Timeout: ' + label);
  };
  let sequence = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  try {
    await listen(proxy); await listen(server);
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--remote-debugging-port=0', '--user-data-dir=' + profile,
      '--proxy-server=http://127.0.0.1:' + proxy.address().port, '--proxy-bypass-list=127.0.0.1;localhost', 'about:blank'],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    const endpoint = await new Promise((resolve, reject) => {
      let text = '';
      const timeout = setTimeout(() => reject(new Error('Chrome startup timeout')), 15000);
      browser.on('error', reject);
      browser.stderr.on('data', data => {
        text = (text + data.toString()).slice(-32768);
        const match = text.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1]); }
      });
    });
    ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    ws.addEventListener('message', event => {
      const value = JSON.parse(event.data);
      const request = pending.get(value.id);
      if (!request) return;
      clearTimeout(request.timer); pending.delete(value.id);
      value.error ? request.reject(new Error(value.error.message)) : request.resolve(value.result);
    });
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
    await send('Page.enable', {}, session); await send('Network.enable', {}, session);
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    await send('Page.navigate', { url: origin + '/login' }, session);
    await waitFor(() => evaluate('!!document.querySelector("app-login input[type=email]")'), 'Angular login render');
    checks.angularLoginRendered = true;
    await waitFor(() => evaluate('!!navigator.serviceWorker.controller'), 'service worker controller');
    checks.serviceWorkerControlsPage = true;
    await send('Page.reload', {}, session);
    await waitFor(() => evaluate('!!document.querySelector("app-login input[type=email]") && !!navigator.serviceWorker.controller'), 'controlled reload');
    await waitFor(() => evaluate('(async()=>!!(await caches.match(' + JSON.stringify(origin + '/' + worker) + ')))()'), 'cached PDF worker');
    checks.pdfWorkerCached = true;
    checks.lazyChunksCached = await evaluate('(async()=>{for(const name of await caches.keys()){for(const request of await (await caches.open(name)).keys()){if(new URL(request.url).pathname.startsWith("/chunk-"))return true;}}return false;})()');
    assert.equal(checks.lazyChunksCached, true);
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, session);
    checks.realNetworkUnavailable = await evaluate('(async()=>{try{await fetch("/__network_probe?ngsw-bypass=true");return false;}catch{return true;}})()');
    assert.equal(checks.realNetworkUnavailable, true);
    await send('Page.navigate', { url: origin + '/login?offline-probe=1' }, session);
    await waitFor(() => evaluate('!!document.querySelector("app-login input[type=email]")'), 'offline app shell and lazy route');
    checks.offlineLoginRendered = true;
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, session);
    // Isolate protocol verification from the application update prompt/auto-activation.
    await send('Page.navigate', { url: origin + '/dependency-hardening-probe.html' }, session);
    await waitFor(() => evaluate('document.title === "Local SW probe" && !!navigator.serviceWorker.controller'), 'controlled protocol probe');
    version = 2;
    const message = action => evaluate('(async()=>new Promise((resolve,reject)=>{const nonce=Date.now();const timer=setTimeout(()=>reject(new Error("SW operation timeout")),20000);const listener=event=>{if(event.data.type==="OPERATION_COMPLETED"&&event.data.nonce===nonce){clearTimeout(timer);navigator.serviceWorker.removeEventListener("message",listener);event.data.error?reject(new Error(event.data.error)):resolve(event.data.result);}};navigator.serviceWorker.addEventListener("message",listener);navigator.serviceWorker.controller.postMessage({action:' + JSON.stringify(action) + ',nonce});}))()');
    checks.updateDetected = await message('CHECK_FOR_UPDATES');
    assert.equal(checks.updateDetected, true);
    checks.updateActivated = await message('ACTIVATE_UPDATE');
    assert.equal(checks.updateActivated, true);
    const output = { status: 'PASS', checks, externalNetwork: 'blocked by test CSP and rejecting proxy', productionModified: false };
    const reportDir = path.join(os.tmpdir(), 'castillo-dependency-hardening'); fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'pwa-final-results.json'), JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
  } finally {
    if (ws?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} ws.close(); }
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Test closed')); }
    if (browser && browser.exitCode === null) browser.kill();
    server.closeAllConnections(); server.close(); proxy.closeAllConnections(); proxy.close();
    await pause(1500);
    const resolved = path.resolve(profile), temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
    if (resolved.startsWith(temporaryRoot) && path.basename(resolved).startsWith('castillo-pwa-')) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 4, retryDelay: 500 });
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
