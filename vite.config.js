import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  return {
    // Use a conditional base path.
    // In 'serve' (development) mode, use the root '/'.
    // In 'build' (production) mode, use the repository name.
    base: command === 'serve' ? '/' : '/world-clock/',
    plugins: [],
  };
});