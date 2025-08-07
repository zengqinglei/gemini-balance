-- 数据库迁移脚本
-- 用于更新现有数据库结构

-- 添加新的索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_usage_gemini_key ON usage_logs(gemini_key_id);
CREATE INDEX IF NOT EXISTS idx_usage_user_key ON usage_logs(user_key_id);
CREATE INDEX IF NOT EXISTS idx_gemini_keys_composite ON gemini_keys(status, health_status);
CREATE INDEX IF NOT EXISTS idx_user_keys_status ON user_keys(status);
CREATE INDEX IF NOT EXISTS idx_user_keys_key ON user_keys(key);

-- 更新默认配置（如果不存在）
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
('max_retries', '3', '最大重试次数'),
('health_check_interval', '300', '健康检查间隔（秒）'),
('rate_limit_window', '60', '速率限制时间窗口（秒）'),
('rate_limit_requests', '60', '速率限制请求数量');

-- 清理旧的无效数据
DELETE FROM usage_logs WHERE timestamp < datetime('now', '-30 days');
DELETE FROM gemini_keys WHERE status = 0 AND updated_at < datetime('now', '-7 days');

-- 更新统计信息
UPDATE gemini_keys SET 
  success_rate = CASE 
    WHEN total_requests > 0 THEN CAST(successful_requests AS REAL) / total_requests 
    ELSE 1.0 
  END
WHERE total_requests > 0;
