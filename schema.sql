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
('default_model_name', 'gemini-2.5-flash', '默认模型名称 (推荐使用最佳性价比模型)'),
('request_timeout', '60', 'API请求超时时间（秒）'),
('load_balance_strategy', 'adaptive', '负载均衡策略'),
('thinking_enabled', 'true', '是否启用思考功能'),
('thinking_budget', '-1', '思考预算'),
('include_thoughts', 'false', '是否在响应中包含思考过程');

-- 插入默认模型配置
INSERT OR IGNORE INTO model_configs (model_name, single_api_rpm_limit, single_api_tpm_limit, single_api_rpd_limit) VALUES
-- Gemini 2.5 系列 (推荐)
('gemini-2.5-pro', 5, 250000, 100),           -- 最先进推理模型，较低限制
('gemini-2.5-flash', 10, 250000, 250),        -- 最佳性价比模型
('gemini-2.5-flash-lite', 15, 250000, 400),   -- 成本优化模型，更高限制

-- Gemini 2.0 系列 (最新功能)
('gemini-2.0-flash', 8, 250000, 200),         -- 最新功能模型
('gemini-2.0-flash-lite', 12, 250000, 300),   -- 2.0轻量版

-- Gemini 1.5 系列 (兼容性保留)
('gemini-1.5-flash', 10, 250000, 250),        -- 快速多模态模型
('gemini-1.5-flash-8b', 20, 250000, 500),     -- 小型模型，最高限制
('gemini-1.5-pro', 3, 250000, 50);
