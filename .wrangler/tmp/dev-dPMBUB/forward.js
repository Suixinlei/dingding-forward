var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-dZl033/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// forward.js
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, timestamp, sign",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
async function calculateBotSignature(timestamp, secret) {
  const stringToSign = `${timestamp}
${secret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const key = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
__name(calculateBotSignature, "calculateBotSignature");
async function verifyOutgoingSignature(request, content, secret) {
  const timestamp = request.headers.get("timestamp");
  const sign = request.headers.get("sign");
  if (!timestamp || !sign) {
    return false;
  }
  const stringToSign = `${timestamp}
${secret}
${content}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(stringToSign);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const calculatedSign = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return sign.toLowerCase() === calculatedSign.toLowerCase();
}
__name(verifyOutgoingSignature, "verifyOutgoingSignature");
function buildForwardMessage(content, senderInfo) {
  console.log("buildForwardMessage:", content, senderInfo);
  const baseMessage = {
    msgtype: content.msgtype
  };
  switch (content.msgtype) {
    case "text":
      baseMessage.text = {
        content: `@${senderInfo.senderNick} \u8BF4\uFF1A
${content.text.content}`
      };
      break;
    case "markdown":
      baseMessage.markdown = {
        title: content.markdown.title,
        text: `#### \u6765\u81EA @${senderInfo.senderNick} \u7684\u6D88\u606F\uFF1A
${content.markdown.text}`
      };
      break;
    case "link":
      baseMessage.link = {
        ...content.link,
        text: `\u6765\u81EA @${senderInfo.senderNick} \u7684\u94FE\u63A5\uFF1A
${content.link.text}`
      };
      break;
    case "actionCard":
      if (content.actionCard.btns) {
        baseMessage.actionCard = {
          ...content.actionCard,
          text: `#### \u6765\u81EA @${senderInfo.senderNick} \u7684\u5361\u7247\u6D88\u606F\uFF1A
${content.actionCard.text}`
        };
      } else {
        baseMessage.actionCard = {
          ...content.actionCard,
          text: `#### \u6765\u81EA @${senderInfo.senderNick} \u7684\u5361\u7247\u6D88\u606F\uFF1A
${content.actionCard.text}`
        };
      }
      break;
    case "feedCard":
      baseMessage.feedCard = content.feedCard;
      break;
    default:
      baseMessage.msgtype = "text";
      baseMessage.text = {
        content: `\u6765\u81EA @${senderInfo.senderNick} \u7684\u672A\u77E5\u7C7B\u578B\u6D88\u606F`
      };
  }
  return baseMessage;
}
__name(buildForwardMessage, "buildForwardMessage");
async function forwardToDingtalk(message, targetWebhook, botSecret) {
  try {
    const timestamp = Date.now().toString();
    const sign = await calculateBotSignature(timestamp, botSecret);
    const webhookUrl = `${targetWebhook}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error forwarding message:", error);
    throw error;
  }
}
__name(forwardToDingtalk, "forwardToDingtalk");
var forward_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders()
      });
    }
    try {
      const clonedRequest = request.clone();
      const rawBody = await clonedRequest.text();
      const isValid = await verifyOutgoingSignature(
        request,
        rawBody,
        env.OUTGOING_1_SECRET
      );
      if (!isValid) {
        return new Response("Invalid signature", {
          status: 401,
          headers: corsHeaders()
        });
      }
      const content = JSON.parse(rawBody);
      const senderInfo = {
        senderNick: content.senderNick,
        senderId: content.senderId,
        senderStaffId: content.senderStaffId
      };
      const forwardMessage = buildForwardMessage(content, senderInfo);
      const result = await forwardToDingtalk(
        forwardMessage,
        env.SEND_URL_1,
        env.BOT_1_SECRET
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders()
        }
      });
    } catch (error) {
      console.error("Error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders()
        }
      });
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-dZl033/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = forward_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-dZl033/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=forward.js.map
