import { defineConfig } from 'vite';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  // Vite is designed to automatically detect postcss.config.js and tailwind.config.js
  // in the project root. No extra css configuration is needed here.
  
  // Add this 'server' object
  server: {
    https: {
      key: fs.readFileSync('./localhost-key.pem'),
      cert: fs.readFileSync('./localhost.pem'),
    },
  },
});