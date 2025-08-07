// Gemini Balance 管理界面 JavaScript

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
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
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
    messageEl.className = `message ${type}`;
    messageEl.classList.add('show');
    
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 3000);
}

// API 调用封装
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Authorization': 'admin-key', // 简化的管理员认证
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        showMessage(`API 调用失败: ${error.message}`, 'error');
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
        serviceStatusEl.className = `status-value ${status.status === 'operational' ? 'healthy' : 'unhealthy'}`;
        
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
        const response = await fetch(`${API_BASE}/health`);
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
    window.open(`${API_BASE}/`, '_blank');
}

// 加载密钥管理
async function loadKeys() {
    try {
        const keys = await apiCall('/admin/keys/gemini');
        
        const keysList = document.getElementById('gemini-keys-list');
        
        if (keys.success && keys.data && keys.data.length > 0) {
            keysList.innerHTML = keys.data.map(key => `
                <div class="key-item">
                    <div class="key-info">
                        <div class="key-id">密钥 #${key.id}</div>
                        <div class="key-value">${key.key}</div>
                        <span class="key-status ${key.health_status}">${getHealthStatusText(key.health_status)}</span>
                    </div>
                    <button class="btn btn-danger" onclick="deleteGeminiKey(${key.id})">删除</button>
                </div>
            `).join('');
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
        const result = await apiCall(`/admin/keys/gemini/${keyId}`, {
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
            userKeysList.innerHTML = `
                <div class="key-item">
                    <div class="key-info">
                        <div class="key-id">${name}</div>
                        <div class="key-value">${result.data.key}</div>
                        <small style="color: #dc3545;">请立即保存此密钥，它不会再次显示</small>
                    </div>
                </div>
            `;
            
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
                data.performance?.avg_response_time ? `${data.performance.avg_response_time.toFixed(0)}ms` : '-';
            document.getElementById('avg-success-rate').textContent = 
                data.performance?.avg_success_rate ? `${(data.performance.avg_success_rate * 100).toFixed(1)}%` : '-';
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}
