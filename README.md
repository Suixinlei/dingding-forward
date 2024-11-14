# DingTalk Message Forwarder

一个基于 Cloudflare Workers 的钉钉群消息转发服务，支持多种消息类型的转发，并保持原始消息格式。

## 功能特点

- 支持多种钉钉消息类型的转发：
  - 文本消息 (text)
  - Markdown 消息
  - 链接消息 (link)
  - 卡片消息 (actionCard)
  - 图文消息 (feedCard)
- 自动添加发送者信息
- 完整的安全验证机制
- 基于 Cloudflare Workers 的无服务器部署
- 支持 CORS 跨域请求
- 自动维护消息格式

## 快速开始

### 前置要求

- Cloudflare 账号
- 钉钉机器人配置权限
- Node.js 环境 (用于本地开发)

### 安装部署

1. 克隆项目：
```bash
git clone https://github.com/yourusername/dingding-forward.git
cd dingding-forward
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
创建 `.dev.vars` 文件（本地开发）或在 Cloudflare Workers 控制台配置以下环境变量：
```
OUTGOING_1_SECRET=你的群机器人outgoing密钥
SEND_URL_1=目标群机器人webhook地址
BOT_1_SECRET=目标群机器人签名密钥
```

4. 部署到 Cloudflare Workers：
```bash
wrangler deploy
```

### 配置钉钉机器人

1. 源群机器人配置：
   - 创建 Outgoing 机器人
   - 配置安全设置为"加签"模式
   - 记录 outgoing token
   - 配置回调地址为 Workers URL

2. 目标群机器人配置：
   - 创建自定义机器人
   - 配置安全设置为"加签"模式
   - 记录 webhook 地址和签名密钥

## 开发调试

### 本地开发

1. 启动本地开发服务器：
```bash
wrangler dev
```

2. 使用 ngrok 进行本地调试：
```bash
ngrok http 8787
```

3. 将 ngrok 生成的地址配置到钉钉机器人回调地址

### 测试消息转发

可以使用 curl 测试消息转发：

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "timestamp: $(date +%s000)" \
  -H "sign: YOUR_SIGN" \
  -d '{"msgtype":"text","text":{"content":"测试消息"}}' \
  https://your-worker.workers.dev
```

## 支持的消息类型

1. 文本消息
```json
{
  "msgtype": "text",
  "text": {
    "content": "消息内容"
  }
}
```

2. Markdown 消息
```json
{
  "msgtype": "markdown",
  "markdown": {
    "title": "标题",
    "text": "### 内容"
  }
}
```

3. 链接消息
```json
{
  "msgtype": "link",
  "link": {
    "title": "标题",
    "text": "描述",
    "picUrl": "图片URL",
    "messageUrl": "跳转URL"
  }
}
```

更多消息类型请参考[钉钉开发文档](https://open.dingtalk.com/document/robots/custom-robot-access#title-72m-8ag-pqw)。

## 注意事项

1. 安全性
   - 请妥善保管各类密钥
   - 建议定期更换密钥
   - 使用 HTTPS 进行通信

2. 限制
   - 消息内容需符合钉钉机器人规范
   - 注意钉钉机器人的频率限制
   - 部分高级功能可能需要钉钉企业版

3. 故障排查
   - 检查环境变量配置
   - 验证签名计算是否正确
   - 查看 Cloudflare Workers 日志

## 贡献指南

欢迎提交 Issue 和 Pull Request。在提交 PR 前，请确保：

- 代码符合项目规范
- 添加必要的测试
- 更新相关文档

## 许可证

MIT License

## 联系方式

如有问题，请提交 Issue 或联系维护者。