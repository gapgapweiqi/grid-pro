var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/middleware/auth.ts
var auth_exports = {};
__export(auth_exports, {
  authMiddleware: () => authMiddleware,
  createJwt: () => createJwt,
  verifyJwt: () => verifyJwt
});
async function authMiddleware(c, next) {
  if (c.req.method === "OPTIONS") return next();
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/auth/") || path === "/api/health") return next();
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Missing auth token" } }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);
  } catch {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } }, 401);
  }
  return next();
}
async function createJwt(payload, secret, expiresInSec = 7 * 24 * 3600) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSec };
  const enc = new TextEncoder();
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(fullPayload));
  const data = enc.encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigB64 = base64url(sig);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}
async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const enc = new TextEncoder();
  const data = enc.encode(`${parts[0]}.${parts[1]}`);
  const sig = base64urlDecode(parts[2]);
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, sig, data);
  if (!valid) throw new Error("Invalid signature");
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) {
    throw new Error("Token expired");
  }
  return payload;
}
function base64url(input) {
  const str = typeof input === "string" ? btoa(input) : btoa(String.fromCharCode(...new Uint8Array(input)));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
var init_auth = __esm({
  "src/middleware/auth.ts"() {
    "use strict";
    __name(authMiddleware, "authMiddleware");
    __name(createJwt, "createJwt");
    __name(verifyJwt, "verifyJwt");
    __name(base64url, "base64url");
    __name(base64urlDecode, "base64urlDecode");
  }
});

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// src/routes/auth.ts
init_auth();
var authRoutes = new Hono2();
authRoutes.post("/google", async (c) => {
  const { code, redirectUri } = await c.req.json();
  if (!code) return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing code" } }, 400);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri || `${c.env.CORS_ORIGIN}/login`,
      grant_type: "authorization_code"
    })
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return c.json({ ok: false, error: { code: "GOOGLE_ERROR", message: `Token exchange failed: ${err}` } }, 400);
  }
  const tokens = await tokenRes.json();
  const { access_token, refresh_token, expires_in, id_token } = tokens;
  const payload = JSON.parse(atob(id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  const { sub: googleId, email, name, picture } = payload;
  const db = c.env.DB;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let user = await db.prepare("SELECT * FROM users WHERE google_id = ? OR email = ?").bind(googleId, email).first();
  if (!user) {
    const userId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO users (user_id, email, name, avatar_url, auth_provider, google_id, google_access_token, google_refresh_token, google_token_expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'google', ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      email,
      name || "",
      picture || "",
      googleId,
      access_token,
      refresh_token || "",
      new Date(Date.now() + expires_in * 1e3).toISOString(),
      now,
      now
    ).run();
    const companyId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO master (entity_id, entity_type, user_id, company_id, name, status, json, created_at, updated_at)
      VALUES (?, 'COMPANY', ?, ?, ?, 'ACTIVE', '{}', ?, ?)
    `).bind(companyId, userId, companyId, `\u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17\u0E02\u0E2D\u0E07 ${name || email}`, now, now).run();
    try {
      const folderRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "Grid Doc Files",
          mimeType: "application/vnd.google-apps.folder"
        })
      });
      if (folderRes.ok) {
        const folder = await folderRes.json();
        await db.prepare("UPDATE users SET drive_folder_id = ? WHERE user_id = ?").bind(folder.id, userId).run();
      }
    } catch {
    }
    user = { user_id: userId, email, name: name || "", avatar_url: picture || "", auth_provider: "google", google_id: googleId };
  } else {
    await db.prepare(`
      UPDATE users SET google_access_token = ?, google_refresh_token = COALESCE(NULLIF(?, ''), google_refresh_token),
      google_token_expires_at = ?, avatar_url = COALESCE(NULLIF(?, ''), avatar_url), updated_at = ?
      WHERE user_id = ?
    `).bind(
      access_token,
      refresh_token || "",
      new Date(Date.now() + expires_in * 1e3).toISOString(),
      picture || "",
      now,
      user.user_id
    ).run();
  }
  const jwt = await createJwt({ sub: user.user_id, email: user.email }, c.env.JWT_SECRET);
  return c.json({
    ok: true,
    data: {
      token: jwt,
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        authProvider: user.auth_provider
      }
    }
  });
});
authRoutes.post("/register", async (c) => {
  const { email, password, name } = await c.req.json();
  if (!email || !password) return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing email or password" } }, 400);
  const db = c.env.DB;
  const existing = await db.prepare("SELECT user_id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ ok: false, error: { code: "CONFLICT", message: "Email already registered" } }, 409);
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const userId = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.prepare(`
    INSERT INTO users (user_id, email, password_hash, name, auth_provider, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'email', ?, ?)
  `).bind(userId, email, passwordHash, name || "", now, now).run();
  const companyId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO master (entity_id, entity_type, user_id, company_id, name, status, json, created_at, updated_at)
    VALUES (?, 'COMPANY', ?, ?, ?, 'ACTIVE', '{}', ?, ?)
  `).bind(companyId, userId, companyId, `\u0E1A\u0E23\u0E34\u0E29\u0E31\u0E17\u0E02\u0E2D\u0E07 ${name || email}`, now, now).run();
  const jwt = await createJwt({ sub: userId, email }, c.env.JWT_SECRET);
  return c.json({
    ok: true,
    data: {
      token: jwt,
      user: { userId, email, name: name || "", avatarUrl: "", authProvider: "email" }
    }
  });
});
authRoutes.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing email or password" } }, 400);
  const db = c.env.DB;
  const user = await db.prepare("SELECT * FROM users WHERE email = ? AND auth_provider = ?").bind(email, "email").first();
  if (!user) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } }, 404);
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  if (passwordHash !== user.password_hash) {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid password" } }, 401);
  }
  const jwt = await createJwt({ sub: user.user_id, email: user.email }, c.env.JWT_SECRET);
  return c.json({
    ok: true,
    data: {
      token: jwt,
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        authProvider: user.auth_provider
      }
    }
  });
});
authRoutes.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "No token" } }, 401);
  }
  const { verifyJwt: verifyJwt2 } = await Promise.resolve().then(() => (init_auth(), auth_exports));
  try {
    const payload = await verifyJwt2(authHeader.slice(7), c.env.JWT_SECRET);
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(payload.sub).first();
    if (!user) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "User not found" } }, 404);
    return c.json({
      ok: true,
      data: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        authProvider: user.auth_provider,
        googleId: user.google_id || "",
        driveFolderId: user.drive_folder_id || "",
        isActive: !!user.is_active
      }
    });
  } catch {
    return c.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid token" } }, 401);
  }
});

