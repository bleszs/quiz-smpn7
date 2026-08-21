const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { io: createClient } = require('socket.io-client');
const { createQuizServer } = require('../server');

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForDebugger(port, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages = await response.json();
      const page = pages.find((target) => target.type === 'page' && target.url === 'about:blank')
        || pages.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome masih memulai.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Chrome DevTools tidak siap sebelum batas waktu.');
}

function openCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  return {
    ready: new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    }),
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitForExpression(cdp, expression, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const diagnostic = await evaluate(cdp, `({
    url: location.href,
    readyState: document.readyState,
    title: document.title,
    body: document.body?.innerText?.slice(0, 180),
    roomCode: document.querySelector('#roomCodeInput')?.value,
    playerName: document.querySelector('#playerNameInput')?.value,
    playerClass: document.querySelector('#playerClassInput')?.value,
    joinError: document.querySelector('#joinError')?.textContent,
    joinErrorHidden: document.querySelector('#joinError')?.classList.contains('hidden')
  })`);
  throw new Error(`Kondisi browser tidak terpenuhi: ${expression}; ${JSON.stringify(diagnostic)}`);
}

test('sentuhan pointer mobile dapat memilih dan mengirim jawaban', {
  timeout: 25_000,
  skip: chromePath ? false : 'Chrome/Chromium tidak ditemukan'
}, async (t) => {
  const quiz = createQuizServer({ questionDurationMs: 4_000, revealDurationMs: 100 });
  await quiz.ready;
  await new Promise((resolve) => quiz.httpServer.listen(0, '127.0.0.1', resolve));
  const appUrl = `http://127.0.0.1:${quiz.httpServer.address().port}`;
  const host = createClient(appUrl, { transports: ['websocket'], forceNew: true });
  await once(host, 'connect');
  const created = await emitAck(host, 'host:create', { hostName: 'Host Mobile Browser' });
  assert.equal(created.ok, true);

  const debugPort = await freePort();
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'quiz-mobile-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDirectory}`,
    'about:blank'
  ], { stdio: 'ignore' });
  let cdp;

  t.after(async () => {
    cdp?.close();
    const chromeExited = chrome.exitCode === null
      ? new Promise((resolve) => chrome.once('exit', resolve))
      : Promise.resolve();
    chrome.kill();
    await Promise.race([chromeExited, new Promise((resolve) => setTimeout(resolve, 2_000))]);
    host.disconnect();
    await quiz.close();
    const safeRoot = `${path.resolve(os.tmpdir())}${path.sep}`;
    const resolvedProfile = path.resolve(profileDirectory);
    if (resolvedProfile.startsWith(safeRoot) && path.basename(resolvedProfile).startsWith('quiz-mobile-chrome-')) {
      await fs.promises.rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    }
  });

  cdp = openCdp(await waitForDebugger(debugPort));
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cdp.send('Page.navigate', { url: `${appUrl}/?room=${created.code}` });
  await waitForExpression(cdp, "document.readyState === 'complete' && document.querySelector('#joinForm:not(.hidden)')");
  await waitForExpression(cdp, "document.querySelector('#connectionStatus')?.dataset.state === 'online'");

  await evaluate(cdp, `(() => {
    document.querySelector('#playerNameInput').value = 'Uji Sentuh Mobile';
    document.querySelector('#playerClassInput').value = 'VIII-A';
    document.querySelector('#joinForm button[type="submit"]').click();
    return true;
  })()`);
  await waitForExpression(cdp, "!document.querySelector('#playerLobbyScreen').classList.contains('hidden')");

  const answerReceived = new Promise((resolve) => {
    host.on('room:progress', (payload) => {
      if (payload.answeredCount === 1) resolve(payload);
    });
  });
  const started = await emitAck(host, 'host:start', { code: created.code });
  assert.equal(started.ok, true);
  await waitForExpression(cdp, "document.querySelector('.answer-button:not(:disabled)')");

  const tapResult = await evaluate(cdp, `(() => {
    const button = document.querySelector('.answer-button:not(:disabled)');
    button.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      isPrimary: true
    }));
    return {
      selected: button.dataset.selected,
      disabled: button.disabled,
      status: document.querySelector('#answerStatus').textContent
    };
  })()`);

  await Promise.race([
    answerReceived,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Server tidak menerima jawaban sentuh.')), 3_000))
  ]);
  assert.equal(tapResult.selected, 'true');
  assert.equal(tapResult.disabled, true);
  assert.match(tapResult.status, /Jawaban terkirim/);
});
