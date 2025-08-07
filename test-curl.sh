#!/bin/bash

# Gemini Balance API CURL 测试脚本
# 使用方法: ./test-curl.sh [GEMINI_API_KEY] [USER_KEY]

set -e

# 配置
API_BASE="https://gemini-balance.jiayouilin.workers.dev"
ADMIN_KEY="admin-key"
GEMINI_API_KEY="${1:-}"
USER_KEY="${2:-}"

echo "🧪 Gemini Balance API CURL 测试"
echo "================================"
echo "API 地址: $API_BASE"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试函数
test_api() {
    local name="$1"
    local method="$2"
    local url="$3"
    local headers="$4"
    local data="$5"
    
    echo -e "${BLUE}测试: $name${NC}"
    echo "请求: $method $url"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" $headers -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" $headers)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ 成功 ($http_code)${NC}"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    else
        echo -e "${RED}❌ 失败 ($http_code)${NC}"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    fi
    echo ""
}

# 1. 基础健康检查
echo -e "${YELLOW}=== 1. 基础健康检查 ===${NC}"
test_api "健康检查" "GET" "$API_BASE/health" ""
test_api "服务状态" "GET" "$API_BASE/status" ""

# 2. 管理 API 测试
echo -e "${YELLOW}=== 2. 管理 API 测试 ===${NC}"
test_api "管理状态" "GET" "$API_BASE/admin/status" "-H 'Authorization: $ADMIN_KEY'"
test_api "获取配置" "GET" "$API_BASE/admin/config" "-H 'Authorization: $ADMIN_KEY'"
test_api "获取统计" "GET" "$API_BASE/admin/stats" "-H 'Authorization: $ADMIN_KEY'"
test_api "获取 Gemini 密钥" "GET" "$API_BASE/admin/keys/gemini" "-H 'Authorization: $ADMIN_KEY'"

# 3. 添加 Gemini API 密钥（如果提供）
if [ -n "$GEMINI_API_KEY" ]; then
    echo -e "${YELLOW}=== 3. 添加 Gemini API 密钥 ===${NC}"
    test_api "添加 Gemini 密钥" "POST" "$API_BASE/admin/keys/gemini" \
        "-H 'Authorization: $ADMIN_KEY' -H 'Content-Type: application/json'" \
        "{\"key\": \"$GEMINI_API_KEY\"}"
fi

# 4. 生成用户密钥
echo -e "${YELLOW}=== 4. 生成用户密钥 ===${NC}"
response=$(curl -s -X POST "$API_BASE/admin/keys/user" \
    -H "Authorization: $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d '{"name": "Test User"}')

if echo "$response" | grep -q "success.*true"; then
    GENERATED_USER_KEY=$(echo "$response" | jq -r '.data.key' 2>/dev/null)
    echo -e "${GREEN}✅ 用户密钥生成成功${NC}"
    echo "生成的密钥: $GENERATED_USER_KEY"
    
    # 如果没有提供用户密钥，使用生成的密钥
    if [ -z "$USER_KEY" ]; then
        USER_KEY="$GENERATED_USER_KEY"
    fi
else
    echo -e "${RED}❌ 用户密钥生成失败${NC}"
    echo "$response"
fi
echo ""

# 5. 聊天 API 测试（如果有用户密钥）
if [ -n "$USER_KEY" ]; then
    echo -e "${YELLOW}=== 5. 聊天 API 测试 ===${NC}"
    echo "使用用户密钥: ${USER_KEY:0:20}..."
    
    # 基本聊天测试
    test_api "基本聊天" "POST" "$API_BASE/v1/chat/completions" \
        "-H 'Authorization: Bearer $USER_KEY' -H 'Content-Type: application/json'" \
        '{
            "model": "gemini-2.5-flash",
            "messages": [
                {"role": "user", "content": "Hello! Please respond with just \"Hi there!\""}
            ],
            "max_tokens": 50
        }'
    
    # 带系统消息的测试
    test_api "系统消息测试" "POST" "$API_BASE/v1/chat/completions" \
        "-H 'Authorization: Bearer $USER_KEY' -H 'Content-Type: application/json'" \
        '{
            "model": "gemini-2.5-flash",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "What is 2+2?"}
            ],
            "temperature": 0.1,
            "max_tokens": 100
        }'
    
    # Pro 模型测试
    test_api "Pro 模型测试" "POST" "$API_BASE/v1/chat/completions" \
        "-H 'Authorization: Bearer $USER_KEY' -H 'Content-Type: application/json'" \
        '{
            "model": "gemini-2.5-pro",
            "messages": [
                {"role": "user", "content": "Explain AI in one sentence."}
            ],
            "max_tokens": 100
        }'
else
    echo -e "${YELLOW}=== 5. 跳过聊天 API 测试 ===${NC}"
    echo "没有可用的用户密钥"
    echo ""
fi

# 6. 错误测试
echo -e "${YELLOW}=== 6. 错误处理测试 ===${NC}"

# 无效密钥测试
test_api "无效密钥测试" "POST" "$API_BASE/v1/chat/completions" \
    "-H 'Authorization: Bearer invalid-key' -H 'Content-Type: application/json'" \
    '{
        "model": "gemini-2.5-flash",
        "messages": [{"role": "user", "content": "Hello"}]
    }'

# 无效模型测试
if [ -n "$USER_KEY" ]; then
    test_api "无效模型测试" "POST" "$API_BASE/v1/chat/completions" \
        "-H 'Authorization: Bearer $USER_KEY' -H 'Content-Type: application/json'" \
        '{
            "model": "invalid-model",
            "messages": [{"role": "user", "content": "Hello"}]
        }'
fi

# 缺少字段测试
if [ -n "$USER_KEY" ]; then
    test_api "缺少字段测试" "POST" "$API_BASE/v1/chat/completions" \
        "-H 'Authorization: Bearer $USER_KEY' -H 'Content-Type: application/json'" \
        '{"model": "gemini-2.5-flash"}'
fi

echo -e "${GREEN}🎉 测试完成！${NC}"
echo ""
echo "💡 使用提示:"
echo "1. 获取 Gemini API 密钥: https://makersuite.google.com/"
echo "2. 运行完整测试: ./test-curl.sh YOUR_GEMINI_API_KEY"
echo "3. 查看管理界面: $API_BASE/admin.html"
