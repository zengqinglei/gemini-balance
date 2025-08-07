/**
 * 响应处理工具
 */

// CORS 头部
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

/**
 * 创建 JSON 响应
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...headers
    }
  });
}

/**
 * 创建错误响应
 */
export function errorResponse(message, status = 400, code = null) {
  const error = {
    error: {
      message,
      type: 'invalid_request_error',
      code: code || `http_${status}`
    }
  };
  
  return jsonResponse(error, status);
}

/**
 * 创建成功响应
 */
export function successResponse(data, message = 'Success') {
  return jsonResponse({
    success: true,
    message,
    data
  });
}

/**
 * 创建流式响应
 */
export function streamResponse(stream, headers = {}) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...corsHeaders,
      ...headers
    }
  });
}

/**
 * 解析请求体
 */
export async function parseRequestBody(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return await request.json();
    }
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const data = {};
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
      return data;
    }
    
    return await request.text();
  } catch (error) {
    throw new Error('Invalid request body');
  }
}

/**
 * 验证必需的字段
 */
export function validateRequired(data, fields) {
  const missing = [];

  for (const field of fields) {
    const value = data[field];
    if (value === null || value === undefined ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * 生成随机 ID
 */
export function generateId(prefix = '', length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(date = new Date()) {
  return Math.floor(date.getTime() / 1000);
}

/**
 * 安全地解析 JSON
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

/**
 * 根据错误信息返回适当的错误响应
 */
export function handleApiError(error) {
  const message = error.message || error.toString();

  // 检查不同类型的错误
  if (message.includes('No available') || message.includes('no.*key')) {
    return errorResponse('No available API keys', 503);
  }

  if (message.includes('rate limit') || message.includes('429')) {
    return errorResponse('Rate limit exceeded', 429);
  }

  if (message.includes('401') || message.includes('unauthorized')) {
    return errorResponse('Unauthorized access to upstream API', 401);
  }

  if (message.includes('400') || message.includes('invalid') || message.includes('bad request')) {
    return errorResponse('Invalid request to upstream API', 400);
  }

  if (message.includes('403') || message.includes('forbidden')) {
    return errorResponse('Access forbidden by upstream API', 403);
  }

  if (message.includes('timeout') || message.includes('TIMEOUT')) {
    return errorResponse('Request timeout', 504);
  }

  if (message.includes('network') || message.includes('connection')) {
    return errorResponse('Network connection error', 502);
  }

  // 默认内部服务器错误
  return errorResponse('Internal server error', 500);
}
