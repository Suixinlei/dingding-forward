const env = require('./config');
const express = require('express');
const forward = require('./forward');
const cors = require('cors');

const app = express();

// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 配置
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// 路由处理
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('Hello, World!');
});

app.post('/api/from-1-to-2', async (req, res, next) => {
  try {
    const result = await forward(req, {
      OUTGOING_SECRET: env.OUTGOING_SECRET,
      SEND_URL: env.SEND_URL_2,
      BOT_SECRET: env.BOT_SEC_2,
    });

    console.log('result:', result);
    
    // 假设 forward 函数返回的是 Response 对象，需要适配
    if (result instanceof Response) {
      const body = await result.text();
      res.status(result.status);
      result.headers.forEach((value, key) => {
        res.set(key, value);
      });
      res.send(body);
    } else {
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

app.post('/api/from-2-to-1', async (req, res, next) => {
  try {
    const result = await forward(req, {
      OUTGOING_SECRET: env.OUTGOING_SECRET,
      SEND_URL: env.SEND_URL_1,
      BOT_SECRET: env.BOT_SEC_1,
    });

    console.log('result:', result);
    
    // 假设 forward 函数返回的是 Response 对象，需要适配
    if (result instanceof Response) {
      const body = await result.text();
      res.status(result.status);
      result.headers.forEach((value, key) => {
        res.set(key, value);
      });
      res.send(body);
    } else {
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: err.message || 'Internal Server Error' 
  });
});

// Response polyfill (如果 forward 函数依赖 Response 对象)
if (!global.Response) {
  global.Response = class Response {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status || 200;
      this.headers = new Map(Object.entries(init.headers || {}));
    }

    async text() {
      return this.body?.toString() || '';
    }
  };
}

// 启动服务器
const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

// 未捕获的 Promise rejection 处理
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
