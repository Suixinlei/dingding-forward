import express from 'express';  
import { Miniflare } from 'miniflare';  

const app = express();  
const port = process.env.PORT || 3000;  

// 初始化 Miniflare  
const mf = new Miniflare({  
  modules: true,  
  scriptPath: "./worker.js",  
  bindings: {  
    // 在这里添加你的环境变量  
    API_KEY: process.env.API_KEY,  
  },  
});  

// 处理所有请求  
app.all('*', async (req, res) => {  
  try {  
    // 构造请求  
    const url = new URL(req.url, `http://${req.headers.host}`);  
    const request = new Request(url.toString(), {  
      method: req.method,  
      headers: req.headers,  
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,  
    });  

    // 执行 worker  
    const response = await mf.dispatchFetch(request);  
    
    // 设置响应头  
    for (const [key, value] of response.headers) {  
      res.set(key, value);  
    }  
    
    // 发送响应  
    res.status(response.status);  
    const buffer = await response.arrayBuffer();  
    res.send(Buffer.from(buffer));  
  } catch (error) {  
    console.error('Error:', error);  
    res.status(500).send('Internal Server Error');  
  }  
});  

app.listen(port, () => {  
  console.log(`Server running at http://localhost:${port}`);  
});