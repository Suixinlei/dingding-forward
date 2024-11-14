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
async function verifyOutgoingSignature(request, content, secret) {
  const timestamp = request.headers.get('timestamp');
  const sign = request.headers.get('sign');

  if (!timestamp || !sign) {
    return false;
  }

  // 钉钉outgoing签名计算规则：把timestamp、token和请求体拼接后做SHA256
  const stringToSign = `${timestamp}\n${secret}\n${content}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const calculatedSign = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return sign.toLowerCase() === calculatedSign.toLowerCase();
}

// 构建转发消息  
function buildForwardMessage(content, senderInfo) {  
  console.log('buildForwardMessage:', content, senderInfo);
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
    
    case 'link':  
      baseMessage.link = {  
        ...content.link,  
        text: `来自 @${senderInfo.senderNick} 的链接：\n${content.link.text}`  
      };  
      break;  
    
    case 'actionCard':  
      if (content.actionCard.btns) {  
        // 整体跳转的actionCard  
        baseMessage.actionCard = {  
          ...content.actionCard,  
          text: `#### 来自 @${senderInfo.senderNick} 的卡片消息：\n${content.actionCard.text}`  
        };  
      } else {  
        // 独立跳转的actionCard  
        baseMessage.actionCard = {  
          ...content.actionCard,  
          text: `#### 来自 @${senderInfo.senderNick} 的卡片消息：\n${content.actionCard.text}`  
        };  
      }  
      break;  
    
    case 'feedCard':  
      baseMessage.feedCard = content.feedCard;  
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

export default {  
  async fetch(request, env) {
    console.log('request', request);
    // 处理 OPTIONS 请求  
    if (request.method === 'OPTIONS') {  
      return new Response(null, {  
        status: 204,  
        headers: corsHeaders(),  
      });  
    }  

    // 只处理POST请求  
    if (request.method !== 'POST') {  
      return new Response('Method not allowed', {  
        status: 405,  
        headers: corsHeaders(),  
      });  
    }  

    try {  
      const clonedRequest = request.clone();  
      const rawBody = await clonedRequest.json();  
      
      // 验证来自群的消息签名  
      const isValid = await verifyOutgoingSignature(  
        request,  
        rawBody,  
        env.OUTGOING_1_SECRET  
      );  

      if (!isValid) {  
        return new Response('Invalid signature', {  
          status: 401,  
          headers: corsHeaders(),  
        });  
      }  

      // 解析消息内容  
      const content = JSON.parse(rawBody);  

      // 构建发送者信息  
      const senderInfo = {  
        senderNick: content.senderNick,  
        senderId: content.senderId,  
        senderStaffId: content.senderStaffId,  
      };  

      // 构建转发消息  
      const forwardMessage = buildForwardMessage(content, senderInfo);  

      // 转发到目标群  
      const result = await forwardToDingtalk(
        forwardMessage,  
        env.SEND_URL_1,  
        env.BOT_1_SECRET  
      );  

      return new Response(JSON.stringify(result), {  
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
  },  
};