// src/routes/master.ts
var masterRoutes = new Hono2();
masterRoutes.get("/:type", async (c) => {
  const entityType = c.req.param("type").toUpperCase();
  const companyId = c.req.query("companyId");
  if (!companyId) return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing companyId" } }, 400);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM master WHERE entity_type = ? AND company_id = ? AND is_deleted = 0 ORDER BY name`
  ).bind(entityType, companyId).all();
  return c.json({ ok: true, data: rows.results.map(mapMasterRow) });
});
masterRoutes.post("/:type", async (c) => {
  const entityType = c.req.param("type").toUpperCase();
  const body = await c.req.json();
  const userId = c.get("userId");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const entityId = body.entityId || crypto.randomUUID();
  const existing = await c.env.DB.prepare("SELECT entity_id FROM master WHERE entity_id = ?").bind(entityId).first();
  if (existing) {
    await c.env.DB.prepare(`
      UPDATE master SET name = ?, name2 = ?, code = ?, tax_id = ?, phone = ?, email = ?, address = ?, tags = ?, status = ?, json = ?, updated_at = ?
      WHERE entity_id = ?
    `).bind(
      body.name || "",
      body.name2 || "",
      body.code || "",
      body.taxId || "",
      body.phone || "",
      body.email || "",
      body.address || "",
      body.tags || "",
      body.status || "ACTIVE",
      JSON.stringify(body.json || {}),
      now,
      entityId
    ).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO master (entity_id, entity_type, user_id, company_id, code, name, name2, tax_id, phone, email, address, tags, status, json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entityId,
      entityType,
      userId,
      body.companyId || "",
      body.code || "",
      body.name || "",
      body.name2 || "",
      body.taxId || "",
      body.phone || "",
      body.email || "",
      body.address || "",
      body.tags || "",
      body.status || "ACTIVE",
      JSON.stringify(body.json || {}),
      now,
      now
    ).run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM master WHERE entity_id = ?").bind(entityId).first();
  return c.json({ ok: true, data: mapMasterRow(row) });
});
masterRoutes.delete("/:type", async (c) => {
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing ids" } }, 400);
  }
  const placeholders = ids.map(() => "?").join(",");
  await c.env.DB.prepare(
    `UPDATE master SET is_deleted = 1, updated_at = ? WHERE entity_id IN (${placeholders})`
  ).bind((/* @__PURE__ */ new Date()).toISOString(), ...ids).run();
  return c.json({ ok: true, data: { deleted: ids.length } });
});

