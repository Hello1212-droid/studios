/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              STUDYOS — VITE BUILD CONFIGURATION              ║
 * ║                                                              ║
 * ║  Architecture:                                               ║
 * ║    • React 19 + TypeScript frontend                          ║
 * ║    • Tailwind CSS 4 for styling                              ║
 * ║    • vite-plugin-singlefile → everything inlined into one    ║
 * ║      index.html (no separate JS/CSS files)                   ║
 * ║    • Hyperbeam CDN injected post-build for cloud browser     ║
 * ║    • /api/vm proxy → dev server forwards to Hyperbeam API    ║
 * ║                                                              ║
 * ║  Base: /studios/  (for GitHub Pages deployment)              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Node.js built-ins for path resolution ─────────────────────
import path from "path";
import { fileURLToPath } from "url";

// ── Vite plugins ───────────────────────────────────────────────
import tailwindcss from "@tailwindcss/vite";       // Tailwind CSS 4 Vite integration
import react from "@vitejs/plugin-react";           // React Fast Refresh + JSX transform
import { defineConfig, Plugin } from "vite";        // Vite's config helpers + Plugin type
import { viteSingleFile } from "vite-plugin-singlefile"; // Inlines ALL assets into one HTML file
import fs from "fs";                                 // Node filesystem (for build post-processing)

// ── __dirname polyfill (ESM doesn't have __dirname) ───────────
const __filename = fileURLToPath(import.meta.url);  // Convert file:// URL to absolute path
const __dirname = path.dirname(__filename);          // Get directory containing this config

/**
 * injectHyperbeamScript()
 * ────────────────────────────────────────────────────────────────
 * A custom Vite plugin that runs AFTER the build finishes.
 * 
 * Problem:
 *   vite-plugin-singlefile inlines ALL JS/CSS into one HTML file.
 *   But @hyperbeam/web can't be bundled (it uses dynamic features).
 *   So we load it from CDN via a <script type="module"> tag.
 * 
 * Solution:
 *   This plugin reads the built dist/index.html and injects the
 *   Hyperbeam CDN <script> just before </body>. The script sets
 *   window.__HYPERBEAM__ so the React Browser component can find it.
 * 
 * Timing:
 *   enforce: "post"   → runs after viteSingleFile has finished
 *   closeBundle()     → hook fires when the bundle is written to disk
 */
function injectHyperbeamScript(): Plugin {
  return {
    name: "inject-hyperbeam",            // Plugin name for debug logs
    enforce: "post",                     // Run LAST — after viteSingleFile

    closeBundle() {
      // Locate the built HTML file
      const distPath = path.resolve(__dirname, "dist", "index.html");

      // Skip if dist doesn't exist (e.g., during dev mode)
      if (!fs.existsSync(distPath)) return;

      // Read the entire HTML file as a string
      let html = fs.readFileSync(distPath, "utf-8");

      // The CDN script tag: loads @hyperbeam/web from unpkg CDN
      // and exposes it as window.__HYPERBEAM__ for React to consume.
      // Using unpkg.com/@hyperbeam/web@latest ensures we always get
      // the newest version (matching the npm package used in dev).
      const scriptTag =
        '<script type="module">' +
        'import H from"https://unpkg.com/@hyperbeam/web@latest/dist/index.js";' +
        'window.__HYPERBEAM__=H;' +
        '</script>';

      // Insert the script right before </body>
      html = html.replace("</body>", scriptTag + "</body>");

      // Write the modified HTML back to disk
      fs.writeFileSync(distPath, html, "utf-8");

      console.log("[inject-hyperbeam] Injected Hyperbeam CDN script into build");
    },
  };
}

// ── Vite Configuration ─────────────────────────────────────────
export default defineConfig({
  // ── Plugins (run in order) ──────────────────────────────────
  plugins: [
    react(),              // 1. React JSX + Fast Refresh
    tailwindcss(),        // 2. Tailwind CSS 4 processing
    viteSingleFile(),     // 3. Inline all JS/CSS/static assets into index.html
    injectHyperbeamScript(), // 4. Post-build: inject Hyperbeam CDN <script>
  ],

  // ── Base path ────────────────────────────────────────────────
  // /studios/ because GitHub Pages serves from https://<user>.github.io/studios/
  // All asset paths (like /wallpaper.jpg) are prefixed with this.
  base: "/studios/",

  // ── Path aliases ─────────────────────────────────────────────
  resolve: {
    alias: {
      // "@" → src/  (so `import X from "@/components/X"` works)
      "@": path.resolve(__dirname, "src"),
    },
  },

  // ── Dev Server ───────────────────────────────────────────────
  server: {
    proxy: {
      /**
       * /api/vm Proxy
       * ──────────────────────────────────────────────────────────
       * Pattern borrowed from cloud-chrome-hyperbeam/server.ts
       * 
       * Flow in dev mode:
       *   Browser → fetch('/api/vm')     ← same-origin, NO CORS issue
       *           → Vite dev server
       *           → rewrites to /v0/vm
       *           → forwards to engine.hyperbeam.com (HTTPS)
       *           → returns {embed_url, admin_token, session_id}
       * 
       * The Authorization header (user's API key) is forwarded
       * from the browser through to Hyperbeam. The API key lives
       * in the user's localStorage — it never touches our server.
       */
      "/api/vm": {
        target: "https://engine.hyperbeam.com",   // Hyperbeam's API host
        changeOrigin: true,                        // Rewrite Origin header to match target
        rewrite: () => "/v0/vm",                  // Strip /api prefix, route to /v0/vm

        // configure() lets us hook into the proxy's HTTP request lifecycle
        configure: (proxy) => {
          // proxyReq event fires before the request is sent to Hyperbeam.
          // We use it to forward the Authorization header from the browser.
          proxy.on("proxyReq", (proxyReq, req) => {
            // Forward the Bearer token (user's API key from localStorage)
            const auth = req.headers["authorization"];
            if (auth) proxyReq.setHeader("authorization", auth);

            // Forward Content-Type (application/json)
            if (req.headers["content-type"])
              proxyReq.setHeader("content-type", req.headers["content-type"]);
          });
        },
      },
    },
  },
});
