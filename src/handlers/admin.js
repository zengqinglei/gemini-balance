/**
 * 管理 API 处理器
 * 处理 /admin/* 端点
 */

import { requireAdmin } from '../services/auth.js';
import { 
  getAllGeminiKeys, 
  addGeminiKey, 
  deleteGeminiKey,
  generateUserKey,
  getConfig,
  setConfig 
} from '../services/database.js';
import { getLoadBalanceStats } from '../services/loadbalancer.js';
import { getSystemStatus } from './health.js';
import { 
  parseRequestBody, 
  errorResponse, 
  successResponse,
  jsonResponse 
} from '../utils/response.js';

/**
 * 处理管理 API 请求
 */
export async function handleAdmin(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 登录路由不需要权限验证
    if (path === '/admin/login') {
      return handleAdminLogin(request, env);
    }

    // 检查管理员权限（简化版本）
    const adminCheck = requireAdmin(request);
    if (adminCheck) {
      return adminCheck;
    }

    // 路由处理

    if (path === '/admin/status') {
      return handleAdminStatus(request, env);
    }
    
    if (path === '/admin/keys/gemini') {
      return handleGeminiKeys(request, env);
    }
    
    if (path === '/admin/keys/user') {
      return handleUserKeys(request, env);
    }
    
    if (path === '/admin/config') {
      return handleConfig(request, env);
    }
    
    if (path === '/admin/stats') {
      return handleStats(request, env);
    }
    
    // 处理带参数的路径
    const pathParts = path.split('/');
    
    if (pathParts[2] === 'keys' && pathParts[3] === 'gemini' && pathParts[4]) {
      return handleGeminiKeyById(request, env, pathParts[4]);
    }
    
    return errorResponse('Admin endpoint not found', 404);
    
  } catch (error) {
    console.error('Admin API error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * 处理管理状态请求
 */
async function handleAdminStatus(request, env) {
  const status = await getSystemStatus(env);
  const loadBalanceStats = await getLoadBalanceStats(env);
  
  return jsonResponse({
    ...status,
    load_balance: loadBalanceStats
  });
}

/**
 * 处理 Gemini 密钥管理
 */
async function handleGeminiKeys(request, env) {
  const method = request.method;
  
  if (method === 'GET') {
    // 获取所有 Gemini 密钥
    const keys = await getAllGeminiKeys(env.DB);
    
    // 隐藏密钥的敏感部分
    const safeKeys = keys.map(key => ({
      ...key,
      key: key.key.substring(0, 8) + '...' + key.key.substring(key.key.length - 4)
    }));
    
    return successResponse(safeKeys);
  }
  
  if (method === 'POST') {
    // 添加新的 Gemini 密钥
    try {
      const body = await parseRequestBody(request);
      const { key } = body;
      
      if (!key || typeof key !== 'string') {
        return errorResponse('API key is required and must be a string', 400);
      }

      // 验证 Gemini API 密钥格式
      // 标准格式：AIzaSy... (Google AI Studio)
      // 某些情况下可能有其他格式，但主要是 AIzaSy
      if (!key.startsWith('AIzaSy')) {
        return errorResponse('Invalid Gemini API key format. Gemini API keys should start with "AIzaSy". Please get your key from Google AI Studio (https://makersuite.google.com/)', 400);
      }

      if (key.length < 20) {
        return errorResponse('Gemini API key is too short. Please check your key format.', 400);
      }
      
      const success = await addGeminiKey(env.DB, key);
      
      if (success) {
        return successResponse(null, 'Gemini key added successfully');
      } else {
        return errorResponse('Failed to add Gemini key (may already exist)', 400);
      }
    } catch (error) {
      return errorResponse('Invalid request body', 400);
    }
  }
  
  return errorResponse('Method not allowed', 405);
}

/**
 * 处理单个 Gemini 密钥操作
 */
async function handleGeminiKeyById(request, env, keyId) {
  const method = request.method;
  const id = parseInt(keyId);
  
  if (isNaN(id)) {
    return errorResponse('Invalid key ID', 400);
  }
  
  if (method === 'DELETE') {
    const success = await deleteGeminiKey(env.DB, id);
    
    if (success) {
      return successResponse(null, 'Gemini key deleted successfully');
    } else {
      return errorResponse('Failed to delete Gemini key', 400);
    }
  }
  
  return errorResponse('Method not allowed', 405);
}

/**
 * 处理用户密钥管理
 */
async function handleUserKeys(request, env) {
  const method = request.method;
  
  if (method === 'POST') {
    // 生成新的用户密钥
    try {
      const body = await parseRequestBody(request);
      const { name = 'API User' } = body;
      
      const key = await generateUserKey(env.DB, name);
      
      if (key) {
        return successResponse({ key, name }, 'User key generated successfully');
      } else {
        return errorResponse('Failed to generate user key', 500);
      }
    } catch (error) {
      return errorResponse('Invalid request body', 400);
    }
  }
  
  return errorResponse('Method not allowed', 405);
}

/**
 * 处理配置管理
 */
async function handleConfig(request, env) {
  const method = request.method;
  
  if (method === 'GET') {
    // 获取所有配置
    const configs = {
      load_balance_strategy: await getConfig(env.DB, 'load_balance_strategy', 'adaptive'),
      thinking_enabled: await getConfig(env.DB, 'thinking_enabled', 'true'),
      thinking_budget: await getConfig(env.DB, 'thinking_budget', '-1'),
      request_timeout: await getConfig(env.DB, 'request_timeout', '60')
    };
    
    return successResponse(configs);
  }
  
  if (method === 'POST') {
    // 更新配置
    try {
      const body = await parseRequestBody(request);
      const updates = [];
      
      for (const [key, value] of Object.entries(body)) {
        const success = await setConfig(env.DB, key, String(value));
        updates.push({ key, success });
      }
      
      const allSuccess = updates.every(update => update.success);
      
      if (allSuccess) {
        return successResponse(updates, 'Configuration updated successfully');
      } else {
        return errorResponse('Some configuration updates failed', 400);
      }
    } catch (error) {
      return errorResponse('Invalid request body', 400);
    }
  }
  
  return errorResponse('Method not allowed', 405);
}

/**
 * 处理统计信息请求
 */
async function handleStats(request, env) {
  try {
    const keys = await getAllGeminiKeys(env.DB);
    const loadBalanceStats = await getLoadBalanceStats(env);
    
    // 获取使用统计（简化版本）
    const recentUsage = await env.KV.get('recent_usage_count') || '0';
    
    const stats = {
      keys: {
        total: keys.length,
        healthy: keys.filter(k => k.health_status === 'healthy').length,
        unhealthy: keys.filter(k => k.health_status === 'unhealthy').length,
        unknown: keys.filter(k => k.health_status === 'unknown').length
      },
      
      usage: {
        recent_requests: parseInt(recentUsage),
        total_requests: keys.reduce((sum, key) => sum + (key.total_requests || 0), 0)
      },
      
      load_balance: loadBalanceStats,
      
      performance: {
        avg_response_time: keys.length > 0 
          ? keys.reduce((sum, key) => sum + (key.avg_response_time || 0), 0) / keys.length
          : 0,
        avg_success_rate: keys.length > 0
          ? keys.reduce((sum, key) => sum + (key.success_rate || 0), 0) / keys.length
          : 0
      }
    };
    
    return successResponse(stats);
    
  } catch (error) {
    console.error('Failed to get stats:', error);
    return errorResponse('Failed to retrieve statistics', 500);
  }
}

/**
 * 处理管理员登录请求
 */
async function handleAdminLogin(request, env) {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body = await parseRequestBody(request);
    const { password } = body;

    if (!password) {
      return errorResponse('Password is required', 400);
    }

    // 验证口令是否为 "gandalf"
    if (password === 'gandalf') {
      // 生成一个简单的登录token（在生产环境中应该使用更安全的方式）
      const loginToken = 'admin-logged-in-' + Date.now();

      return successResponse({
        success: true,
        token: loginToken,
        message: 'Login successful'
      });
    } else {
      return errorResponse('Invalid password', 401);
    }

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Login failed', 500);
  }
}
