import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEBUG_PORT = process.env.ELECTRON_REMOTE_DEBUG_PORT || '9222';
const TIMEOUT_MS = 30000;

async function runSmokeTest() {
  console.log(`[Smoke Test] Launching Electron with remote debugging on port ${DEBUG_PORT}...`);

  const electronArgs = [
    '.',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
  ];

  const electronProcess = spawn('npx', ['electron', ...electronArgs], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  electronProcess.stdout.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Unable to load preload script')) {
      console.error('[Electron STDOUT Error]', text.trim());
    }
  });

  electronProcess.stderr.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Unable to load preload script')) {
      console.error('[Electron STDERR Error]', text.trim());
    }
  });

  const cleanup = () => {
    if (!electronProcess.killed) {
      try {
        electronProcess.kill('SIGINT');
        setTimeout(() => {
          if (!electronProcess.killed) {
            electronProcess.kill('SIGKILL');
          }
        }, 1500).unref();
      } catch {}
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    const startTime = Date.now();
    let mainTarget = null;

    console.log('[Smoke Test] Waiting for Chrome DevTools endpoint...');
    while (Date.now() - startTime < TIMEOUT_MS) {
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
        if (res.ok) {
          const targets = await res.json();
          mainTarget = targets.find(
            (t) =>
              t.type === 'page' &&
              t.webSocketDebuggerUrl &&
              (t.url.includes('index.html') || (!t.url.includes('splash.html') && t.title))
          );
          if (mainTarget) {
            break;
          }
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!mainTarget) {
      throw new Error(`Timeout waiting for main window target at http://127.0.0.1:${DEBUG_PORT}/json`);
    }

    console.log(`[Smoke Test] Found main window target: ${mainTarget.url}`);
    console.log(`[Smoke Test] Connecting to CDP WebSocket: ${mainTarget.webSocketDebuggerUrl}`);

    const ws = new WebSocket(mainTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = (err) => reject(new Error(`WebSocket connection failed: ${err.message || err}`));
    });

    let idSeq = 1;
    function evaluateInPage(expression) {
      return new Promise((resolve, reject) => {
        const id = idSeq++;
        const onMessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.id === id) {
              ws.removeEventListener('message', onMessage);
              if (data.error) {
                reject(new Error(`CDP Error: ${JSON.stringify(data.error)}`));
              } else if (data.result?.exceptionDetails) {
                reject(
                  new Error(
                    `Evaluation Exception: ${data.result.exceptionDetails.text} (${JSON.stringify(
                      data.result.exceptionDetails.exception || data.result.exceptionDetails
                    )})`
                  )
                );
              } else {
                resolve(data.result?.result?.value);
              }
            }
          } catch (e) {
            reject(e);
          }
        };
        ws.addEventListener('message', onMessage);
        ws.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: {
              expression,
              awaitPromise: true,
              returnByValue: true,
            },
          })
        );
      });
    }

    // Wait until document and window.electronAPI exist or timeout
    console.log('[Smoke Test] Verifying typeof window.electronAPI === "object"...');
    let electronApiType = 'undefined';
    const evalStart = Date.now();
    while (Date.now() - evalStart < 15000) {
      electronApiType = await evaluateInPage('typeof window.electronAPI');
      if (electronApiType === 'object') {
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (electronApiType !== 'object') {
      throw new Error(
        `Preload verification failed: expected typeof window.electronAPI === 'object', but got '${electronApiType}'`
      );
    }
    console.log('[Smoke Test] Verified: typeof window.electronAPI === "object"');

    // Starting and connecting to the loopback server
    console.log('[Smoke Test] Starting embedded OPC UA loopback server and connecting...');
    const loopbackResult = await evaluateInPage(`(async () => {
      if (!window.electronAPI || !window.electronAPI.opcua) {
        throw new Error('window.electronAPI.opcua is not defined');
      }

      const startRes = await window.electronAPI.opcua.startLocalServer(4840);
      if (!startRes || !startRes.success || !startRes.endpointUrl) {
        throw new Error('opcua.startLocalServer failed: ' + (startRes?.error || JSON.stringify(startRes)));
      }

      const connectRes = await window.electronAPI.opcua.connect({
        endpointUrl: startRes.endpointUrl,
        securityMode: 'None',
        securityPolicy: 'None',
        authMode: 'Username',
        username: 'admin',
        password: 'admin',
      });

      if (!connectRes || !connectRes.success) {
        throw new Error('opcua.connect failed: ' + (connectRes?.error || JSON.stringify(connectRes)));
      }

      // Verify status confirms connection to loopback server
      const status = await window.electronAPI.opcua.getStatus();
      if (!status.connected || !status.serverRunning) {
        throw new Error('opcua status verification failed: ' + JSON.stringify(status));
      }

      // Disconnect and shut down server cleanly
      await window.electronAPI.opcua.disconnect();
      await window.electronAPI.opcua.stopLocalServer();

      return {
        success: true,
        endpointUrl: startRes.endpointUrl,
        status,
      };
    })()`);

    console.log('[Smoke Test] Loopback connection verified successfully:', loopbackResult);
    console.log('[Smoke Test] ALL SMOKE CHECKS PASSED SUCCESSFULLY!');
    ws.close();
  } finally {
    cleanup();
  }
}

runSmokeTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Smoke Test FAILED]', err);
    process.exit(1);
  });
