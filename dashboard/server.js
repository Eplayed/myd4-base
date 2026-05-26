#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const RUNTIME_DIR = path.join(__dirname, 'runtime');
const LOG_DIR = path.join(RUNTIME_DIR, 'logs');
const STATE_FILE = path.join(RUNTIME_DIR, 'state.json');
const PORT = Number(process.env.DASHBOARD_PORT || 5178);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const TASKS = [
  {
    id: 'crawl',
    name: '生成数据',
    description: '抓取 olden-era.com 结构化资料，生成当前环境 JSON。',
    command: ['node', ['crawlers/run.js']],
  },
  {
    id: 'validate',
    name: '校验输出',
    description: '检查当前环境输出文件、索引数量和重复 ID。',
    command: ['node', ['scripts/validate-output.js']],
  },
  {
    id: 'crawl_validate',
    name: '生成并校验',
    description: '先生成当前环境数据，再执行输出校验。',
    steps: ['crawl', 'validate'],
  },
];

const taskMap = Object.fromEntries(TASKS.map(task => [task.id, task]));
let currentRun = null;
let currentChild = null;
let currentStopRequested = false;

function ensureRuntime() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) writeJson(STATE_FILE, { runs: {}, history: [] });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getState() {
  ensureRuntime();
  return readJson(STATE_FILE, { runs: {}, history: [] });
}

function setTaskState(run) {
  const state = getState();
  state.runs[run.taskId] = run;
  state.history = [run, ...(state.history || []).filter(item => item.runId !== run.runId)].slice(0, 50);
  writeJson(STATE_FILE, state);
}

function getEnvironmentName(value) {
  return value === 'dev' ? 'dev' : 'release';
}

function getNodeEnv(environment) {
  return getEnvironmentName(environment) === 'dev' ? 'dev' : 'production';
}

function getDataDir(environment) {
  return path.join(ROOT, 'translated-data', getEnvironmentName(environment));
}

function relativeToRoot(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

function countFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  for (const item of fs.readdirSync(dirPath)) {
    if (item === '.DS_Store') continue;
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    count += stat.isDirectory() ? countFiles(fullPath) : 1;
  }
  return count;
}

function getFileInfo(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    path: relativeToRoot(filePath),
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function summarizeJson(filePath) {
  const info = getFileInfo(filePath);
  if (!info) return null;
  const data = readJson(filePath, null);
  const count = Array.isArray(data)
    ? data.length
    : data && Array.isArray(data.groups)
      ? data.groups.length
      : data && Array.isArray(data.files)
        ? data.files.length
        : 0;
  return { ...info, count };
}

function getDataSummary(environment) {
  const dataDir = getDataDir(environment);
  const index = readJson(path.join(dataDir, 'index.json'), null);
  const sources = readJson(path.join(dataDir, 'sources.json'), []);
  const files = Array.isArray(index && index.files) ? index.files : [];
  const sourceErrors = Array.isArray(sources) ? sources.filter(item => item.error) : [];

  return {
    environment: getEnvironmentName(environment),
    dataDir: relativeToRoot(dataDir),
    exists: fs.existsSync(dataDir),
    fileCount: countFiles(dataDir),
    updatedAt: index && index.updatedAt ? index.updatedAt : '',
    totalEntries: files.reduce((sum, item) => sum + Number(item.count || 0), 0),
    sourceErrors,
    files: files.map(item => ({
      ...item,
      info: summarizeJson(path.join(dataDir, item.file)),
    })),
    keyFiles: {
      index: summarizeJson(path.join(dataDir, 'index.json')),
      sources: summarizeJson(path.join(dataDir, 'sources.json')),
    },
  };
}

function appendLog(logFile, text) {
  fs.appendFileSync(logFile, text);
}

function createRun(taskId, environment) {
  const runId = `${Date.now()}_${taskId}_${Math.random().toString(16).slice(2, 8)}`;
  const logFile = path.join(LOG_DIR, `${runId}.log`);
  return {
    runId,
    taskId,
    taskName: taskMap[taskId] ? taskMap[taskId].name : taskId,
    environment: getEnvironmentName(environment),
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: '',
    durationMs: 0,
    exitCode: null,
    logPath: relativeToRoot(logFile),
    error: '',
  };
}

function runCommand(command, environment, logFile) {
  const [bin, args] = command;
  return new Promise((resolve, reject) => {
    if (currentStopRequested) return reject(new Error('任务已停止'));
    appendLog(logFile, `$ ${bin} ${args.join(' ')}\nNODE_ENV=${getNodeEnv(environment)}\n\n`);
    const child = spawn(bin, args, {
      cwd: ROOT,
      shell: false,
      detached: process.platform !== 'win32',
      env: { ...process.env, NODE_ENV: getNodeEnv(environment) },
    });
    currentChild = child;
    child.stdout.on('data', chunk => appendLog(logFile, chunk.toString()));
    child.stderr.on('data', chunk => appendLog(logFile, chunk.toString()));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (currentChild === child) currentChild = null;
      appendLog(logFile, `\n[exit ${code}${signal ? ` signal ${signal}` : ''}]\n`);
      if (currentStopRequested) reject(new Error('任务已停止'));
      else if (code === 0) resolve(code);
      else reject(new Error(`命令退出码 ${code}`));
    });
  });
}

