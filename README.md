# Gemini Balance - Cloudflare Worker 版本

高性能 Gemini API 代理服务，支持多密钥轮询和负载均衡，部署在 Cloudflare Workers 平台。

## ✨ 特性

- 🔄 **多密钥轮询**: 支持多个 Gemini API Key 自动轮询，突破单Key限制
- ⚡ **高性能**: 基于 Cloudflare Workers，全球边缘计算，响应速度快
- 🛡️ **故障转移**: 自动检测密钥健康状态，快速故障转移
- 🔐 **安全认证**: 用户密钥管理，支持速率限制
- 📊 **负载均衡**: 多种负载均衡策略（自适应、最少使用、轮询）
- 🎯 **OpenAI 兼容**: 完全兼容 OpenAI API 格式
- 🌐 **管理界面**: 简洁的 Web 管理界面
- 💰 **免费部署**: 利用 Cloudflare 免费额度

## 🚀 快速开始

### 1. 准备工作

确保你有以下账户：
- [Cloudflare 账户](https://dash.cloudflare.com/sign-up)
- [Google AI Studio 账户](https://makersuite.google.com/) (获取 Gemini API Key)

### 2. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 3. 登录 Cloudflare

```bash
wrangler login
```

### 4. 克隆项目

```bash
git clone <your-repo-url>
cd gemini-balance
```

### 5. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create gemini-balance

# 记录返回的 database_id，更新 wrangler.toml 中的 database_id
```

### 6. 创建 KV 存储

```bash
# 创建 KV 命名空间
wrangler kv:namespace create "KV"

# 记录返回的 id，更新 wrangler.toml 中的 KV id
```

### 7. 更新配置

编辑 `wrangler.toml` 文件，替换以下内容：
- `database_id`: 步骤5中获得的数据库ID
- `id`: 步骤6中获得的KV ID

### 8. 初始化数据库

```bash
wrangler d1 execute gemini-balance --file=./schema.sql
```

### 9. 部署 Worker

```bash
wrangler deploy
```

### 10. 部署管理界面 (可选)

将 `admin/` 目录部署到 Cloudflare Pages：

```bash
# 在 admin 目录中
wrangler pages deploy admin --project-name gemini-balance-admin
```

## 📖 使用方法

### API 使用

部署完成后，你可以使用 OpenAI SDK 或任何兼容的客户端：

```python
import openai

client = openai.OpenAI(
    api_key="your-user-key",  # 通过管理界面生成
    base_url="https://your-worker.your-subdomain.workers.dev/v1"
)

response = client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ]
)

print(response.choices[0].message.content)
```

### 管理界面

访问 `https://your-worker.your-subdomain.workers.dev/` 查看管理界面。

默认管理员密钥：`admin-key` (生产环境请修改)

## 🔧 配置说明

### 环境变量

在 `wrangler.toml` 中配置：

```toml
[vars]
ENVIRONMENT = "production"
```

### 负载均衡策略

- **adaptive**: 自适应策略，综合考虑健康状态、成功率和响应时间
- **least_used**: 最少使用策略，优先使用请求次数最少的密钥
- **round_robin**: 轮询策略，按顺序轮流使用密钥

### 支持的模型

#### Gemini 2.5 系列 (推荐)
- `gemini-2.5-pro`: 最先进的推理模型，具有最高响应准确性
- `gemini-2.5-flash`: 最佳性价比模型，具有完整功能
- `gemini-2.5-flash-lite`: 成本优化模型，高吞吐量

#### Gemini 2.0 系列 (最新功能)
- `gemini-2.0-flash`: 最新功能和速度，原生工具使用
- `gemini-2.0-flash-lite`: 2.0轻量版，成本效率优化

#### Gemini 1.5 系列 (兼容性保留)
- `gemini-1.5-flash`: 快速多模态模型
- `gemini-1.5-flash-8b`: 小型模型，适合高频任务
- `gemini-1.5-pro`: 中型多模态模型，复杂推理

## 📊 监控和管理

### 健康检查

- `GET /health` - 服务健康状态
- `GET /status` - 详细系统状态

### 管理 API

需要管理员权限（Authorization: admin-key）：

- `GET /admin/status` - 管理状态
- `GET /admin/keys/gemini` - 获取 Gemini 密钥列表
- `POST /admin/keys/gemini` - 添加 Gemini 密钥
- `DELETE /admin/keys/gemini/{id}` - 删除 Gemini 密钥
- `POST /admin/keys/user` - 生成用户密钥
- `GET /admin/config` - 获取配置
- `POST /admin/config` - 更新配置
- `GET /admin/stats` - 获取统计信息

## 🔒 安全注意事项

1. **修改管理员密钥**: 在生产环境中修改默认的管理员密钥
2. **密钥保护**: 妥善保管 Gemini API Key 和用户密钥
3. **访问控制**: 考虑添加 IP 白名单或其他访问控制
4. **监控使用**: 定期检查 API 使用情况和费用

## 💰 成本估算

### Cloudflare Workers 免费额度

- **请求数**: 每天 100,000 次请求
- **CPU 时间**: 每天 10ms × 100,000 = 1,000 秒
- **D1 数据库**: 每天 100,000 次读取，1,000 次写入
- **KV 存储**: 每天 100,000 次读取，1,000 次写入

对于大多数个人和小型项目，免费额度足够使用。

### 超出免费额度的费用

- **Workers**: $0.50 / 百万请求
- **D1**: $0.001 / 1000 次读取，$1.00 / 百万次写入
- **KV**: $0.50 / 百万次读取，$5.00 / 百万次写入

## 🛠️ 开发

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 数据库操作

```bash
# 执行 SQL 文件
wrangler d1 execute gemini-balance --file=./schema.sql

# 查看数据库内容
wrangler d1 execute gemini-balance --command="SELECT * FROM gemini_keys"
```

### 日志查看

```bash
# 实时查看日志
wrangler tail
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- [Google Gemini](https://deepmind.google/technologies/gemini/) - 强大的AI模型
- [Cloudflare Workers](https://workers.cloudflare.com/) - 优秀的边缘计算平台
- 原项目 [Gemini-api-proxy](https://github.com/Arain119/Gemini-api-proxy) - 提供了核心功能设计思路
