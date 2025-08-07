/**
 * 聊天完成 API 处理器
 * 处理 /v1/chat/completions 端点
 */

import { authenticateRequest, applyRateLimit } from '../services/auth.js';
import { selectGeminiKey, fastFailover } from '../services/loadbalancer.js';
import { 
  convertToGeminiRequest, 
  convertToOpenAIResponse, 
  callGeminiWithRetry,
  handleStreamResponse 
} from '../services/gemini.js';
import { logUsage } from '../services/database.js';
import {
  parseRequestBody,
  validateRequired,
  errorResponse,
  jsonResponse,
  streamResponse,
  generateId,
  handleApiError
} from '../utils/response.js';

/**
 * 处理聊天完成请求
 */
export async function handleChatCompletion(request, env) {
  try {
    // 验证请求方法
    if (request.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }
    
    // 认证用户
    const authResult = await authenticateRequest(request, env);
    if (!authResult.success) {
      return authResult.response;
    }
    
    const userKey = authResult.userKey;
    
    // 应用速率限制
    const rateLimitResult = await applyRateLimit(request, env, userKey);
    if (rateLimitResult) {
      return rateLimitResult;
    }
    
    // 解析请求体
    let requestBody;
    try {
      requestBody = await parseRequestBody(request);
    } catch (error) {
      return errorResponse('Invalid request body', 400);
    }
    
    // 验证必需字段
    try {
      validateRequired(requestBody, ['model', 'messages']);
    } catch (error) {
      return errorResponse(error.message, 400);
    }
    
    const { model, messages, stream = false, ...otherParams } = requestBody;
    
    // 验证模型
    const supportedModels = [
      // Gemini 2.5 系列 (推荐)
      'gemini-2.5-pro',           // 最先进的推理模型
      'gemini-2.5-flash',         // 最佳性价比模型
      'gemini-2.5-flash-lite',    // 成本优化模型

      // Gemini 2.0 系列 (最新功能)
      'gemini-2.0-flash',         // 最新功能和速度
      'gemini-2.0-flash-lite',    // 2.0轻量版

      // Gemini 1.5 系列 (兼容性保留)
      'gemini-1.5-flash',         // 快速多模态模型
      'gemini-1.5-flash-8b',      // 小型模型
      'gemini-1.5-pro'            // 中型多模态模型
    ];

    if (!supportedModels.includes(model)) {
      return errorResponse(`Unsupported model: ${model}. Supported models: ${supportedModels.join(', ')}`, 400);
    }
    
    // 验证消息格式
    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse('Messages must be a non-empty array', 400);
    }

    // 验证消息内容
    try {
      validateMessages(messages);
    } catch (error) {
      return errorResponse(error.message, 400);
    }
    
    // 生成请求 ID
    const requestId = generateId('chatcmpl-', 29);
    
    try {
      // 选择 Gemini API Key
      const keyInfo = await selectGeminiKey(env);
      
      // 转换请求格式
      const geminiRequest = convertToGeminiRequest({
        model,
        messages,
        stream,
        ...otherParams
      });
      
      // 调用 Gemini API
      const result = await callGeminiWithRetry(env, keyInfo, model, geminiRequest, stream);
      
      if (stream) {
        // 处理流式响应
        const streamData = await handleStreamResponse(result.response, model, requestId);
        
        // 记录使用量（流式响应的 token 计算较复杂，这里简化处理）
        await logUsage(env.DB, keyInfo.id, userKey.id, model, 1, 0);
        
        return streamResponse(streamData);
      } else {
        // 处理非流式响应
        const openaiResponse = convertToOpenAIResponse(result.data, model, requestId);
        
        // 记录使用量
        const tokens = openaiResponse.usage?.total_tokens || 0;
        await logUsage(env.DB, keyInfo.id, userKey.id, model, 1, tokens);
        
        return jsonResponse(openaiResponse);
      }
      
    } catch (error) {
      console.error('Chat completion error:', error);
      
      // 尝试故障转移
      if (error.keyId) {
        try {
          const fallbackKey = await fastFailover(env, error.keyId);
          
          // 使用备用密钥重试
          const geminiRequest = convertToGeminiRequest({
            model,
            messages,
            stream,
            ...otherParams
          });
          
          const result = await callGeminiWithRetry(env, fallbackKey, model, geminiRequest, stream);
          
          if (stream) {
            const streamData = await handleStreamResponse(result.response, model, requestId);
            await logUsage(env.DB, fallbackKey.id, userKey.id, model, 1, 0);
            return streamResponse(streamData);
          } else {
            const openaiResponse = convertToOpenAIResponse(result.data, model, requestId);
            const tokens = openaiResponse.usage?.total_tokens || 0;
            await logUsage(env.DB, fallbackKey.id, userKey.id, model, 1, tokens);
            return jsonResponse(openaiResponse);
          }
          
        } catch (failoverError) {
          console.error('Failover also failed:', failoverError);
          return errorResponse('All API keys failed', 503);
        }
      }
      
      // 使用统一的错误处理
      return handleApiError(error);
    }
    
  } catch (error) {
    console.error('Unexpected error in chat completion:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * 验证消息内容
 */
function validateMessages(messages) {
  for (const message of messages) {
    if (!message.role || !message.content) {
      throw new Error('Each message must have role and content');
    }
    
    if (!['system', 'user', 'assistant'].includes(message.role)) {
      throw new Error('Invalid message role');
    }
  }
}

/**
 * 估算 token 数量
 * 简化的 token 计算，实际应该使用更精确的方法
 */
function estimateTokens(text) {
  if (typeof text !== 'string') {
    text = JSON.stringify(text);
  }
  
  // 简单估算：平均每个 token 约 4 个字符
  return Math.ceil(text.length / 4);
}
