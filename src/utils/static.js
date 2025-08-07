/**
 * 静态文件服务
 * 为管理界面提供 HTML、CSS、JS 文件
 */

import { corsHeaders } from './response.js';

/**
 * 服务管理界面 HTML
 */
export function serveAdminInterface() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini Balance 管理界面</title>
    <link rel="stylesheet" href="/admin/style.css">
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🌟 Gemini Balance 管理界面</h1>
            <p>Cloudflare Worker 版本 - 高性能 Gemini API 代理服务</p>
        </header>

        <nav class="nav">
            <button class="nav-btn active" data-tab="dashboard">仪表盘</button>
            <button class="nav-btn" data-tab="keys">密钥管理</button>
            <button class="nav-btn" data-tab="config">系统配置</button>
            <button class="nav-btn" data-tab="stats">统计信息</button>
        </nav>

        <!-- 仪表盘 -->
        <div id="dashboard" class="tab-content active">
            <div class="card">
                <h2>系统状态</h2>
                <div id="system-status" class="status-grid">
                    <div class="status-item">
                        <span class="status-label">服务状态</span>
                        <span class="status-value" id="service-status">检查中...</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">可用密钥</span>
                        <span class="status-value" id="available-keys">-</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">健康密钥</span>
                        <span class="status-value" id="healthy-keys">-</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">最近请求</span>
                        <span class="status-value" id="recent-requests">-</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>快速操作</h2>
                <div class="quick-actions">
                    <button class="btn btn-primary" onclick="refreshStatus()">刷新状态</button>
                    <button class="btn btn-secondary" onclick="testAPI()">测试 API</button>
                    <button class="btn btn-secondary" onclick="showApiDocs()">API 文档</button>
                </div>
            </div>
        </div>

        <!-- 密钥管理 -->
        <div id="keys" class="tab-content">
            <div class="card">
                <h2>Gemini API 密钥</h2>
                <div class="key-actions">
                    <input type="text" id="new-gemini-key" placeholder="输入 Gemini API Key (AIzaSy...)">
                    <button class="btn btn-primary" onclick="addGeminiKey()">添加密钥</button>
                </div>
                <div id="gemini-keys-list" class="keys-list">
                    <p>加载中...</p>
                </div>
            </div>

            <div class="card">
                <h2>用户访问密钥</h2>
                <div class="key-actions">
                    <input type="text" id="user-key-name" placeholder="密钥名称 (可选)">
                    <button class="btn btn-primary" onclick="generateUserKey()">生成用户密钥</button>
                </div>
                <div id="user-keys-list" class="keys-list">
                    <p>暂无用户密钥</p>
                </div>
            </div>
        </div>

        <!-- 系统配置 -->
        <div id="config" class="tab-content">
            <div class="card">
                <h2>负载均衡配置</h2>
                <div class="config-form">
                    <label for="load-balance-strategy">负载均衡策略:</label>
                    <select id="load-balance-strategy">
                        <option value="adaptive">自适应策略</option>
                        <option value="least_used">最少使用策略</option>
                        <option value="round_robin">轮询策略</option>
                    </select>
                </div>
            </div>

            <div class="card">
                <h2>思考模式配置</h2>
                <div class="config-form">
                    <label>
                        <input type="checkbox" id="thinking-enabled"> 启用思考模式
                    </label>
                    <label for="thinking-budget">思考预算:</label>
                    <select id="thinking-budget">
                        <option value="-1">自动</option>
                        <option value="0">禁用</option>
                        <option value="4096">低 (4k)</option>
                        <option value="8192">中 (8k)</option>
                        <option value="24576">Flash最大 (24k)</option>
                        <option value="32768">Pro最大 (32k)</option>
                    </select>
                </div>
            </div>

            <div class="card">
                <h2>其他配置</h2>
                <div class="config-form">
                    <label for="request-timeout">请求超时 (秒):</label>
                    <input type="number" id="request-timeout" min="10" max="300" value="60">
                </div>
                <button class="btn btn-primary" onclick="saveConfig()">保存配置</button>
            </div>
        </div>

        <!-- 统计信息 -->
        <div id="stats" class="tab-content">
            <div class="card">
                <h2>密钥统计</h2>
                <div id="key-stats" class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">总密钥数</span>
                        <span class="stat-value" id="total-keys">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">健康密钥</span>
                        <span class="stat-value" id="healthy-keys-stat">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">异常密钥</span>
                        <span class="stat-value" id="unhealthy-keys-stat">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">未知状态</span>
                        <span class="stat-value" id="unknown-keys-stat">-</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>使用统计</h2>
                <div id="usage-stats" class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">最近请求</span>
                        <span class="stat-value" id="recent-requests-stat">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">总请求数</span>
                        <span class="stat-value" id="total-requests-stat">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">平均响应时间</span>
                        <span class="stat-value" id="avg-response-time">-</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">平均成功率</span>
                        <span class="stat-value" id="avg-success-rate">-</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- 消息提示 -->
        <div id="message" class="message"></div>
    </div>

    <script src="/admin/script.js"></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...corsHeaders
    }
  });
}

