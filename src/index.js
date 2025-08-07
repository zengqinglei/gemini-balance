/**
 * Gemini Balance - Cloudflare Worker 版本
 * 提供 Gemini API 代理服务，支持多密钥轮询和负载均衡
 */

import { handleChatCompletion } from './handlers/chat.js';
import { handleAdmin } from './handlers/admin.js';
import { handleHealth } from './handlers/health.js';
import { corsHeaders, jsonResponse, errorResponse } from './utils/response.js';
import { serveAdminInterface, serveAdminCSS, serveAdminJS } from './utils/static.js';

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // 路由处理
      if (path === '/health' || path === '/wake') {
        return handleHealth(request, env);
      }

      if (path === '/status') {
        return jsonResponse({
          status: 'ok',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          models: ['gemini-2.5-flash', 'gemini-2.5-pro']
        });
      }

      // OpenAI 兼容的聊天完成 API
      if (path === '/v1/chat/completions') {
        return handleChatCompletion(request, env);
      }

      // 静态文件服务 (管理界面) - 必须在管理 API 之前处理
      if (path === '/admin.html' || path === '/admin') {
        return serveAdminInterface();
      }

      if (path === '/admin/style.css') {
        return serveAdminCSS();
      }

      if (path === '/admin/script.js') {
        return serveAdminJS();
      }

      // 管理 API
      if (path.startsWith('/admin/')) {
        return handleAdmin(request, env);
      }

      // 根路径返回简单的欢迎信息
      if (path === '/') {
        return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Gemini Balance API</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .method { color: #007acc; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌟 Gemini Balance API</h1>
        <p>高性能 Gemini API 代理服务 - Cloudflare Worker 版本</p>
    </div>

    <h2>API 端点</h2>
    <div class="endpoint">
        <span class="method">POST</span> /v1/chat/completions - OpenAI 兼容的聊天完成 API
    </div>
    <div class="endpoint">
        <span class="method">GET</span> /health - 健康检查
    </div>
    <div class="endpoint">
        <span class="method">GET</span> /status - 服务状态
    </div>
    <div class="endpoint">
        <span class="method">*</span> /admin/* - 管理 API
    </div>

    <h2>使用方法</h2>
    <p>使用 OpenAI SDK 或兼容的客户端，将 base_url 设置为此服务的地址即可。</p>

    <h2>管理界面</h2>
    <p><a href="/admin.html">点击这里访问管理界面</a></p>
</body>
</html>
        `, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders
          }
        });
      }

      // 404 处理
      return errorResponse('Not Found', 404);

    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal Server Error', 500);
    }
  }
};
