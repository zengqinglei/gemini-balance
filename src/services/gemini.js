/**
 * Gemini API 调用服务
 * 处理与 Google Gemini API 的交互
 */

import { updateKeyPerformance, getConfig } from './database.js';
import { generateId, formatTimestamp } from '../utils/response.js';

/**
 * 将 OpenAI 格式的请求转换为 Gemini 格式
 */
export function convertToGeminiRequest(openaiRequest) {
  const { messages, model, temperature, top_p, max_tokens, stream } = openaiRequest;
  
  // 转换消息格式
  const contents = [];
  let systemInstruction = null;
  
  for (const message of messages) {
    if (message.role === 'system') {
      systemInstruction = { parts: [{ text: message.content }] };
    } else if (message.role === 'user' || message.role === 'assistant') {
      const role = message.role === 'assistant' ? 'model' : 'user';
      
      let parts;
      if (typeof message.content === 'string') {
        parts = [{ text: message.content }];
      } else if (Array.isArray(message.content)) {
        parts = message.content.map(part => {
          if (part.type === 'text') {
            return { text: part.text };
          } else if (part.type === 'image') {
            // 处理图片内容
            if (part.image_url && part.image_url.url) {
              try {
                const url = part.image_url.url;
                // 检查是否是 base64 数据 URL
                if (url.startsWith('data:image/')) {
                  const [header, data] = url.split(',');
                  const mimeType = header.match(/data:(image\/[^;]+)/)?.[1] || 'image/jpeg';

                  return {
                    inlineData: {
                      mimeType,
                      data: data || ''
                    }
                  };
                } else {
                  // 如果是 URL，转换为文本描述
                  return { text: `[Image: ${url}]` };
                }
              } catch (error) {
                console.error('Error processing image:', error);
                return { text: '[Image processing error]' };
              }
            }
          }
          return { text: JSON.stringify(part) };
        });
      } else {
        parts = [{ text: String(message.content) }];
      }
      
      contents.push({ role, parts });
    }
  }
  
  // 构建 Gemini 请求
  const geminiRequest = {
    contents,
    generationConfig: {
      temperature: temperature || 1.0,
      topP: top_p || 1.0,
      maxOutputTokens: max_tokens || 2048,
    }
  };
  
  // 添加系统指令
  if (systemInstruction) {
    geminiRequest.systemInstruction = systemInstruction;
  }
  
  return geminiRequest;
}

/**
 * 将 Gemini 响应转换为 OpenAI 格式
 */
export function convertToOpenAIResponse(geminiResponse, model, requestId) {
  const candidate = geminiResponse.candidates?.[0];
  
  if (!candidate) {
    throw new Error('No valid response from Gemini API');
  }
  
  const content = candidate.content?.parts?.[0]?.text || '';
  const finishReason = mapFinishReason(candidate.finishReason);
  
  // 计算 token 使用量（简化估算）
  const promptTokens = Math.ceil(JSON.stringify(geminiResponse).length / 4);
  const completionTokens = Math.ceil(content.length / 4);
  
  return {
    id: requestId,
    object: 'chat.completion',
    created: formatTimestamp(),
    model: model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: content
      },
      finish_reason: finishReason
    }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  };
}

/**
 * 映射结束原因
 */
function mapFinishReason(geminiReason) {
  const reasonMap = {
    'STOP': 'stop',
    'MAX_TOKENS': 'length',
    'SAFETY': 'content_filter',
    'RECITATION': 'content_filter',
    'OTHER': 'stop'
  };
  
  return reasonMap[geminiReason] || 'stop';
}

/**
 * 调用 Gemini API
 */
export async function callGeminiAPI(apiKey, model, geminiRequest, stream = false) {
  const startTime = Date.now();
  
  try {
    const endpoint = stream 
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(geminiRequest)
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }
    
    if (stream) {
      return {
        response,
        responseTime,
        success: true
      };
    } else {
      const data = await response.json();
      return {
        data,
        responseTime,
        success: true
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Gemini API call failed:', error);
    
    return {
      error: error.message,
      responseTime,
      success: false
    };
  }
}

/**
 * 处理流式响应
 */
export async function handleStreamResponse(response, model, requestId) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const reader = response.body.getReader();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // 流结束，发送最终的结束标记
            const doneChunk = {
              id: requestId,
              object: 'chat.completion.chunk',
              created: formatTimestamp(),
              model: model,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: 'stop'
              }]
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]' || data === '') {
                continue;
              }

              try {
                const geminiChunk = JSON.parse(data);
                const openaiChunk = convertGeminiStreamChunk(geminiChunk, model, requestId);

                if (openaiChunk) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));

                  // 检查是否是最后一个块
                  if (openaiChunk.choices?.[0]?.finish_reason) {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    return;
                  }
                }
              } catch (parseError) {
                console.error('Failed to parse stream chunk:', parseError);
                // 继续处理其他块，不中断流
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream processing error:', error);
        controller.error(error);
      }
    }
  });
  
  return stream;
}

/**
 * 转换 Gemini 流式响应块为 OpenAI 格式
 */
function convertGeminiStreamChunk(geminiChunk, model, requestId) {
  const candidate = geminiChunk.candidates?.[0];
  
  if (!candidate) return null;
  
  const content = candidate.content?.parts?.[0]?.text || '';
  const finishReason = candidate.finishReason ? mapFinishReason(candidate.finishReason) : null;
  
  return {
    id: requestId,
    object: 'chat.completion.chunk',
    created: formatTimestamp(),
    model: model,
    choices: [{
      index: 0,
      delta: content ? { content } : {},
      finish_reason: finishReason
    }]
  };
}

/**
 * 带重试的 Gemini API 调用
 */
export async function callGeminiWithRetry(env, keyInfo, model, geminiRequest, stream = false, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callGeminiAPI(keyInfo.key, model, geminiRequest, stream);
      
      // 更新密钥性能指标
      await updateKeyPerformance(env.DB, keyInfo.id, result.success, result.responseTime);
      
      if (result.success) {
        return result;
      } else {
        lastError = new Error(result.error);
        lastError.keyId = keyInfo.id;
        
        // 如果是客户端错误（4xx），不重试
        if (result.error.includes('400') || result.error.includes('401') || result.error.includes('403')) {
          throw lastError;
        }
      }
    } catch (error) {
      lastError = error;
      lastError.keyId = keyInfo.id;
      
      // 更新密钥性能指标
      await updateKeyPerformance(env.DB, keyInfo.id, false, 0);
      
      console.error(`Attempt ${attempt + 1} failed for key ${keyInfo.id}:`, error.message);
      
      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  throw lastError;
}
