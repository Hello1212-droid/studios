#!/usr/bin/env node
/**
 * CORS Proxy for Hyperbeam API
 * 
 * Hyperbeam's REST API blocks browser requests (CORS).
 * Run this tiny proxy locally to bridge the gap.
 * 
 * Usage:  node cors-proxy.cjs
 * Then in Settings → Proxy URL:  http://localhost:3456/proxy
 */

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3456;
const TARGET_HOST = 'engine.hyperbeam.com';

const server = http.createServer((req, res) => {
  // CORS headers — allow the browser to call us
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url.startsWith('/proxy')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CORS Proxy running. POST to /proxy to reach Hyperbeam API.');
    return;
  }

  // Proxy the request to Hyperbeam
  const bodyChunks = [];
  req.on('data', chunk => bodyChunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(bodyChunks);

    const options = {
      hostname: TARGET_HOST,
      port: 443,
      path: '/v0/vm',
      method: req.method,
      headers: {
        'Authorization': req.headers['authorization'] || '',
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Content-Length': body.length,
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[cors-proxy] Error:', err.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   🔀  Hyperbeam CORS Proxy              ║');
  console.log('  ║   Listening on http://localhost:' + String(PORT).padEnd(5) + '   ║');
  console.log('  ║                                        ║');
  console.log('  ║   Proxy URL: localhost:' + String(PORT) + '/proxy     ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log('  Keep this terminal running. In the app:');
  console.log('  Settings ⚙️ → Proxy URL → http://localhost:' + PORT + '/proxy');
  console.log('');
});