// src/routes/docs.ts
var docRoutes = new Hono2();
docRoutes.get("/", async (c) => {
  const companyId = c.req.query("companyId");
  const docType = c.req.query("docType");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  if (!companyId) return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing companyId" } }, 400);
  let sql = `SELECT * FROM documents WHERE company_id = ? AND is_deleted = 0`;
  const params = [companyId];
  if (docType) {
    sql += ` AND doc_type = ?`;
    params.push(docType);
  }
  sql += ` ORDER BY doc_date DESC, created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ ok: true, data: rows.results.map(mapDocRow) });
});
docRoutes.get("/:id", async (c) => {
  const docId = c.req.param("id");
  const doc = await c.env.DB.prepare("SELECT * FROM documents WHERE doc_id = ?").bind(docId).first();
  if (!doc) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Document not found" } }, 404);
  const lines = await c.env.DB.prepare("SELECT * FROM doc_lines WHERE doc_id = ? ORDER BY line_no").bind(docId).all();
  return c.json({
    ok: true,
    data: {
      header: mapDocRow(doc),
      lines: lines.results.map(mapDocLineRow)
    }
  });
});
docRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const userId = c.get("userId");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const db = c.env.DB;
  const docId = body.header?.docId || crypto.randomUUID();
  const h = body.header || {};
  const existing = await db.prepare("SELECT doc_id FROM documents WHERE doc_id = ?").bind(docId).first();
  if (existing) {
    await db.prepare(`
      UPDATE documents SET doc_type=?, customer_id=?, doc_no=?, doc_date=?, due_date=?, ref_doc_no=?, currency=?,
      subtotal=?, discount_enabled=?, discount_type=?, discount_value=?, vat_enabled=?, vat_rate=?,
      wht_enabled=?, wht_rate=?, total_before_tax=?, vat_amount=?, wht_amount=?, grand_total=?,
      payment_status=?, doc_status=?, notes=?, terms=?, signature_enabled=?, json=?, updated_at=?
      WHERE doc_id = ?
    `).bind(
      h.docType || "",
      h.customerId || "",
      h.docNo || "",
      h.docDate || "",
      h.dueDate || "",
      h.refDocNo || "",
      h.currency || "THB",
      h.subtotal || 0,
      h.discountEnabled ? 1 : 0,
      h.discountType || "AMOUNT",
      h.discountValue || 0,
      h.vatEnabled ? 1 : 0,
      h.vatRate || 7,
      h.whtEnabled ? 1 : 0,
      h.whtRate || 3,
      h.totalBeforeTax || 0,
      h.vatAmount || 0,
      h.whtAmount || 0,
      h.grandTotal || 0,
      h.paymentStatus || "UNPAID",
      h.docStatus || "DRAFT",
      h.notes || "",
      h.terms || "",
      h.signatureEnabled ? 1 : 0,
      JSON.stringify(h.json || {}),
      now,
      docId
    ).run();
  } else {
    await db.prepare(`
      INSERT INTO documents (doc_id, doc_type, user_id, company_id, customer_id, doc_no, doc_date, due_date,
      ref_doc_no, currency, subtotal, discount_enabled, discount_type, discount_value, vat_enabled, vat_rate,
      wht_enabled, wht_rate, total_before_tax, vat_amount, wht_amount, grand_total,
      payment_status, doc_status, notes, terms, signature_enabled, json, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      docId,
      h.docType || "",
      userId,
      h.companyId || "",
      h.customerId || "",
      h.docNo || "",
      h.docDate || "",
      h.dueDate || "",
      h.refDocNo || "",
      h.currency || "THB",
      h.subtotal || 0,
      h.discountEnabled ? 1 : 0,
      h.discountType || "AMOUNT",
      h.discountValue || 0,
      h.vatEnabled ? 1 : 0,
      h.vatRate || 7,
      h.whtEnabled ? 1 : 0,
      h.whtRate || 3,
      h.totalBeforeTax || 0,
      h.vatAmount || 0,
      h.whtAmount || 0,
      h.grandTotal || 0,
      h.paymentStatus || "UNPAID",
      h.docStatus || "DRAFT",
      h.notes || "",
      h.terms || "",
      h.signatureEnabled ? 1 : 0,
      JSON.stringify(h.json || {}),
      now,
      now
    ).run();
  }
  if (Array.isArray(body.lines)) {
    await db.prepare("DELETE FROM doc_lines WHERE doc_id = ?").bind(docId).run();
    for (let i = 0; i < body.lines.length; i++) {
      const l = body.lines[i];
      await db.prepare(`
        INSERT INTO doc_lines (line_id, doc_id, line_no, product_id, code, name, description, qty, unit, unit_price, discount_type, discount_value, line_total, json, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        l.lineId || crypto.randomUUID(),
        docId,
        i + 1,
        l.productId || "",
        l.code || "",
        l.name || "",
        l.description || "",
        l.qty || 0,
        l.unit || "",
        l.unitPrice || 0,
        l.discountType || "",
        l.discountValue || 0,
        l.lineTotal || 0,
        JSON.stringify(l.json || {}),
        now,
        now
      ).run();
    }
  }
  if (h.docNo && h.companyId && h.docType) {
    const seqId = `${h.docType}:${h.companyId}`;
    const numMatch = h.docNo.match(/(\d+)$/);
    if (numMatch) {
      const val = parseInt(numMatch[1]);
      await db.prepare(`
        INSERT INTO sequences (id, current_value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET current_value = MAX(current_value, excluded.current_value), updated_at = excluded.updated_at
      `).bind(seqId, val, now).run();
    }
  }
  const doc = await db.prepare("SELECT * FROM documents WHERE doc_id = ?").bind(docId).first();
  const lines = await db.prepare("SELECT * FROM doc_lines WHERE doc_id = ? ORDER BY line_no").bind(docId).all();
  return c.json({ ok: true, data: { header: mapDocRow(doc), lines: lines.results.map(mapDocLineRow) } });
});
docRoutes.patch("/:id/status", async (c) => {
  const docId = c.req.param("id");
  const { paymentStatus, docStatus } = await c.req.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (paymentStatus) {
    await c.env.DB.prepare("UPDATE documents SET payment_status = ?, updated_at = ? WHERE doc_id = ?").bind(paymentStatus, now, docId).run();
  }
  if (docStatus) {
    await c.env.DB.prepare("UPDATE documents SET doc_status = ?, updated_at = ? WHERE doc_id = ?").bind(docStatus, now, docId).run();
  }
  const doc = await c.env.DB.prepare("SELECT * FROM documents WHERE doc_id = ?").bind(docId).first();
  return c.json({ ok: true, data: mapDocRow(doc) });
});
docRoutes.delete("/", async (c) => {
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing ids" } }, 400);
  }
  const placeholders = ids.map(() => "?").join(",");
  await c.env.DB.prepare(
    `UPDATE documents SET is_deleted = 1, updated_at = ? WHERE doc_id IN (${placeholders})`
  ).bind((/* @__PURE__ */ new Date()).toISOString(), ...ids).run();
  return c.json({ ok: true, data: { deleted: ids.length } });
});

// src/routes/team.ts
var teamRoutes = new Hono2();
teamRoutes.get("/", async (c) => {
  const companyId = c.req.query("companyId");
  if (!companyId) return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing companyId" } }, 400);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM team_members WHERE company_id = ? ORDER BY created_at`
  ).bind(companyId).all();
  return c.json({ ok: true, data: rows.results.map(mapTeamRow) });
});
teamRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM team_members WHERE company_id = ?`
  ).bind(body.companyId).first();
  if (count && count.cnt >= 5) {
    return c.json({ ok: false, error: { code: "LIMIT_REACHED", message: "Maximum 5 team members" } }, 400);
  }
  const memberId = crypto.randomUUID();
  const inviteToken = crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString();
  await c.env.DB.prepare(`
    INSERT INTO team_members (member_id, company_id, email, name, role, permissions, status, invite_token, invite_expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'member', ?, 'pending', ?, ?, ?, ?)
  `).bind(
    memberId,
    body.companyId,
    body.email,
    body.name || "",
    JSON.stringify(body.permissions || []),
    inviteToken,
    expiresAt,
    now,
    now
  ).run();
  const row = await c.env.DB.prepare("SELECT * FROM team_members WHERE member_id = ?").bind(memberId).first();
  return c.json({ ok: true, data: { ...mapTeamRow(row), inviteToken } });
});
teamRoutes.post("/invite", async (c) => {
  const { memberId } = await c.req.json();
  const member = await c.env.DB.prepare("SELECT * FROM team_members WHERE member_id = ?").bind(memberId).first();
  if (!member) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Member not found" } }, 404);
  return c.json({
    ok: true,
    data: {
      inviteLink: `${c.env.CORS_ORIGIN}/invite/${member.invite_token}`,
      expiresAt: member.invite_expires_at
    }
  });
});
teamRoutes.post("/accept", async (c) => {
  const { token } = await c.req.json();
  const userId = c.get("userId");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const member = await c.env.DB.prepare(
    `SELECT * FROM team_members WHERE invite_token = ? AND status = 'pending'`
  ).bind(token).first();
  if (!member) return c.json({ ok: false, error: { code: "NOT_FOUND", message: "Invalid or expired invite" } }, 404);
  if (new Date(member.invite_expires_at) < /* @__PURE__ */ new Date()) {
    return c.json({ ok: false, error: { code: "EXPIRED", message: "Invite has expired" } }, 400);
  }
  await c.env.DB.prepare(`
    UPDATE team_members SET user_id = ?, status = 'active', invite_token = '', updated_at = ? WHERE member_id = ?
  `).bind(userId, now, member.member_id).run();
  return c.json({ ok: true, data: { memberId: member.member_id, companyId: member.company_id } });
});
teamRoutes.put("/:id", async (c) => {
  const memberId = c.req.param("id");
  const { permissions, status } = await c.req.json();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updates = [];
  const params = [];
  if (permissions) {
    updates.push("permissions = ?");
    params.push(JSON.stringify(permissions));
  }
  if (status) {
    updates.push("status = ?");
    params.push(status);
  }
  updates.push("updated_at = ?");
  params.push(now);
  params.push(memberId);
  await c.env.DB.prepare(
    `UPDATE team_members SET ${updates.join(", ")} WHERE member_id = ?`
  ).bind(...params).run();
  const row = await c.env.DB.prepare("SELECT * FROM team_members WHERE member_id = ?").bind(memberId).first();
  return c.json({ ok: true, data: mapTeamRow(row) });
});
teamRoutes.delete("/:id", async (c) => {
  const memberId = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM team_members WHERE member_id = ?").bind(memberId).run();
  return c.json({ ok: true, data: { deleted: memberId } });
});
function mapTeamRow(row) {
  if (!row) return null;
  return {
    memberId: row.member_id,
    companyId: row.company_id,
    userId: row.user_id || "",
    email: row.email,
    name: row.name || "",
    role: row.role,
    permissions: safeParseArray(row.permissions),
    status: row.status,
    inviteToken: row.invite_token || "",
    inviteExpiresAt: row.invite_expires_at || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
__name(mapTeamRow, "mapTeamRow");
function safeParseArray(val) {
  if (!val || val === "[]") return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}
__name(safeParseArray, "safeParseArray");

// src/routes/settings.ts
var settingsRoutes = new Hono2();
settingsRoutes.get("/", async (c) => {
  const scopeType = c.req.query("scopeType") || "USER";
  const scopeId = c.req.query("scopeId") || c.get("userId");
  const rows = await c.env.DB.prepare(
    `SELECT key, value FROM settings WHERE scope_type = ? AND scope_id = ?`
  ).bind(scopeType, scopeId).all();
  const result = {};
  for (const r of rows.results) {
    result[r.key] = r.value;
  }
  return c.json({ ok: true, data: result });
});
settingsRoutes.put("/", async (c) => {
  const body = await c.req.json();
  const scopeType = body.scopeType || "USER";
  const scopeId = body.scopeId || c.get("userId");
  const entries = body.entries || {};
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const [key, value] of Object.entries(entries)) {
    await c.env.DB.prepare(`
      INSERT INTO settings (key, scope_type, scope_id, value, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key, scope_type, scope_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(key, scopeType, scopeId, value, now).run();
  }
  return c.json({ ok: true, data: { updated: Object.keys(entries).length } });
});

