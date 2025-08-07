/**
 * 健康检查处理器
 * 处理 /health 和 /wake 端点
 */

import { getAvailableGeminiKeys } from '../services/database.js';
import { jsonResponse } from '../utils/response.js';

/**
 * 处理健康检查请求
 */
export async function handleHealth(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/wake') {
      return handleWake(request, env);
    }
    
    // 基本健康检查
    const startTime = Date.now();
    
    // 检查数据库连接
    let dbStatus = 'ok';
    let keyCount = 0;
    
    try {
      const keys = await getAvailableGeminiKeys(env.DB);
      keyCount = keys.length;
    } catch (error) {
      console.error('Database health check failed:', error);
      dbStatus = 'error';
    }
    
    // 检查 KV 存储
    let kvStatus = 'ok';
    try {
      await env.KV.put('health_check', Date.now().toString(), { expirationTtl: 60 });
      const testValue = await env.KV.get('health_check');
      if (!testValue) {
        kvStatus = 'error';
      }
    } catch (error) {
      console.error('KV health check failed:', error);
      kvStatus = 'error';
    }
    
    const responseTime = Date.now() - startTime;
    const isHealthy = dbStatus === 'ok' && kvStatus === 'ok' && keyCount > 0;
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      checks: {
        database: dbStatus,
        kv_storage: kvStatus,
        available_keys: keyCount
      },
      version: '1.0.0',
      environment: env.ENVIRONMENT || 'production'
    };
    
    return jsonResponse(healthData, isHealthy ? 200 : 503);
    
  } catch (error) {
    console.error('Health check error:', error);
    
    return jsonResponse({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      version: '1.0.0'
    }, 500);
  }
}

/**
 * 处理唤醒请求
 * 用于保持 Worker 活跃状态
 */
async function handleWake(request, env) {
  try {
    const wakeTime = Date.now();
    
    // 执行一些轻量级操作来"唤醒"服务
    const operations = [];
    
    // 检查数据库
    operations.push(
      getAvailableGeminiKeys(env.DB)
        .then(keys => ({ database: 'ok', key_count: keys.length }))
        .catch(error => ({ database: 'error', error: error.message }))
    );
    
    // 检查 KV
    operations.push(
      env.KV.put('wake_check', wakeTime.toString(), { expirationTtl: 60 })
        .then(() => ({ kv: 'ok' }))
        .catch(error => ({ kv: 'error', error: error.message }))
    );
    
    const results = await Promise.allSettled(operations);
    const responseTime = Date.now() - wakeTime;
    
    const wakeData = {
      status: 'awake',
      timestamp: new Date().toISOString(),
      wake_time_ms: responseTime,
      operations: results.map(result => 
        result.status === 'fulfilled' ? result.value : { error: result.reason.message }
      ),
      message: 'Service is now active'
    };
    
    return jsonResponse(wakeData);
    
  } catch (error) {
    console.error('Wake request error:', error);
    
    return jsonResponse({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      message: 'Failed to wake service'
    }, 500);
  }
}

/**
 * 获取详细的系统状态
 */
export async function getSystemStatus(env) {
  try {
    const startTime = Date.now();
    
    // 获取密钥统计
    const keys = await getAvailableGeminiKeys(env.DB);
    const healthyKeys = keys.filter(key => key.health_status === 'healthy');
    
    // 获取最近的使用统计（简化版本）
    const recentUsage = await env.KV.get('recent_usage_count') || '0';
    
    const status = {
      service: 'Gemini Balance API',
      version: '1.0.0',
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime_check_ms: Date.now() - startTime,
      
      statistics: {
        total_keys: keys.length,
        healthy_keys: healthyKeys.length,
        unhealthy_keys: keys.length - healthyKeys.length,
        recent_requests: parseInt(recentUsage)
      },
      
      components: {
        api: 'operational',
        database: keys.length > 0 ? 'operational' : 'degraded',
        load_balancer: healthyKeys.length > 0 ? 'operational' : 'degraded',
        kv_storage: 'operational'
      },
      
      models: [
        'gemini-2.5-flash',
        'gemini-2.5-pro'
      ]
    };
    
    return status;
    
  } catch (error) {
    console.error('Failed to get system status:', error);
    
    return {
      service: 'Gemini Balance API',
      version: '1.0.0',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}
