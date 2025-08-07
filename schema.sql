-- Gemini Balance 数据库结构
-- 适配 Cloudflare D1 数据库

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Gemini API Keys 表
CREATE TABLE IF NOT EXISTS gemini_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    status INTEGER DEFAULT 1, -- 1: 启用, 0: 禁用
    health_status TEXT DEFAULT 'unknown', -- healthy, unhealthy, unknown, rate_limited
    consecutive_failures INTEGER DEFAULT 0,
    last_check_time DATETIME,
    success_rate REAL DEFAULT 1.0,
    avg_response_time REAL DEFAULT 0.0,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户访问密钥表
CREATE TABLE IF NOT EXISTS user_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT,
    status INTEGER DEFAULT 1, -- 1: 启用, 0: 禁用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
);

-- 使用记录表
CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gemini_key_id INTEGER,
    user_key_id INTEGER,
    model_name TEXT,
    requests INTEGER DEFAULT 0,
    tokens INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gemini_key_id) REFERENCES gemini_keys (id),
    FOREIGN KEY (user_key_id) REFERENCES user_keys (id)
);

-- 模型配置表
CREATE TABLE IF NOT EXISTS model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT UNIQUE NOT NULL,
    single_api_rpm_limit INTEGER NOT NULL,
    single_api_tpm_limit INTEGER NOT NULL,
    single_api_rpd_limit INTEGER NOT NULL,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_model ON usage_logs(model_name);
CREATE INDEX IF NOT EXISTS idx_usage_gemini_key ON usage_logs(gemini_key_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_key ON usage_logs(user_key_id);
CREATE INDEX IF NOT EXISTS idx_gemini_key_status ON gemini_keys(status);
CREATE INDEX IF NOT EXISTS idx_gemini_key_health ON gemini_keys(health_status);
CREATE INDEX IF NOT EXISTS idx_gemini_keys_composite ON gemini_keys(status, health_status);
CREATE INDEX IF NOT EXISTS idx_user_keys_status ON user_keys(status);
CREATE INDEX IF NOT EXISTS idx_user_keys_key ON user_keys(key);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
CREATE INDEX IF NOT EXISTS idx_model_configs_name ON model_configs(model_name);

-- 插入默认配置
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('default_model_name', 'gemini-2.5-flash', '默认模型名称'),
('request_timeout', '60', 'API请求超时时间（秒）'),
('load_balance_strategy', 'adaptive', '负载均衡策略'),
('thinking_enabled', 'true', '是否启用思考功能'),
('thinking_budget', '-1', '思考预算'),
('include_thoughts', 'false', '是否在响应中包含思考过程');

-- 插入默认模型配置
INSERT OR IGNORE INTO model_configs (model_name, single_api_rpm_limit, single_api_tpm_limit, single_api_rpd_limit) VALUES
('gemini-2.5-flash', 10, 250000, 250),
('gemini-2.5-pro', 5, 250000, 100);
