const state = {
  env: 'release',
  tasks: [],
  status: null,
  activeRunId: '',
};

const taskGrid = document.querySelector('#taskGrid');
const summaryEl = document.querySelector('#summary');
const fileRows = document.querySelector('#fileRows');
const sourceAlerts = document.querySelector('#sourceAlerts');
const logOutput = document.querySelector('#logOutput');
const logTitle = document.querySelector('#logTitle');
const refreshBtn = document.querySelector('#refreshBtn');
const stopBtn = document.querySelector('#stopBtn');

function formatTime(value) {
  if (!value) return '无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '无记录';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms) {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusText(run) {
  if (!run) return '未运行';
  if (run.status === 'success') return '成功';
  if (run.status === 'failed') return '失败';
  if (run.status === 'running') return '运行中';
  if (run.status === 'stopping') return '停止中';
  if (run.status === 'stopped') return '已停止';
  return run.status || '未知';
}

function statusClass(run) {
  return run ? `status-${run.status}` : '';
}

async function requestJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `请求失败: ${res.status}`);
  return data;
}

function renderSummary(summary) {
  const cards = [
    { label: '环境', value: summary.environment, note: summary.exists ? summary.dataDir : '数据目录不存在' },
    { label: '输出文件', value: summary.fileCount, note: 'translated-data 文件数量' },
    { label: '资料条目', value: summary.totalEntries, note: '索引内总条目数' },
    { label: '来源异常', value: summary.sourceErrors.length, note: summary.sourceErrors.length ? '需要人工确认' : '来源结构正常' },
    { label: '更新时间', value: summary.updatedAt ? formatTime(summary.updatedAt) : '无', note: 'index.json generatedAt' },
  ];

  summaryEl.innerHTML = cards
    .map(card => `
      <article class="stat-card">
        <span class="stat-label">${card.label}</span>
        <span class="stat-value">${card.value}</span>
        <span class="stat-note">${card.note}</span>
      </article>
    `)
    .join('');
}

function renderFiles(summary) {
  fileRows.innerHTML = (summary.files || [])
    .map(item => `
      <tr>
        <td>${item.name}</td>
        <td><code>${item.file}</code></td>
        <td>${item.count}</td>
        <td>${item.info ? formatTime(item.info.updatedAt) : '无文件'}</td>
      </tr>
    `)
    .join('');

  if (!summary.sourceErrors.length) {
    sourceAlerts.innerHTML = '<div class="ok-note">来源页面暂无异常。</div>';
    return;
  }

  sourceAlerts.innerHTML = summary.sourceErrors
    .map(item => `<div class="warn-note">${item.name}: ${item.error}</div>`)
    .join('');
}

function renderTasks() {
  const currentRun = state.status && state.status.currentRun;
  const runs = (state.status && state.status.state && state.status.state.runs) || {};
  const disabled = Boolean(currentRun);

  taskGrid.innerHTML = state.tasks
    .map(task => {
      const run = runs[task.id];
      const isFlow = Array.isArray(task.steps);
      return `
        <article class="task-card ${isFlow ? 'flow' : ''}">
          <div class="task-title-row">
            <span class="task-title">${task.name}</span>
            ${isFlow ? '<span class="badge">流程</span>' : ''}
          </div>
          <p class="task-desc">${task.description}</p>
          <div class="task-meta">
            状态：<span class="${statusClass(run)}">${statusText(run)}</span><br />
            上次：${run ? formatTime(run.finishedAt || run.startedAt) : '无记录'}
            ${run && run.durationMs ? ` · ${formatDuration(run.durationMs)}` : ''}
          </div>
          <button class="run-btn" data-task-id="${task.id}" ${disabled ? 'disabled' : ''}>
            ${currentRun && currentRun.taskId === task.id ? '运行中...' : '运行'}
          </button>
        </article>
      `;
    })
    .join('');

  taskGrid.querySelectorAll('.run-btn').forEach(button => {
    button.addEventListener('click', () => runTask(button.dataset.taskId));
  });
}

async function loadTasks() {
  const data = await requestJson('/api/tasks');
  state.tasks = data.tasks;
  renderTasks();
}

async function loadStatus() {
  const data = await requestJson(`/api/status?env=${state.env}`);
  state.status = data;
  renderSummary(data.summary);
  renderFiles(data.summary);
  renderTasks();
  stopBtn.disabled = !data.currentRun;

  const currentRun = data.currentRun;
  if (currentRun) {
    state.activeRunId = currentRun.runId;
    logTitle.textContent = `${currentRun.taskName} · ${currentRun.environment} · ${statusText(currentRun)}`;
    await loadLog(currentRun.runId);
  } else if (state.activeRunId) {
    await loadLog(state.activeRunId);
  }
}

async function stopCurrentTask() {
  const currentRun = state.status && state.status.currentRun;
  if (!currentRun) return;
  if (!window.confirm(`停止当前任务「${currentRun.taskName}」？`)) return;
  try {
    await requestJson('/api/stop', { method: 'POST' });
    await loadStatus();
  } catch (error) {
    window.alert(error.message);
  }
}

async function loadLog(runId) {
  if (!runId) return;
  try {
    const res = await fetch(`/api/logs?runId=${encodeURIComponent(runId)}`);
    const text = await res.text();
    logOutput.textContent = text || '暂无日志';
    logOutput.scrollTop = logOutput.scrollHeight;
  } catch (error) {
    logOutput.textContent = error.message;
  }
}

async function runTask(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  if (!window.confirm(`在 ${state.env} 环境运行「${task.name}」？`)) return;

  try {
    const data = await requestJson('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, environment: state.env }),
    });
    state.activeRunId = data.run.runId;
    logTitle.textContent = `${data.run.taskName} · ${data.run.environment} · 启动中`;
    logOutput.textContent = '任务已启动，等待日志输出...';
    await loadStatus();
  } catch (error) {
    window.alert(error.message);
  }
}

function bindEnvSwitch() {
  document.querySelectorAll('.env-btn').forEach(button => {
    button.addEventListener('click', async () => {
      state.env = button.dataset.env;
      document.querySelectorAll('.env-btn').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      await loadStatus();
    });
  });
}

async function boot() {
  bindEnvSwitch();
  refreshBtn.addEventListener('click', loadStatus);
  stopBtn.addEventListener('click', stopCurrentTask);
  await loadTasks();
  await loadStatus();
  window.setInterval(loadStatus, 2500);
}

boot().catch(error => {
  console.error(error);
  logOutput.textContent = error.message;
});
