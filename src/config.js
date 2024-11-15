let config = {
  // Docker 环境下从环境变量读取
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_KEY: process.env.API_KEY,
  DB_HOST: process.env.DB_HOST,
  // ... 其他配置
};

// 本地开发环境下尝试加载本地配置
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {
    console.log('No local config found, using default/env values');
  }
} else {
  // 注入到 process.env
  Object.keys(config).forEach(key => {
    if (config[key] !== undefined) {
      process.env[key] = config[key];
    }
  });
}

// 验证必需的环境变量
const requiredVars = [
  'OUTGOING_SECRET',
  'SEND_URL_1',
  'SEND_URL_2',
  'BOT_SEC_1',
  'BOT_SEC_2',
];
const missing = requiredVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

console.log('当前的环境变量:');
console.log(process.env);
console.log('------------------');

module.exports = process.env;
