/**
 * 数据库操作服务
 * 封装 Cloudflare D1 数据库操作
 */

/**
 * 获取系统配置
 */
export async function getConfig(db, key, defaultValue = null) {
  try {
    const result = await db.prepare('SELECT value FROM system_config WHERE key = ?')
      .bind(key)
      .first();
    
    return result ? result.value : defaultValue;
  } catch (error) {
    console.error(`Failed to get config ${key}:`, error);
    return defaultValue;
  }
}

/**
 * 设置系统配置
 */
export async function setConfig(db, key, value) {
  try {
    await db.prepare(`
      INSERT OR REPLACE INTO system_config (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).bind(key, value).run();
    
    return true;
  } catch (error) {
    console.error(`Failed to set config ${key}:`, error);
    return false;
  }
}

/**
 * 获取所有可用的 Gemini Keys
 */
export async function getAvailableGeminiKeys(db) {
  try {
    const result = await db.prepare(`
      SELECT id, key, health_status, success_rate, avg_response_time
      FROM gemini_keys
      WHERE status = 1
      ORDER BY
        CASE health_status
          WHEN 'healthy' THEN 1
          WHEN 'unknown' THEN 2
          WHEN 'rate_limited' THEN 3
          ELSE 4
        END,
        success_rate DESC,
        avg_response_time ASC
    `).all();
    
    return result.results || [];
  } catch (error) {
    console.error('Failed to get available Gemini keys:', error);
    return [];
  }
}

/**
 * 获取所有 Gemini Keys
 */
export async function getAllGeminiKeys(db) {
  try {
    const result = await db.prepare(`
      SELECT * FROM gemini_keys
      ORDER BY success_rate DESC, avg_response_time ASC, id ASC
    `).all();
    
    return result.results || [];
  } catch (error) {
    console.error('Failed to get all Gemini keys:', error);
    return [];
  }
}

/**
 * 添加 Gemini Key
 */
export async function addGeminiKey(db, key) {
  try {
    await db.prepare('INSERT INTO gemini_keys (key) VALUES (?)').bind(key).run();
    return true;
  } catch (error) {
    console.error('Failed to add Gemini key:', error);
    return false;
  }
}

/**
 * 删除 Gemini Key
 */
export async function deleteGeminiKey(db, keyId) {
  try {
    const result = await db.prepare('DELETE FROM gemini_keys WHERE id = ?').bind(keyId).run();
    return result.changes > 0;
  } catch (error) {
    console.error('Failed to delete Gemini key:', error);
    return false;
  }
}

/**
 * 更新 Key 性能指标
 */
export async function updateKeyPerformance(db, keyId, success, responseTime = 0.0) {
  try {
    // 获取当前统计
    const current = await db.prepare(`
      SELECT total_requests, successful_requests, avg_response_time, consecutive_failures
      FROM gemini_keys WHERE id = ?
    `).bind(keyId).first();
    
    if (!current) return false;
    
    const totalRequests = current.total_requests + 1;
    const successfulRequests = current.successful_requests + (success ? 1 : 0);
    const successRate = successfulRequests / totalRequests;
    
    // 计算平均响应时间
    const currentAvg = current.avg_response_time;
    const newAvg = currentAvg === 0 ? responseTime : currentAvg * 0.9 + responseTime * 0.1;
    
    // 更新连续失败次数和健康状态
    let consecutiveFailures, healthStatus;
    if (success) {
      consecutiveFailures = 0;
      healthStatus = 'healthy';
    } else {
      consecutiveFailures = current.consecutive_failures + 1;
      healthStatus = consecutiveFailures >= 3 ? 'unhealthy' : 'unknown';
    }
    
    await db.prepare(`
      UPDATE gemini_keys
      SET total_requests = ?, successful_requests = ?, success_rate = ?,
          avg_response_time = ?, consecutive_failures = ?, health_status = ?,
          last_check_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      totalRequests, successfulRequests, successRate, newAvg,
      consecutiveFailures, healthStatus, keyId
    ).run();
    
    return true;
  } catch (error) {
    console.error('Failed to update key performance:', error);
    return false;
  }
}

/**
 * 验证用户密钥
 */
export async function validateUserKey(db, key) {
  try {
    const result = await db.prepare(`
      SELECT * FROM user_keys WHERE key = ? AND status = 1
    `).bind(key).first();
    
    if (result) {
      // 更新最后使用时间
      await db.prepare(`
        UPDATE user_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(result.id).run();
    }
    
    return result;
  } catch (error) {
    console.error('Failed to validate user key:', error);
    return null;
  }
}

/**
 * 生成用户密钥
 */
export async function generateUserKey(db, name = 'API User') {
  try {
    // 生成更安全的随机密钥
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const key = 'sk-' + Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 48);

    await db.prepare('INSERT INTO user_keys (key, name) VALUES (?, ?)').bind(key, name).run();
    return key;
  } catch (error) {
    console.error('Failed to generate user key:', error);
    return null;
  }
}

/**
 * 记录使用量
 */
export async function logUsage(db, geminiKeyId, userKeyId, modelName, requests = 1, tokens = 0) {
  try {
    await db.prepare(`
      INSERT INTO usage_logs (gemini_key_id, user_key_id, model_name, requests, tokens)
      VALUES (?, ?, ?, ?, ?)
    `).bind(geminiKeyId, userKeyId, modelName, requests, tokens).run();
  } catch (error) {
    console.error('Failed to log usage:', error);
  }
}

/**
 * 获取模型配置
 */
export async function getModelConfig(db, modelName) {
  try {
    const result = await db.prepare(`
      SELECT * FROM model_configs WHERE model_name = ? AND status = 1
    `).bind(modelName).first();
    
    return result;
  } catch (error) {
    console.error('Failed to get model config:', error);
    return null;
  }
}
