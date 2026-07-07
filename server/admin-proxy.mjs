/**
 * 本地 Admin API 代理，解决浏览器 CORS 限制。
 *
 * 用法：node server/admin-proxy.mjs
 * 默认监听 http://127.0.0.1:3456
 *
 * Token 仅用于转发请求，不会写入磁盘。
 */
import http from 'node:http';

const PORT = Number(process.env.PORT) || 3456;
const HOST = process.env.HOST || '127.0.0.1';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-01';

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function normalizeShop(shop) {
  let value = String(shop || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (!value) return '';
  if (!value.includes('.')) value += '.myshopify.com';
  return value;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, apiVersion: API_VERSION });
  }

  if (req.method !== 'POST' || req.url !== '/graphql') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw || '{}');
    const shop = normalizeShop(body.shop);
    const token = String(body.token || '').trim();
    const query = body.query;
    const variables = body.variables;

    if (!shop || !token || !query) {
      return sendJson(res, 400, { error: '缺少 shop / token / query' });
    }

    const upstream = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      }
    );

    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Proxy error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Shopify Admin proxy: http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
});
