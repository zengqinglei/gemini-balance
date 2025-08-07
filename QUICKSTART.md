# 🚀 Gemini Balance 快速开始指南

这是一个 5 分钟快速部署指南，帮你快速上手 Gemini Balance Cloudflare Worker 版本。

## 📋 前置要求

1. **Cloudflare 账户** - [免费注册](https://dash.cloudflare.com/sign-up)
2. **Google AI Studio 账户** - [获取 Gemini API Key](https://makersuite.google.com/)
3. **Node.js** - [下载安装](https://nodejs.org/)

## ⚡ 一键部署

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 克隆并部署

```bash
# 克隆项目
git clone <your-repo-url>
cd gemini-balance

# 一键部署（自动创建资源并部署）
./deploy.sh
```

按照脚本提示操作，选择 `y` 创建新资源。

### 4. 配置 API Keys

部署完成后：

1. 访问管理界面：`https://your-worker.your-subdomain.workers.dev/admin.html`
2. 使用管理员密钥：`admin-key`
3. 在"密钥管理"页面添加你的 Gemini API Key
4. 生成用户访问密钥

### 5. 测试 API

```bash
# 更新测试脚本中的 URL 和密钥
nano test.js

# 运行测试
node test.js
```

## 🎯 使用示例

### Python (OpenAI SDK)

```python
import openai

client = openai.OpenAI(
    api_key="your-user-key",
    base_url="https://your-worker.your-subdomain.workers.dev/v1"
)

response = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### JavaScript

```javascript
const response = await fetch('https://your-worker.your-subdomain.workers.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-user-key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gemini-2.5-flash',
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### cURL

```bash
curl -X POST https://your-worker.your-subdomain.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer your-user-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## 🔧 常见问题

### Q: 部署失败怎么办？

A: 检查以下几点：
- 确保已登录 Cloudflare：`wrangler whoami`
- 检查网络连接
- 确保有足够的 Cloudflare 权限

### Q: API 调用返回 401 错误？

A: 检查以下几点：
- 确保使用了正确的用户密钥
- 密钥格式：`Bearer your-user-key`
- 确保密钥未过期或被禁用

### Q: 没有可用的 API Keys？

A: 需要先添加 Gemini API Keys：
1. 访问管理界面
2. 使用管理员密钥登录
3. 在密钥管理页面添加 Gemini API Key

### Q: 如何获取 Gemini API Key？

A: 
1. 访问 [Google AI Studio](https://makersuite.google.com/)
2. 登录 Google 账户
3. 创建新的 API Key
4. 复制以 `AIzaSy` 开头的密钥

### Q: 如何修改管理员密钥？

A: 编辑 `src/services/auth.js` 文件中的 `checkAdminPermission` 函数。

## 📊 监控和维护

### 健康检查

```bash
curl https://your-worker.your-subdomain.workers.dev/health
```

### 查看日志

```bash
wrangler tail
```

### 更新代码

```bash
# 修改代码后重新部署
wrangler deploy
```

### 数据库操作

```bash
# 查看数据库内容
wrangler d1 execute gemini-balance --command="SELECT * FROM gemini_keys"

# 备份数据库
wrangler d1 export gemini-balance --output=backup.sql
```

## 💰 成本控制

Cloudflare Workers 免费额度：
- **100,000 请求/天**
- **10ms CPU 时间/请求**
- **D1**: 100,000 读取/天，1,000 写入/天
- **KV**: 100,000 读取/天，1,000 写入/天

对于个人使用，免费额度通常足够。

## 🔒 安全建议

1. **修改默认管理员密钥**
2. **定期轮换 API Keys**
3. **监控使用量和费用**
4. **设置适当的速率限制**
5. **不要在公共仓库中提交敏感信息**

## 📚 更多资源

- [完整文档](./README.md)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Google Gemini API 文档](https://ai.google.dev/docs)
- [OpenAI API 兼容性](https://platform.openai.com/docs/api-reference)

## 🆘 获取帮助

如果遇到问题：

1. 检查 [常见问题](#-常见问题)
2. 查看 Worker 日志：`wrangler tail`
3. 访问管理界面检查系统状态
4. 提交 Issue 到项目仓库

---

🎉 **恭喜！你已经成功部署了 Gemini Balance！**

现在你可以享受高性能、多密钥轮询的 Gemini API 代理服务了！
