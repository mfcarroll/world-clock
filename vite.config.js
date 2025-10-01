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
      '/api/timezone': {
        target: 'https://api.timezonedb.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/timezone/, ''),
      },
    },
  },
});