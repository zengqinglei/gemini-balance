-- 添加新的Gemini模型配置
-- 执行命令: npx wrangler d1 execute gemini-balance --file=./migrations/add_new_models.sql

-- 添加 Gemini 2.5 Flash-Lite
INSERT OR IGNORE INTO model_configs (model_name, single_api_rpm_limit, single_api_tpm_limit, single_api_rpd_limit) VALUES
('gemini-2.5-flash-lite', 15, 250000, 400);

-- 添加 Gemini 2.0 系列
INSERT OR IGNORE INTO model_configs (model_name, single_api_rpm_limit, single_api_tpm_limit, single_api_rpd_limit) VALUES
('gemini-2.0-flash', 8, 250000, 200),
('gemini-2.0-flash-lite', 12, 250000, 300);

-- 添加 Gemini 1.5 系列
INSERT OR IGNORE INTO model_configs (model_name, single_api_rpm_limit, single_api_tpm_limit, single_api_rpd_limit) VALUES
('gemini-1.5-flash', 10, 250000, 250),
('gemini-1.5-flash-8b', 20, 250000, 500),
('gemini-1.5-pro', 3, 250000, 50);

-- 更新默认模型描述
UPDATE system_config 
SET description = '默认模型名称 (推荐使用最佳性价比模型)'
WHERE key = 'default_model_name';
