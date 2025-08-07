/**
 * Gemini Balance API 测试脚本
 * 用于测试部署的 API 功能
 */

// 配置
const API_BASE = 'https://your-worker.your-subdomain.workers.dev'; // 替换为你的 Worker URL
const USER_API_KEY = 'your-user-key'; // 替换为生成的用户密钥
const ADMIN_KEY = 'admin-key'; // 管理员密钥

/**
 * API 调用封装
 */
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 测试健康检查
 */
async function testHealth() {
  console.log('🔍 测试健康检查...');
  
  const result = await apiCall('/health');
  
  if (result.success) {
    console.log('✅ 健康检查通过');
    console.log(`   状态: ${result.data.status}`);
    console.log(`   响应时间: ${result.data.response_time_ms}ms`);
    console.log(`   可用密钥: ${result.data.checks.available_keys}`);
  } else {
    console.log('❌ 健康检查失败');
    console.log(`   错误: ${result.error || result.data?.error?.message}`);
  }
  
  console.log('');
}

/**
 * 测试聊天完成 API
 */
async function testChatCompletion() {
  console.log('💬 测试聊天完成 API...');
  
  const result = await apiCall('/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${USER_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with a short greeting.'
        }
      ],
      max_tokens: 100
    })
  });
  
  if (result.success) {
    console.log('✅ 聊天完成 API 测试通过');
    console.log(`   模型: ${result.data.model}`);
    console.log(`   响应: ${result.data.choices[0].message.content}`);
    console.log(`   Token 使用: ${result.data.usage.total_tokens}`);
  } else {
    console.log('❌ 聊天完成 API 测试失败');
    console.log(`   状态码: ${result.status}`);
    console.log(`   错误: ${result.error || result.data?.error?.message}`);
  }
  
  console.log('');
}

/**
 * 测试流式响应
 */
async function testStreamCompletion() {
  console.log('🌊 测试流式响应...');
  
  try {
    const response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${USER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: 'Count from 1 to 5, one number per line.'
          }
        ],
        stream: true
      })
    });
    
    if (response.ok) {
      console.log('✅ 流式响应连接成功');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              console.log('   流式响应完成');
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                process.stdout.write(content);
                chunks++;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
      console.log(`\n   接收到 ${chunks} 个数据块`);
    } else {
      console.log('❌ 流式响应测试失败');
      console.log(`   状态码: ${response.status}`);
    }
  } catch (error) {
    console.log('❌ 流式响应测试失败');
    console.log(`   错误: ${error.message}`);
  }
  
  console.log('');
}

/**
 * 测试管理 API
 */
async function testAdminAPI() {
  console.log('🔧 测试管理 API...');
  
  // 测试获取状态
  const statusResult = await apiCall('/admin/status', {
    headers: {
      'Authorization': ADMIN_KEY
    }
  });
  
  if (statusResult.success) {
    console.log('✅ 管理状态 API 测试通过');
    console.log(`   服务状态: ${statusResult.data.status}`);
    console.log(`   总密钥数: ${statusResult.data.statistics?.total_keys || 0}`);
  } else {
    console.log('❌ 管理状态 API 测试失败');
    console.log(`   错误: ${statusResult.error || statusResult.data?.error?.message}`);
  }
  
  // 测试获取配置
  const configResult = await apiCall('/admin/config', {
    headers: {
      'Authorization': ADMIN_KEY
    }
  });
  
  if (configResult.success) {
    console.log('✅ 配置 API 测试通过');
    console.log(`   负载均衡策略: ${configResult.data.data?.load_balance_strategy}`);
  } else {
    console.log('❌ 配置 API 测试失败');
    console.log(`   错误: ${configResult.error || configResult.data?.error?.message}`);
  }
  
  console.log('');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 开始测试 Gemini Balance API');
  console.log('================================');
  console.log(`API 地址: ${API_BASE}`);
  console.log('');
  
  await testHealth();
  await testChatCompletion();
  await testStreamCompletion();
  await testAdminAPI();
  
  console.log('🎉 测试完成！');
  console.log('');
  console.log('💡 提示:');
  console.log('- 如果聊天 API 测试失败，请确保已添加 Gemini API Key 并生成用户密钥');
  console.log('- 如果管理 API 测试失败，请检查管理员密钥是否正确');
  console.log('- 更多信息请查看管理界面: ' + API_BASE + '/admin.html');
}

// 检查是否在 Node.js 环境中运行
if (typeof window === 'undefined') {
  // Node.js 环境
  if (API_BASE.includes('your-worker')) {
    console.log('❌ 请先更新 test.js 中的 API_BASE 和 USER_API_KEY');
    process.exit(1);
  }
  
  runAllTests().catch(console.error);
} else {
  // 浏览器环境
  console.log('请在 Node.js 环境中运行此测试脚本');
}