async function executeRun(run) {
  const task = taskMap[run.taskId];
  const logFile = path.join(ROOT, run.logPath);
  currentStopRequested = false;

  try {
    appendLog(logFile, `# ${task.name}\n环境: ${run.environment}\n\n`);
    if (task.steps) {
      for (const stepId of task.steps) {
        const step = taskMap[stepId];
        appendLog(logFile, `\n${'='.repeat(72)}\n${step.name}\n${'='.repeat(72)}\n`);
        await runCommand(step.command, run.environment, logFile);
      }
    } else {
      await runCommand(task.command, run.environment, logFile);
    }
    run.status = 'success';
    run.exitCode = 0;
  } catch (error) {
    run.status = currentStopRequested ? 'stopped' : 'failed';
    run.exitCode = currentStopRequested ? null : 1;
    run.error = error.message;
    appendLog(logFile, `\n[error] ${error.message}\n`);
  } finally {
    run.finishedAt = new Date().toISOString();
    run.durationMs = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
    setTaskState(run);
    currentRun = null;
    currentChild = null;
    currentStopRequested = false;
  }
}

function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, text, statusCode = 200, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error('请求体过大'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON 请求体格式错误'));
      }
    });
  });
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 'Not found', 404);
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, pathname, searchParams) {
  if (req.method === 'GET' && pathname === '/api/tasks') {
    sendJson(res, { tasks: TASKS.map(({ command, ...task }) => task) });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/status') {
    const environment = searchParams.get('env') || 'release';
    sendJson(res, { currentRun, state: getState(), summary: getDataSummary(environment) });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/logs') {
    const runId = searchParams.get('runId') || '';
    const logFile = path.join(LOG_DIR, `${runId}.log`);
    if (!runId || !logFile.startsWith(LOG_DIR) || !fs.existsSync(logFile)) return sendText(res, '日志不存在', 404);
    sendText(res, fs.readFileSync(logFile, 'utf8'));
    return;
  }
  if (req.method === 'POST' && pathname === '/api/run') {
    const body = await parseBody(req);
    const taskId = String(body.taskId || '');
    const environment = getEnvironmentName(body.environment || 'release');
    if (!taskMap[taskId]) return sendJson(res, { error: `未知任务: ${taskId}` }, 400);
    if (currentRun) return sendJson(res, { error: `已有任务运行中: ${currentRun.taskName}` }, 409);
    const run = createRun(taskId, environment);
    currentRun = run;
    setTaskState(run);
    setImmediate(() => executeRun(run).catch(error => console.error('任务启动失败:', error)));
    sendJson(res, { run }, 202);
    return;
  }
  if (req.method === 'POST' && pathname === '/api/stop') {
    if (!currentRun) return sendJson(res, { error: '当前没有运行中的任务' }, 409);
    currentStopRequested = true;
    currentRun.status = 'stopping';
    currentRun.error = '正在停止任务...';
    setTaskState(currentRun);
    if (currentChild && currentChild.pid) {
      try {
        if (process.platform === 'win32') currentChild.kill('SIGTERM');
        else process.kill(-currentChild.pid, 'SIGTERM');
      } catch {
        currentChild.kill('SIGTERM');
      }
    }
    sendJson(res, { run: currentRun }, 202);
    return;
  }
  sendJson(res, { error: 'Not found' }, 404);
}

function startServer() {
  ensureRuntime();
  let activePort = PORT;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url.pathname, url.searchParams).catch(error => sendJson(res, { error: error.message }, 500));
      return;
    }
    serveStatic(req, res, url.pathname);
  });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE' && !process.env.DASHBOARD_PORT && activePort < PORT + 10) {
      activePort += 1;
      server.listen(activePort);
      return;
    }
    console.error('控制台启动失败:', error.message);
    process.exit(1);
  });

  server.listen(activePort, () => {
    const address = server.address();
    const port = address && address.port ? address.port : activePort;
    console.log(`\nOlden Era 数据控制台已启动: http://localhost:${port}`);
    console.log('按 Ctrl+C 停止服务\n');
  });
}

startServer();
