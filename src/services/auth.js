/**
 * 认证服务
 * 处理用户密钥验证和权限检查
 */

import { validateUserKey } from './database.js';
import { errorResponse } from '../utils/response.js';

/**
 * 从请求中提取 API 密钥
 */
export function extractApiKey(request) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return null;
  }
  
  // 支持 "Bearer sk-xxx" 和 "sk-xxx" 格式
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
}

/**
 * 验证 API 密钥
 */
export async function authenticateRequest(request, env) {
  const apiKey = extractApiKey(request);
  
  if (!apiKey) {
    return {
      success: false,
      response: errorResponse('Missing API key', 401)
    };
  }
  
  if (!apiKey.startsWith('sk-')) {
    return {
      success: false,
      response: errorResponse('Invalid API key format', 401)
    };
  }
  
  try {
    const userKey = await validateUserKey(env.DB, apiKey);
    
    if (!userKey) {
      return {
        success: false,
        response: errorResponse('Invalid API key', 401)
      };
    }
    
    return {
      success: true,
      userKey
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      response: errorResponse('Authentication failed', 500)
    };
  }
}

/**
 * 检查管理员权限
 * 简化版本：检查是否有特定的管理员密钥
 */
export function checkAdminPermission(request) {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return false;
  }

  // 简单的管理员密钥检查
  // 在生产环境中，应该使用更安全的方式，比如环境变量
  const validAdminKeys = [
    'admin-key', // 默认管理员密钥
    'admin-' + (new Date().getMonth() + 1) // 月份验证密钥
  ];

  return validAdminKeys.includes(apiKey);
}

/**
 * 管理员认证中间件
 */
export function requireAdmin(request) {
  if (!checkAdminPermission(request)) {
    return errorResponse('Admin access required', 403);
  }
  
  return null; // 认证通过
}

/**
 * 速率限制检查
 * 使用 KV 存储来跟踪请求频率
 */
export async function checkRateLimit(env, userKeyId, limit = 60, window = 60) {
  try {
    const key = `rate_limit:${userKeyId}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - window;
    
    // 获取当前计数
    const currentData = await env.KV.get(key);
    let requests = [];
    
    if (currentData) {
      requests = JSON.parse(currentData).filter(timestamp => timestamp > windowStart);
    }
    
    // 检查是否超过限制
    if (requests.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: requests[0] + window
      };
    }
    
    // 添加当前请求
    requests.push(now);
    
    // 保存到 KV
    await env.KV.put(key, JSON.stringify(requests), { expirationTtl: window * 2 });
    
    return {
      allowed: true,
      remaining: limit - requests.length,
      resetTime: now + window
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // 如果检查失败，允许请求通过
    return {
      allowed: true,
      remaining: limit,
      resetTime: Math.floor(Date.now() / 1000) + window
    };
  }
}

/**
 * 应用速率限制
 */
export async function applyRateLimit(request, env, userKey) {
  const rateLimit = await checkRateLimit(env, userKey.id);
  
  if (!rateLimit.allowed) {
    return errorResponse('Rate limit exceeded', 429, {
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': rateLimit.resetTime.toString()
    });
  }
  
  return null; // 通过速率限制
}
