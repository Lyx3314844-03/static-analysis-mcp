import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function request(child, payload, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Timed out waiting for tools/list response.\nSTDERR:\n${stderr}`));
    }, timeoutMs);

    const maybeResolve = () => {
      const lines = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          if (message.id === payload.id) {
            clearTimeout(timer);
            resolved = true;
            resolve(message);
            return;
          }
        } catch {
          // Wait for complete JSON messages.
        }
      }
    };

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      maybeResolve();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('exit', code => {
      if (!resolved && code !== null && code !== 0) {
        clearTimeout(timer);
        reject(new Error(`Process exited before response: ${code}\nSTDERR:\n${stderr}`));
      }
    });

    child.stdin.write(`${JSON.stringify(payload)}\n`);
  });
}

async function createClient() {
  const child = spawn('node', ['src/index.js'], {
    cwd: PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  await request(child, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    },
  });

  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  })}\n`);

  return child;
}

async function closeClient(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  try {
    child.stdin.end();
  } catch {}

  child.kill('SIGKILL');
  await Promise.race([
    once(child, 'exit'),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]);
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on('error', reject);
  });
}

async function waitForHttpServer(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}) });
      if (response.status >= 400) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for HTTP server at ${url}`);
}

test('static-analysis-mcp exposes project-level analysis tools', async () => {
  const child = await createClient();
  try {
    const response = await request(child, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    const toolNames = response.result.tools.map(tool => tool.name);

    assert.ok(toolNames.includes('analyze_project'));
    assert.ok(toolNames.includes('check_code_quality'));
    assert.ok(toolNames.includes('verify_installation'));
    assert.ok(toolNames.includes('analyze_security_comprehensive'));
  } finally {
    await closeClient(child);
  }
});

test('analyze_project tool returns findings and recommendations', async () => {
  const projectDir = await mkdtemp(path.join(os.tmpdir(), 'static-analysis-tool-call-'));

  try {
    await mkdir(path.join(projectDir, 'src'), { recursive: true });
    await writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'tool-call-project',
      dependencies: {
        lodash: '^4.17.0',
      },
    }));
    await writeFile(path.join(projectDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
      },
      include: ['src/**/*'],
    }));
    await writeFile(path.join(projectDir, 'src', 'bad.ts'), `
      export function broken(value: number): number {
        console.log(value);
        return "oops";
      }
    `);

    const child = await createClient();
    try {
      const response = await request(child, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'analyze_project',
          arguments: {
            projectPath: projectDir,
            maxFiles: 20,
          },
        },
      }, 30000);

      const payload = JSON.parse(response.result.content[0].text);
      assert.ok(payload.filesAnalyzed >= 1);
      assert.ok(payload.summary.totalIssues > 0);
      assert.ok(payload.topFindings.length > 0);
      assert.ok(payload.recommendations.length > 0);
      assert.ok(typeof payload.scores.qualityScore === 'number');
      assert.ok(payload.qualityGate.status === 'fail' || payload.qualityGate.status === 'warn');
      assert.ok(payload.actionPlan.length > 0);
    } finally {
      await closeClient(child);
    }
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});

test('static-analysis-mcp supports hybrid HTTP + SSE transport mode', async () => {
  const port = await getFreePort();
  const child = spawn('node', ['src/index.js', '--transport', 'hybrid', '--port', String(port)], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  try {
    await waitForHttpServer(`http://127.0.0.1:${port}/mcp`);

    const initResponse = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });
    assert.equal(initResponse.status, 200);
    const sessionId = initResponse.headers.get('mcp-session-id');
    assert.ok(sessionId);

    const controller = new AbortController();
    const sseResponse = await fetch(`http://127.0.0.1:${port}/sse`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    assert.equal(sseResponse.status, 200);
    assert.ok((sseResponse.headers.get('content-type') || '').includes('text/event-stream'));
    controller.abort();
  } finally {
    await closeClient(child);
  }
});

test('static-analysis-mcp hides optional Python-script tools when no external tool workspace is configured', async () => {
  const child = spawn('node', ['src/index.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      STATIC_ANALYSIS_MCP_DISABLE_OPTIONAL_PYTHON_TOOLS: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  try {
    await request(child, {
      jsonrpc: '2.0',
      id: 11,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {},
    })}\n`);

    const response = await request(child, {
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/list',
      params: {},
    });

    const toolNames = response.result.tools.map(tool => tool.name);
    assert.ok(toolNames.includes('scan_project'));
    assert.ok(toolNames.includes('check_code_quality'));
    assert.ok(toolNames.includes('verify_installation'));
    assert.ok(!toolNames.includes('auto_fix'));
    assert.ok(!toolNames.includes('multi_model_fix'));
    assert.ok(!toolNames.includes('start_team_dashboard'));
  } finally {
    await closeClient(child);
  }
});