// src/routes/files.ts
var fileRoutes = new Hono2();
fileRoutes.post("/upload", async (c) => {
  const userId = c.get("userId");
  const db = c.env.DB;
  const user = await db.prepare("SELECT google_access_token, drive_folder_id FROM users WHERE user_id = ?").bind(userId).first();
  if (!user?.google_access_token) {
    return c.json({ ok: false, error: { code: "NO_GOOGLE", message: "Google Drive not connected" } }, 400);
  }
  const formData = await c.req.formData();
  const file = formData.get("file");
  const refType = formData.get("refType") || "";
  const refId = formData.get("refId") || "";
  const companyId = formData.get("companyId") || "";
  if (!file) return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "No file provided" } }, 400);
  const metadata = JSON.stringify({
    name: file.name,
    parents: user.drive_folder_id ? [user.drive_folder_id] : []
  });
  const boundary = "-------314159265358979323846";
  const delimiter = `\r
--${boundary}\r
`;
  const closeDelim = `\r
--${boundary}--`;
  const fileArrayBuffer = await file.arrayBuffer();
  const multipartBody = new Blob([
    delimiter,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    metadata,
    delimiter,
    `Content-Type: ${file.type}\r
\r
`,
    fileArrayBuffer,
    closeDelim
  ]);
  const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${user.google_access_token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    return c.json({ ok: false, error: { code: "DRIVE_ERROR", message: `Upload failed: ${err}` } }, 500);
  }
  const driveFile = await uploadRes.json();
  const fileId = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.prepare(`
    INSERT INTO files (file_id, user_id, company_id, ref_type, ref_id, mime_type, name, size, drive_file_id, drive_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    fileId,
    userId,
    companyId,
    refType,
    refId,
    file.type,
    file.name,
    file.size,
    driveFile.id,
    driveFile.webViewLink || "",
    now,
    now
  ).run();
  return c.json({
    ok: true,
    data: {
      fileId,
      driveFileId: driveFile.id,
      driveUrl: driveFile.webViewLink || "",
      name: file.name
    }
  });
});
fileRoutes.get("/", async (c) => {
  const companyId = c.req.query("companyId");
  const refType = c.req.query("refType");
  const refId = c.req.query("refId");
  let sql = `SELECT * FROM files WHERE is_deleted = 0`;
  const params = [];
  if (companyId) {
    sql += ` AND company_id = ?`;
    params.push(companyId);
  }
  if (refType) {
    sql += ` AND ref_type = ?`;
    params.push(refType);
  }
  if (refId) {
    sql += ` AND ref_id = ?`;
    params.push(refId);
  }
  sql += ` ORDER BY created_at DESC`;
  const rows = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({
    ok: true,
    data: rows.results.map((r) => ({
      fileId: r.file_id,
      name: r.name,
      mimeType: r.mime_type,
      size: r.size,
      driveFileId: r.drive_file_id,
      driveUrl: r.drive_url,
      createdAt: r.created_at
    }))
  });
});

// src/routes/email.ts
var emailRoutes = new Hono2();
emailRoutes.post("/send", async (c) => {
  const userId = c.get("userId");
  const db = c.env.DB;
  const body = await c.req.json();
  const { to, cc, subject, htmlBody, pdfBase64, pdfFilename } = body;
  if (!to || !subject) {
    return c.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing to or subject" } }, 400);
  }
  const user = await db.prepare("SELECT google_access_token, google_refresh_token, google_token_expires_at, email FROM users WHERE user_id = ?").bind(userId).first();
  if (!user?.google_access_token) {
    return c.json({ ok: false, error: { code: "NO_GOOGLE", message: "Gmail not connected" } }, 400);
  }
  let accessToken = user.google_access_token;
  if (user.google_token_expires_at && new Date(user.google_token_expires_at) < /* @__PURE__ */ new Date()) {
    if (!user.google_refresh_token) {
      return c.json({ ok: false, error: { code: "TOKEN_EXPIRED", message: "Google token expired, please re-authenticate" } }, 401);
    }
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        refresh_token: user.google_refresh_token,
        grant_type: "refresh_token"
      })
    });
    if (refreshRes.ok) {
      const tokens = await refreshRes.json();
      accessToken = tokens.access_token;
      await db.prepare("UPDATE users SET google_access_token = ?, google_token_expires_at = ? WHERE user_id = ?").bind(accessToken, new Date(Date.now() + tokens.expires_in * 1e3).toISOString(), userId).run();
    } else {
      return c.json({ ok: false, error: { code: "REFRESH_FAILED", message: "Failed to refresh Google token" } }, 401);
    }
  }
  const boundary = `boundary_${Date.now()}`;
  let mimeLines = [
    `From: ${user.email}`,
    `To: ${to}`
  ];
  if (cc) mimeLines.push(`Cc: ${cc}`);
  mimeLines.push(
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`
  );
  if (pdfBase64 && pdfFilename) {
    mimeLines.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "",
      htmlBody || "<p>Please see the attached document.</p>",
      "",
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      "",
      pdfBase64,
      "",
      `--${boundary}--`
    );
  } else {
    mimeLines.push(
      "Content-Type: text/html; charset=UTF-8",
      "",
      htmlBody || "<p>No content</p>"
    );
  }
  const rawMessage = mimeLines.join("\r\n");
  const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ raw: encodedMessage })
  });
  if (!sendRes.ok) {
    const err = await sendRes.text();
    return c.json({ ok: false, error: { code: "GMAIL_ERROR", message: `Send failed: ${err}` } }, 500);
  }
  const result = await sendRes.json();
  return c.json({ ok: true, data: { messageId: result.id, threadId: result.threadId } });
});