/**
 * 服务 CSS 样式
 */
export function serveAdminCSS() {
  const css = `/* Gemini Balance 管理界面样式 */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* 头部 */
.header {
    text-align: center;
    margin-bottom: 30px;
    color: white;
}

.header h1 {
    font-size: 2.5rem;
    margin-bottom: 10px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.header p {
    font-size: 1.1rem;
    opacity: 0.9;
}

/* 导航 */
.nav {
    display: flex;
    justify-content: center;
    margin-bottom: 30px;
    gap: 10px;
    flex-wrap: wrap;
}

.nav-btn {
    padding: 12px 24px;
    border: none;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border-radius: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1rem;
    backdrop-filter: blur(10px);
}

.nav-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
}

.nav-btn.active {
    background: rgba(255, 255, 255, 0.9);
    color: #333;
}

/* 卡片 */
.card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 15px;
    padding: 25px;
    margin-bottom: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
}

.card h2 {
    margin-bottom: 20px;
    color: #333;
    font-size: 1.5rem;
}

/* 标签页内容 */
.tab-content {
    display: none;
}

.tab-content.active {
    display: block;
}

/* 状态网格 */
.status-grid, .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
}

.status-item, .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15px;
    background: rgba(102, 126, 234, 0.1);
    border-radius: 10px;
    text-align: center;
}

.status-label, .stat-label {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 5px;
}

.status-value, .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: #333;
}

/* 按钮 */
.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.3s ease;
    margin: 5px;
}

.btn-primary {
    background: #667eea;
    color: white;
}

.btn-primary:hover {
    background: #5a6fd8;
    transform: translateY(-2px);
}

.btn-secondary {
    background: #f8f9fa;
    color: #333;
    border: 1px solid #ddd;
}

.btn-secondary:hover {
    background: #e9ecef;
}

.btn-danger {
    background: #dc3545;
    color: white;
}

.btn-danger:hover {
    background: #c82333;
}

/* 快速操作 */
.quick-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

/* 密钥管理 */
.key-actions {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.key-actions input {
    flex: 1;
    min-width: 300px;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
}

.keys-list {
    max-height: 400px;
    overflow-y: auto;
}

.key-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    margin-bottom: 10px;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #667eea;
}

.key-info {
    flex: 1;
}

.key-id {
    font-weight: bold;
    color: #333;
}

.key-value {
    font-family: monospace;
    color: #666;
    margin: 5px 0;
}

.key-status {
    font-size: 0.9rem;
    padding: 2px 8px;
    border-radius: 4px;
    color: white;
}

.key-status.healthy {
    background: #28a745;
}

.key-status.unhealthy {
    background: #dc3545;
}

.key-status.unknown {
    background: #ffc107;
    color: #333;
}

/* 配置表单 */
.config-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.config-form label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
}

.config-form input,
.config-form select {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
}

.config-form input[type="checkbox"] {
    width: auto;
}

/* 消息提示 */
.message {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    transform: translateX(400px);
    transition: transform 0.3s ease;
}

.message.show {
    transform: translateX(0);
}

.message.success {
    background: #28a745;
}

.message.error {
    background: #dc3545;
}

.message.info {
    background: #17a2b8;
}

/* 响应式设计 */
@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
    
    .header h1 {
        font-size: 2rem;
    }
    
    .nav {
        flex-direction: column;
        align-items: center;
    }
    
    .nav-btn {
        width: 100%;
        max-width: 300px;
    }
    
    .status-grid, .stats-grid {
        grid-template-columns: 1fr;
    }
    
    .key-actions {
        flex-direction: column;
    }
    
    .key-actions input {
        min-width: auto;
    }
    
    .key-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
    
    .quick-actions {
        flex-direction: column;
    }
    
    .btn {
        width: 100%;
    }
}`;

  return new Response(css, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      ...corsHeaders
    }
  });
}

