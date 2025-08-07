/**
 * 负载均衡服务
 * 实现多种负载均衡策略来选择最优的 Gemini API Key
 */

import { getAvailableGeminiKeys, getConfig } from './database.js';

/**
 * 选择最优的 Gemini API Key
 */
export async function selectGeminiKey(env, excludedKeys = new Set()) {
  try {
    const availableKeys = await getAvailableGeminiKeys(env.DB);
    
    if (!availableKeys || availableKeys.length === 0) {
      throw new Error('No available Gemini keys');
    }
    
    // 过滤掉被排除的密钥
    const validKeys = availableKeys.filter(key => !excludedKeys.has(key.id));
    
    if (validKeys.length === 0) {
      throw new Error('No valid Gemini keys after filtering');
    }
    
    // 获取负载均衡策略
    const strategy = await getConfig(env.DB, 'load_balance_strategy', 'adaptive');
    
    let selectedKey;
    
    switch (strategy) {
      case 'round_robin':
        selectedKey = await selectRoundRobin(env, validKeys);
        break;
      case 'least_used':
        selectedKey = selectLeastUsed(validKeys);
        break;
      case 'adaptive':
      default:
        selectedKey = selectAdaptive(validKeys);
        break;
    }
    
    return selectedKey;
  } catch (error) {
    console.error('Failed to select Gemini key:', error);
    throw error;
  }
}

/**
 * 轮询策略
 */
async function selectRoundRobin(env, keys) {
  try {
    // 从 KV 获取当前索引
    const currentIndex = await env.KV.get('round_robin_index');
    let index = currentIndex ? parseInt(currentIndex) : 0;

    // 确保索引在有效范围内
    if (isNaN(index) || index < 0 || index >= keys.length) {
      index = 0;
    }

    // 选择当前密钥
    const selectedKey = keys[index];

    // 异步更新索引，避免阻塞
    const nextIndex = (index + 1) % keys.length;
    env.KV.put('round_robin_index', nextIndex.toString()).catch(error => {
      console.error('Failed to update round robin index:', error);
    });

    return selectedKey;
  } catch (error) {
    console.error('Round robin selection failed:', error);
    // 降级到第一个可用的密钥
    return keys[0] || null;
  }
}

/**
 * 最少使用策略
 */
function selectLeastUsed(keys) {
  // 按总请求数排序，选择使用最少的
  return keys.reduce((least, current) => {
    if (current.total_requests < least.total_requests) {
      return current;
    }
    return least;
  });
}

/**
 * 自适应策略
 * 综合考虑健康状态、成功率和响应时间
 */
function selectAdaptive(keys) {
  // 计算每个密钥的得分
  const scoredKeys = keys.map(key => {
    let score = 0;
    
    // 健康状态权重 (40%)
    switch (key.health_status) {
      case 'healthy':
        score += 40;
        break;
      case 'unknown':
        score += 20;
        break;
      case 'rate_limited':
        score += 5;
        break;
      default: // unhealthy
        score += 0;
        break;
    }
    
    // 成功率权重 (35%)
    score += (key.success_rate || 0) * 35;
    
    // 响应时间权重 (25%) - 响应时间越短得分越高
    const responseTimeScore = key.avg_response_time > 0 
      ? Math.max(0, 25 - (key.avg_response_time / 1000) * 5)
      : 25;
    score += responseTimeScore;
    
    return { ...key, score };
  });
  
  // 选择得分最高的密钥
  return scoredKeys.reduce((best, current) => {
    return current.score > best.score ? current : best;
  });
}

/**
 * 检查密钥是否健康
 */
export function isKeyHealthy(key) {
  return key.health_status === 'healthy' && key.success_rate > 0.8;
}

/**
 * 获取健康的密钥数量
 */
export function getHealthyKeyCount(keys) {
  return keys.filter(isKeyHealthy).length;
}

/**
 * 快速故障转移
 * 当一个密钥失败时，快速选择下一个可用的密钥
 */
export async function fastFailover(env, failedKeyId, maxAttempts = 3) {
  const excludedKeys = new Set([failedKeyId]);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const nextKey = await selectGeminiKey(env, excludedKeys);
      return nextKey;
    } catch (error) {
      console.error(`Failover attempt ${attempt + 1} failed:`, error);
      
      // 如果是最后一次尝试，抛出错误
      if (attempt === maxAttempts - 1) {
        throw new Error('All failover attempts exhausted');
      }
      
      // 添加到排除列表，继续尝试
      if (error.keyId) {
        excludedKeys.add(error.keyId);
      }
    }
  }
}

/**
 * 获取负载均衡统计信息
 */
export async function getLoadBalanceStats(env) {
  try {
    const keys = await getAvailableGeminiKeys(env.DB);
    const strategy = await getConfig(env.DB, 'load_balance_strategy', 'adaptive');
    
    const stats = {
      strategy,
      total_keys: keys.length,
      healthy_keys: getHealthyKeyCount(keys),
      key_distribution: keys.map(key => ({
        id: key.id,
        health_status: key.health_status,
        success_rate: key.success_rate,
        total_requests: key.total_requests,
        avg_response_time: key.avg_response_time
      }))
    };
    
    return stats;
  } catch (error) {
    console.error('Failed to get load balance stats:', error);
    return {
      strategy: 'unknown',
      total_keys: 0,
      healthy_keys: 0,
      key_distribution: []
    };
  }
}
