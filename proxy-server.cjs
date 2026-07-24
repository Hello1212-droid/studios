#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              HYPERBEAM API PROXY SERVER                      ║
 * ║                                                              ║
 * ║  Purpose:                                                    ║
 * ║    Hyperbeam's REST API (engine.hyperbeam.com/v0/vm) blocks  ║
 * ║    direct browser requests via CORS. This tiny proxy server  ║
 * ║    sits between the browser and Hyperbeam, forwarding         ║
 * ║    requests server-side (no CORS restriction in Node.js).    ║
 * ║                                                              ║
 * ║  Flow:                                                       ║
 * ║    Browser → POST /api/vm (or /proxy) → this server          ║
 * ║      → forwards to engine.hyperbeam.com/v0/vm                ║
 * ║      → returns {embed_url, admin_token, session_id}          ║
 * ║                                                              ║
 * ║  Usage:                                                      ║
 * ║    npm run proxy          (starts on port 3456)              ║
 * ║    node proxy-server.cjs  (same thing)                       ║
 * ║                                                              ║
 * ║  Then in the app Settings → Proxy URL:                       ║
 * ║    http://localhost:3456/proxy                               ║
 * ║                                                              ║
 * ║  Inspired by: cloud-chrome-hyperbeam/server.ts               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Imports ──────────────────────────────────────────────────────
// Node.js built-in HTTP and HTTPS modules — zero npm dependencies.
// We use 'http' for the local server and 'https' to forward to Hyperbeam's TLS endpoint.
const http = require('http');   // Creates our local proxy server
const https = require('https'); // Forwards requests to Hyperbeam's HTTPS API

// ── Configuration ────────────────────────────────────────────────
// PORT: The port our proxy listens on. Can be overridden via environment variable.
// Default 3456 was chosen to avoid conflicts with common dev ports (3000, 5173, 8080).
const PORT = process.env.PORT || 3456;

// ── Server ───────────────────────────────────────────────────────
// createServer returns an http.Server instance.
// The callback runs for every incoming request from the browser.
const server = http.createServer((req, res) => {
  // ── CORS Headers ─────────────────────────────────────────────
  // We MUST set these, otherwise the browser will block the response.
  // Access-Control-Allow-Origin: * allows any website to call this proxy.
  // In production you'd restrict this to your own domain.
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Allowed methods: POST (creating sessions) and OPTIONS (CORS preflight).
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  // Allowed headers: Authorization (API key), Content-Type, and X-Requested-With.
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');

  // ── CORS Preflight ───────────────────────────────────────────
  // Browsers send an OPTIONS request before the actual POST to check
  // if CORS is allowed. We reply 204 (No Content) immediately.
  if (req.method === 'OPTIONS') {
    res.writeHead(204);         // 204 = "No Content" — preflight OK
    return res.end();           // End response, no body needed
  }

  // ── Health Check ─────────────────────────────────────────────
  // GET / → Returns a simple JSON status. Useful for verifying
  // the proxy is running (e.g., curl http://localhost:3456/).
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      message: 'Hyperbeam API proxy running'
    }));
  }

  // ── Proxy POST to Hyperbeam ──────────────────────────────────
  // The main event: forward the browser's POST body and Authorization
  // header to Hyperbeam's actual API at engine.hyperbeam.com/v0/vm.
  if (req.method === 'POST') {
    // Collect the request body in chunks (Node.js streams data).
    const chunks = [];                           // Array to collect Buffer chunks
    req.on('data', c => chunks.push(c));        // Push each chunk as it arrives
    req.on('end', () => {                       // 'end' fires when all data received
      const body = Buffer.concat(chunks);       // Combine chunks into single Buffer

      // Build the options for the HTTPS request to Hyperbeam.
      // We forward: hostname, path, method, Authorization, Content-Type, Content-Length.
      const options = {
        hostname: 'engine.hyperbeam.com',       // Hyperbeam's API host
        port: 443,                               // HTTPS default port
        path: '/v0/vm',                         // Hyperbeam's session-creation endpoint
        method: 'POST',                         // POST is required by Hyperbeam
        headers: {
          'Authorization': req.headers['authorization'] || '',  // Pass user's API key through
          'Content-Type': 'application/json',                   // JSON body format
          'Content-Length': body.length,                        // Required for POST with body
        },
      };

      // Create the outbound HTTPS request to Hyperbeam.
      // https.request() returns a ClientRequest; the callback receives Hyperbeam's response.
      const proxyReq = https.request(options, (proxyRes) => {
        // Forward Hyperbeam's status code and headers back to the browser.
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',   // Must include again for the actual response
        });

        // Pipe Hyperbeam's response body directly to the browser.
        // This is efficient — data streams through without buffering the whole response.
        proxyRes.pipe(res);
      });

      // Handle connection errors (Hyperbeam unreachable, DNS failure, etc.)
      proxyReq.on('error', (err) => {
        console.error('[proxy] Error forwarding to Hyperbeam:', err.message);
        res.writeHead(502, {                    // 502 = Bad Gateway (upstream error)
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
          error: 'Proxy error: ' + err.message
        }));
      });

      // Write the request body and finalize the outbound request.
      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // ── Method Not Allowed ───────────────────────────────────────
  // For any other HTTP method (PUT, DELETE, etc.), return 405.
  res.writeHead(405);
  res.end();
});

// ── Start Listening ─────────────────────────────────────────────
// Begin accepting connections. '0.0.0.0' is NOT used — we only listen
// on localhost since this is a local dev tool, not a public server.
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║   🔀  Hyperbeam API Proxy               ║');
  console.log('  ║   http://localhost:' + String(PORT).padEnd(5) + '                     ║');
  console.log('  ║                                        ║');
  console.log('  ║   npm run dev → Vite proxies /api/vm   ║');
  console.log('  ║   This proxy → /proxy endpoint         ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