/**
 * 服务 JavaScript 脚本
 */
export function serveAdminJS() {
  const js = `// Gemini Balance 管理界面 JavaScript

// 全局变量
let currentTab = 'dashboard';
const API_BASE = window.location.origin;

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    loadDashboard();

    // 每30秒自动刷新状态
    setInterval(refreshStatus, 30000);
});

// 导航初始化
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');

    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

// 切换标签页
function switchTab(tabName) {
    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(\`[data-tab="\${tabName}"]\`).classList.add('active');

    // 更新内容区域
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    currentTab = tabName;

    // 加载对应的数据
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'keys':
            loadKeys();
            break;
        case 'config':
            loadConfig();
            break;
        case 'stats':
            loadStats();
            break;
    }
}

// 显示消息
function showMessage(text, type = 'info') {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.className = \`message \${type}\`;
    messageEl.classList.add('show');

    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 3000);
}

// API 调用封装
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
            headers: {
                'Authorization': 'admin-key', // 简化的管理员认证
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        showMessage(\`API 调用失败: \${error.message}\`, 'error');
        throw error;
    }
}

// 加载仪表盘
async function loadDashboard() {
    try {
        const status = await apiCall('/admin/status');

        // 更新系统状态
        document.getElementById('service-status').textContent = status.status || 'unknown';
        document.getElementById('available-keys').textContent = status.statistics?.total_keys || 0;
        document.getElementById('healthy-keys').textContent = status.statistics?.healthy_keys || 0;
        document.getElementById('recent-requests').textContent = status.statistics?.recent_requests || 0;

        // 更新状态颜色
        const serviceStatusEl = document.getElementById('service-status');
        serviceStatusEl.className = \`status-value \${status.status === 'operational' ? 'healthy' : 'unhealthy'}\`;

    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

// 刷新状态
async function refreshStatus() {
    if (currentTab === 'dashboard') {
        await loadDashboard();
        showMessage('状态已刷新', 'success');
    }
}

// 测试 API
async function testAPI() {
    try {
        const response = await fetch(\`\${API_BASE}/health\`);
        const data = await response.json();

        if (data.status === 'healthy') {
            showMessage('API 测试成功', 'success');
        } else {
            showMessage('API 测试失败', 'error');
        }
    } catch (error) {
        showMessage('API 测试失败', 'error');
    }
}

// 显示 API 文档
function showApiDocs() {
    window.open(\`\${API_BASE}/\`, '_blank');
}

// 加载密钥管理
async function loadKeys() {
    try {
        const keys = await apiCall('/admin/keys/gemini');

        const keysList = document.getElementById('gemini-keys-list');

        if (keys.success && keys.data && keys.data.length > 0) {
            keysList.innerHTML = keys.data.map(key => \`
                <div class="key-item">
                    <div class="key-info">
                        <div class="key-id">密钥 #\${key.id}</div>
                        <div class="key-value">\${key.key}</div>
                        <span class="key-status \${key.health_status}">\${getHealthStatusText(key.health_status)}</span>
                    </div>
                    <button class="btn btn-danger" onclick="deleteGeminiKey(\${key.id})">删除</button>
                </div>
            \`).join('');
        } else {
            keysList.innerHTML = '<p>暂无 Gemini API 密钥</p>';
        }
    } catch (error) {
        console.error('Failed to load keys:', error);
    }
}

// 获取健康状态文本
function getHealthStatusText(status) {
    const statusMap = {
        'healthy': '健康',
        'unhealthy': '异常',
        'unknown': '未知',
        'rate_limited': '限流'
    };
    return statusMap[status] || status;
}

// 添加 Gemini 密钥
async function addGeminiKey() {
    const keyInput = document.getElementById('new-gemini-key');
    const key = keyInput.value.trim();

    if (!key) {
        showMessage('请输入 API 密钥', 'error');
        return;
    }

    if (!key.startsWith('AIzaSy')) {
        showMessage('无效的 Gemini API 密钥格式', 'error');
        return;
    }

    try {
        const result = await apiCall('/admin/keys/gemini', {
            method: 'POST',
            body: JSON.stringify({ key })
        });

        if (result.success) {
            showMessage('密钥添加成功', 'success');
            keyInput.value = '';
            loadKeys();
        } else {
            showMessage('密钥添加失败', 'error');
        }
    } catch (error) {
        console.error('Failed to add key:', error);
    }
}

// 删除 Gemini 密钥
async function deleteGeminiKey(keyId) {
    if (!confirm('确定要删除这个密钥吗？')) {
        return;
    }

    try {
        const result = await apiCall(\`/admin/keys/gemini/\${keyId}\`, {
            method: 'DELETE'
        });

        if (result.success) {
            showMessage('密钥删除成功', 'success');
            loadKeys();
        } else {
            showMessage('密钥删除失败', 'error');
        }
    } catch (error) {
        console.error('Failed to delete key:', error);
    }
}

// 生成用户密钥
async function generateUserKey() {
    const nameInput = document.getElementById('user-key-name');
    const name = nameInput.value.trim() || 'API User';

    try {
        const result = await apiCall('/admin/keys/user', {
            method: 'POST',
            body: JSON.stringify({ name })
        });

        if (result.success) {
            showMessage('用户密钥生成成功', 'success');

            // 显示生成的密钥
            const userKeysList = document.getElementById('user-keys-list');
            userKeysList.innerHTML = \`
                <div class="key-item">
                    <div class="key-info">
                        <div class="key-id">\${name}</div>
                        <div class="key-value">\${result.data.key}</div>
                        <small style="color: #dc3545;">请立即保存此密钥，它不会再次显示</small>
                    </div>
                </div>
            \`;

            nameInput.value = '';
        } else {
            showMessage('用户密钥生成失败', 'error');
        }
    } catch (error) {
        console.error('Failed to generate user key:', error);
    }
}

// 加载配置
async function loadConfig() {
    try {
        const config = await apiCall('/admin/config');

        if (config.success) {
            const data = config.data;

            // 设置表单值
            document.getElementById('load-balance-strategy').value = data.load_balance_strategy || 'adaptive';
            document.getElementById('thinking-enabled').checked = data.thinking_enabled === 'true';
            document.getElementById('thinking-budget').value = data.thinking_budget || '-1';
            document.getElementById('request-timeout').value = data.request_timeout || '60';
        }
    } catch (error) {
        console.error('Failed to load config:', error);
    }
}

// 保存配置
async function saveConfig() {
    const config = {
        load_balance_strategy: document.getElementById('load-balance-strategy').value,
        thinking_enabled: document.getElementById('thinking-enabled').checked ? 'true' : 'false',
        thinking_budget: document.getElementById('thinking-budget').value,
        request_timeout: document.getElementById('request-timeout').value
    };

    try {
        const result = await apiCall('/admin/config', {
            method: 'POST',
            body: JSON.stringify(config)
        });

        if (result.success) {
            showMessage('配置保存成功', 'success');
        } else {
            showMessage('配置保存失败', 'error');
        }
    } catch (error) {
        console.error('Failed to save config:', error);
    }
}

// 加载统计信息
async function loadStats() {
    try {
        const stats = await apiCall('/admin/stats');

        if (stats.success) {
            const data = stats.data;

            // 更新密钥统计
            document.getElementById('total-keys').textContent = data.keys?.total || 0;
            document.getElementById('healthy-keys-stat').textContent = data.keys?.healthy || 0;
            document.getElementById('unhealthy-keys-stat').textContent = data.keys?.unhealthy || 0;
            document.getElementById('unknown-keys-stat').textContent = data.keys?.unknown || 0;

            // 更新使用统计
            document.getElementById('recent-requests-stat').textContent = data.usage?.recent_requests || 0;
            document.getElementById('total-requests-stat').textContent = data.usage?.total_requests || 0;
            document.getElementById('avg-response-time').textContent =
                data.performance?.avg_response_time ? \`\${data.performance.avg_response_time.toFixed(0)}ms\` : '-';
            document.getElementById('avg-success-rate').textContent =
                data.performance?.avg_success_rate ? \`\${(data.performance.avg_success_rate * 100).toFixed(1)}%\` : '-';
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}`;

  return new Response(js, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      ...corsHeaders
    }
  });
}