// src/routes/kpi.ts
var kpiRoutes = new Hono2();
kpiRoutes.get("/:companyId", async (c) => {
  const companyId = c.req.param("companyId");
  const db = c.env.DB;
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const monthStart = `${year}-${month}-01`;
  const monthEnd = `${year}-${month}-31`;
  const [salesThisMonth, unpaidTotal, paidThisMonth, totalDocs] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(grand_total), 0) as val FROM documents WHERE company_id = ? AND doc_type IN ('INV','RCPT') AND doc_date BETWEEN ? AND ? AND is_deleted = 0`).bind(companyId, monthStart, monthEnd).first(),
    db.prepare(`SELECT COALESCE(SUM(grand_total), 0) as val FROM documents WHERE company_id = ? AND payment_status = 'UNPAID' AND is_deleted = 0`).bind(companyId).first(),
    db.prepare(`SELECT COALESCE(SUM(grand_total), 0) as val FROM documents WHERE company_id = ? AND payment_status = 'PAID' AND doc_date BETWEEN ? AND ? AND is_deleted = 0`).bind(companyId, monthStart, monthEnd).first(),
    db.prepare(`SELECT COUNT(*) as val FROM documents WHERE company_id = ? AND is_deleted = 0`).bind(companyId).first()
  ]);
  return c.json({
    ok: true,
    data: {
      salesThisMonth: salesThisMonth?.val || 0,
      unpaidTotal: unpaidTotal?.val || 0,
      paidThisMonth: paidThisMonth?.val || 0,
      totalDocuments: totalDocs?.val || 0,
      totalRevenue: 0,
      vatOutputThisMonth: 0,
      period: `${year}-${month}`
    }
  });
});

// src/index.ts
init_auth();
var app = new Hono2();
app.use("*", async (c, next) => {
  const corsMiddleware = cors({
    origin: c.env.CORS_ORIGIN || "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true
  });
  return corsMiddleware(c, next);
});
app.get("/api/health", (c) => c.json({ ok: true, ts: (/* @__PURE__ */ new Date()).toISOString() }));
app.route("/api/auth", authRoutes);
app.use("/api/*", authMiddleware);
app.route("/api/master", masterRoutes);
app.route("/api/docs", docRoutes);
app.route("/api/team", teamRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/email", emailRoutes);
app.route("/api/kpi", kpiRoutes);
app.get("/api/bootstrap", async (c) => {
  const userId = c.get("userId");
  const db = c.env.DB;
  const companies = await db.prepare(
    `SELECT * FROM master WHERE entity_type = 'COMPANY' AND user_id = ? AND is_deleted = 0`
  ).bind(userId).all();
  const settings = await db.prepare(
    `SELECT key, value FROM settings WHERE scope_type = 'USER' AND scope_id = ?`
  ).bind(userId).all();
  const settingsMap = {};
  for (const s of settings.results) {
    settingsMap[s.key] = s.value;
  }
  return c.json({
    ok: true,
    data: {
      companies: companies.results.map(mapMasterRow),
      settings: settingsMap
    }
  });
});
app.get("/api/bootstrap/:companyId", async (c) => {
  const companyId = c.req.param("companyId");
  const db = c.env.DB;
  const [customers, products, salespersons, unpaidDocs] = await Promise.all([
    db.prepare(`SELECT * FROM master WHERE entity_type = 'CUSTOMER' AND company_id = ? AND is_deleted = 0`).bind(companyId).all(),
    db.prepare(`SELECT * FROM master WHERE entity_type = 'PRODUCT' AND company_id = ? AND is_deleted = 0`).bind(companyId).all(),
    db.prepare(`SELECT * FROM master WHERE entity_type = 'SALESPERSON' AND company_id = ? AND is_deleted = 0`).bind(companyId).all(),
    db.prepare(`SELECT * FROM documents WHERE company_id = ? AND payment_status = 'UNPAID' AND is_deleted = 0 ORDER BY doc_date DESC LIMIT 50`).bind(companyId).all()
  ]);
  return c.json({
    ok: true,
    data: {
      customers: customers.results.map(mapMasterRow),
      products: products.results.map(mapMasterRow),
      salespersons: salespersons.results.map(mapMasterRow),
      unpaidDocs: unpaidDocs.results.map(mapDocRow),
      kpi: { salesThisMonth: 0, unpaidTotal: 0, paidThisMonth: 0, vatOutputThisMonth: 0, totalRevenue: 0, totalDocuments: 0, period: "" }
    }
  });
});
function mapMasterRow(row) {
  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    userId: row.user_id,
    companyId: row.company_id,
    code: row.code || "",
    name: row.name || "",
    name2: row.name2 || "",
    taxId: row.tax_id || "",
    phone: row.phone || "",
    email: row.email || "",
    address: row.address || "",
    tags: row.tags || "",
    status: row.status || "ACTIVE",
    isDeleted: !!row.is_deleted,
    json: safeParseJson(row.json),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}
__name(mapMasterRow, "mapMasterRow");
function mapDocRow(row) {
  return {
    docId: row.doc_id,
    docType: row.doc_type,
    userId: row.user_id,
    companyId: row.company_id,
    customerId: row.customer_id || "",
    docNo: row.doc_no || "",
    docDate: row.doc_date || "",
    dueDate: row.due_date || "",
    refDocNo: row.ref_doc_no || "",
    currency: row.currency || "THB",
    subtotal: row.subtotal || 0,
    discountEnabled: !!row.discount_enabled,
    discountType: row.discount_type || "AMOUNT",
    discountValue: row.discount_value || 0,
    vatEnabled: !!row.vat_enabled,
    vatRate: row.vat_rate || 7,
    whtEnabled: !!row.wht_enabled,
    whtRate: row.wht_rate || 3,
    totalBeforeTax: row.total_before_tax || 0,
    vatAmount: row.vat_amount || 0,
    whtAmount: row.wht_amount || 0,
    grandTotal: row.grand_total || 0,
    paymentStatus: row.payment_status || "UNPAID",
    docStatus: row.doc_status || "DRAFT",
    notes: row.notes || "",
    terms: row.terms || "",
    signatureEnabled: !!row.signature_enabled,
    pdfFileId: row.pdf_file_id || "",
    isDeleted: !!row.is_deleted,
    json: safeParseJson(row.json),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}
__name(mapDocRow, "mapDocRow");
function mapDocLineRow(row) {
  return {
    lineId: row.line_id,
    docId: row.doc_id,
    lineNo: row.line_no || 0,
    productId: row.product_id || "",
    code: row.code || "",
    name: row.name || "",
    description: row.description || "",
    qty: row.qty || 0,
    unit: row.unit || "",
    unitPrice: row.unit_price || 0,
    discountType: row.discount_type || "",
    discountValue: row.discount_value || 0,
    lineTotal: row.line_total || 0,
    json: safeParseJson(row.json),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}
__name(mapDocLineRow, "mapDocLineRow");
function safeParseJson(val) {
  if (!val || val === "{}") return {};
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}
__name(safeParseJson, "safeParseJson");
var index_default = app;
export {
  index_default as default,
  mapDocLineRow,
  mapDocRow,
  mapMasterRow
};
//# sourceMappingURL=index.js.map
