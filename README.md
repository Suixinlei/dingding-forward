# DingTalk Message Forwarder

一个用于转发钉钉机器人消息的 Node.js 服务。

## Docker 部署

1. 构建镜像：
```bash
docker build -t dingtalk-forwarder .
```

2. 运行容器（注入环境变量）：
```bash
docker run -d \
  -p 8787:8787 \
  -e OUTGOING_SECRET="your-outgoing-secret" \
  -e SEND_URL_1="https://oapi.dingtalk.com/robot/send?access_token=your-token-1" \
  -e BOT_SEC_1="your-bot-secret-1" \
  -e SEND_URL_2="https://oapi.dingtalk.com/robot/send?access_token=your-token-2" \
  -e BOT_SEC_2="your-bot-secret-2" \
  dingtalk-forwarder
```

或者使用 docker-compose：

```yaml
# docker-compose.yml
version: '3'
services:
  app:
    build: .
    ports:
      - "8787:8787"
    environment:
      - OUTGOING_SECRET=your-outgoing-secret
      - SEND_URL_1=https://oapi.dingtalk.com/robot/send?access_token=your-token-1
      - BOT_SEC_1=your-bot-secret-1
      - SEND_URL_2=https://oapi.dingtalk.com/robot/send?access_token=your-token-2
      - BOT_SEC_2=your-bot-secret-2
```

然后运行：
```bash
docker-compose up -d
```

你也可以创建一个 `.env` 文件来管理环境变量：

```env
OUTGOING_SECRET=your-outgoing-secret
SEND_URL_1=https://oapi.dingtalk.com/robot/send?access_token=your-token-1
BOT_SEC_1=your-bot-secret-1
SEND_URL_2=https://oapi.dingtalk.com/robot/send?access_token=your-token-2
BOT_SEC_2=your-bot-secret-2
```

然后在运行时引用：
```bash
docker run --env-file .env -p 8787:8787 dingtalk-forwarder
```

或在 docker-compose.yml 中引用：
```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - "8787:8787"
    env_file:
      - .env
```

## 环境变量说明

- `OUTGOING_SECRET`: 机器人安全设置中的加签密钥
- `SEND_URL_1`: 第一个机器人的 Webhook 地址
- `BOT_SEC_1`: 第一个机器人的安全密钥
- `SEND_URL_2`: 第二个机器人的 Webhook 地址
- `BOT_SEC_2`: 第二个机器人的安全密钥

## API 接口

### 健康检查
```
GET /
```
返回简单的问候消息，用于检查服务是否正常运行。

### 消息转发接口

1. 从机器人1转发到机器人2
```
POST /api/from-1-to-2
```

2. 从机器人2转发到机器人1
```
POST /api/from-2-to-1
```

请求体格式应符合钉钉机器人消息格式规范。

## License

MIT