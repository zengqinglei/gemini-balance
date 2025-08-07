#!/bin/bash

# Gemini Balance Cloudflare Worker 部署脚本

set -e

echo "🌟 Gemini Balance Cloudflare Worker 部署脚本"
echo "============================================"

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI 未安装，请先安装："
    echo "npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
if ! wrangler whoami &> /dev/null; then
    echo "❌ 请先登录 Cloudflare："
    echo "wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI 已就绪"

# 检查配置文件
if [ ! -f "wrangler.toml" ]; then
    echo "❌ 未找到 wrangler.toml 配置文件"
    exit 1
fi

echo "✅ 配置文件检查通过"

# 询问是否创建新的数据库和 KV
read -p "是否需要创建新的 D1 数据库和 KV 存储？(y/N): " create_resources

if [[ $create_resources =~ ^[Yy]$ ]]; then
    echo "📦 创建 Cloudflare 资源..."
    
    # 创建 D1 数据库
    echo "创建 D1 数据库..."
    DB_OUTPUT=$(wrangler d1 create gemini-balance)
    DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)
    
    if [ -n "$DB_ID" ]; then
        echo "✅ D1 数据库创建成功: $DB_ID"
        
        # 更新 wrangler.toml 中的数据库 ID
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/database_id = \"your-database-id\"/database_id = \"$DB_ID\"/g" wrangler.toml
            sed -i '' "s/database_id = \"your-dev-database-id\"/database_id = \"$DB_ID\"/g" wrangler.toml
            sed -i '' "s/database_id = \"your-prod-database-id\"/database_id = \"$DB_ID\"/g" wrangler.toml
        else
            # Linux
            sed -i "s/database_id = \"your-database-id\"/database_id = \"$DB_ID\"/g" wrangler.toml
            sed -i "s/database_id = \"your-dev-database-id\"/database_id = \"$DB_ID\"/g" wrangler.toml
            sed -i "s/database_id = \"your-prod-database-id\"/database_id = \"$DB_ID\"/g" wrangler.toml
        fi
    else
        echo "❌ D1 数据库创建失败"
        exit 1
    fi
    
    # 创建 KV 存储
    echo "创建 KV 存储..."
    KV_OUTPUT=$(wrangler kv:namespace create "KV")
    KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    
    if [ -n "$KV_ID" ]; then
        echo "✅ KV 存储创建成功: $KV_ID"
        
        # 更新 wrangler.toml 中的 KV ID
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/id = \"your-kv-id\"/id = \"$KV_ID\"/g" wrangler.toml
            sed -i '' "s/id = \"your-dev-kv-id\"/id = \"$KV_ID\"/g" wrangler.toml
            sed -i '' "s/id = \"your-prod-kv-id\"/id = \"$KV_ID\"/g" wrangler.toml
        else
            # Linux
            sed -i "s/id = \"your-kv-id\"/id = \"$KV_ID\"/g" wrangler.toml
            sed -i "s/id = \"your-dev-kv-id\"/id = \"$KV_ID\"/g" wrangler.toml
            sed -i "s/id = \"your-prod-kv-id\"/id = \"$KV_ID\"/g" wrangler.toml
        fi
    else
        echo "❌ KV 存储创建失败"
        exit 1
    fi
    
    echo "✅ Cloudflare 资源创建完成"
fi

# 初始化数据库
echo "📊 初始化数据库..."
if wrangler d1 execute gemini-balance --file=./schema.sql; then
    echo "✅ 数据库初始化成功"
else
    echo "❌ 数据库初始化失败"
    exit 1
fi

# 部署 Worker
echo "🚀 部署 Cloudflare Worker..."
if wrangler deploy; then
    echo "✅ Worker 部署成功"
else
    echo "❌ Worker 部署失败"
    exit 1
fi

# 获取部署的 URL
WORKER_URL=$(wrangler whoami 2>/dev/null | grep -o 'https://[^/]*\.workers\.dev' | head -1)
if [ -z "$WORKER_URL" ]; then
    WORKER_URL="https://your-worker.your-subdomain.workers.dev"
fi

echo ""
echo "🎉 部署完成！"
echo "============================================"
echo "Worker URL: $WORKER_URL"
echo "管理界面: $WORKER_URL/admin.html"
echo "API 端点: $WORKER_URL/v1/chat/completions"
echo "健康检查: $WORKER_URL/health"
echo ""
echo "📝 下一步操作："
echo "1. 访问管理界面添加 Gemini API Keys"
echo "2. 生成用户访问密钥"
echo "3. 测试 API 功能"
echo ""
echo "📖 使用示例："
echo "curl -X POST $WORKER_URL/v1/chat/completions \\"
echo "  -H \"Authorization: Bearer your-user-key\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"model\":\"gemini-2.5-flash\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}]}'"
echo ""
echo "🔐 管理员密钥: admin-key (请在生产环境中修改)"

# 询问是否打开管理界面
read -p "是否在浏览器中打开管理界面？(y/N): " open_browser

if [[ $open_browser =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        # macOS
        open "$WORKER_URL/admin.html"
    elif command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "$WORKER_URL/admin.html"
    elif command -v start &> /dev/null; then
        # Windows
        start "$WORKER_URL/admin.html"
    else
        echo "请手动访问: $WORKER_URL/admin.html"
    fi
fi

echo ""
echo "✨ 感谢使用 Gemini Balance！"
