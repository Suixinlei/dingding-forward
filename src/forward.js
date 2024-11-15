const crypto = require('crypto');

function sendDingMessage(message) {
  // 解析原始消息  
  const parts = message.map(part => {
    if (part.text) {
      return {
        text: part.text.replace('@转发机器人', ''),
      };
    }
    if (part.type === 'picture') {
      return {
        type: 'image',
        // TODO: 需要转换 downloadCode 为真实图片 URL
        // url: `https://image.dingtalk.com/download/${part.pictureDownloadCode}`
      };
    }
    return part;
  });

  // 构造新消息  
  const markdown = parts.map(part => {
    if (part.type === 'image') {
      return `\n[未能识别的图片内容]\n`;
    }
    return part.text;
  }).join('\n');

  return markdown;
}

// 处理CORS响应头
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, timestamp, sign',
    'Access-Control-Max-Age': '86400',
  };
}

// 计算发送消息的签名
async function calculateBotSignature(timestamp, secret) {
  const stringToSign = `${timestamp}\n${secret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const key = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// 验证来自群的消息签名
async function verifyOutgoingSignature(request, secret) {
  const token = request.headers['token'];

  if (token === secret) {
    return true;
  }
  return false;
}

// 构建转发消息  
function buildForwardMessage(content, senderInfo) {
  // 基于原始消息类型构建转发消息  
  const baseMessage = {
    msgtype: content.msgtype
  };

  // 根据不同消息类型处理  
  switch (content.msgtype) {
    case 'text':
      baseMessage.text = {
        content: `@${senderInfo.senderNick} 说：\n${content.text.content}`
      };
      break;

    case 'markdown':
      baseMessage.markdown = {
        title: content.markdown.title,
        text: `#### 来自 @${senderInfo.senderNick} 的消息：\n${content.markdown.text}`
      };
      break;

    case 'richText':
      baseMessage.msgtype = 'markdown';
      baseMessage.markdown = {
        title: '转发消息',
        text: `#### 来自 @${senderInfo.senderNick} 的消息：\n\n ${sendDingMessage(content.content.richText)}`,
      };
      break;

    case 'image':
      baseMessage.msgtype = 'markdown';
      baseMessage.markdown = {
        title: '转发消息',
        text: `#### 来自 @${senderInfo.senderNick} 的消息：\n\n 无法识别的图片内容`,
      };
      break;

    default:
      // 对于未知类型，降级为文本消息  
      baseMessage.msgtype = 'text';
      baseMessage.text = {
        content: `来自 @${senderInfo.senderNick} 的未知类型消息`
      };
  }

  return baseMessage;
}

// 发送消息到目标群  
async function forwardToDingtalk(message, targetWebhook, botSecret) {
  try {
    const timestamp = Date.now().toString();
    const sign = await calculateBotSignature(timestamp, botSecret);

    const webhookUrl = `${targetWebhook}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error forwarding message:', error);
    throw error;
  }
}

module.exports = async function fetch(request, env) {
  const {
    OUTGOING_SECRET,
    SEND_URL,
    BOT_SECRET,
  } = env;

  try {
    // 验证来自群的消息签名  
    const isValid = await verifyOutgoingSignature(
      request,
      OUTGOING_SECRET,
    );

    if (!isValid) {
      return new Response('Invalid signature', {
        status: 401,
        headers: corsHeaders(),
      });
    }

    const content = request.body;
    // 构建发送者信息  
    const senderInfo = {
      senderNick: content.senderNick,
      senderId: content.senderId,
      senderStaffId: content.senderStaffId,
    };

    // 构建转发消息  
    const forwardMessage = buildForwardMessage(content, senderInfo);

    // 转发到目标群  
    await forwardToDingtalk(
      forwardMessage,
      SEND_URL,
      BOT_SECRET,
    );

    return new Response('已发送', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(),
      },
    });
  }
};