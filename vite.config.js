import { defineConfig } from 'vite';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem'),
    },
    proxy: {
      '/api/timezoneDB': {
        target: 'https://api.timezonedb.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/timezoneDB/, ''),
      },
      // --- NEW: Proxy for the Google Maps Time Zone API ---
      '/api/google-timezone': {
        target: 'https://maps.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/google-timezone/, '/maps/api/timezone'),
      },
    },
  },
});