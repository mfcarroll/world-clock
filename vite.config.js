import { defineConfig } from 'vite';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// https://vitejs.dev/config/
export default defineConfig({
  // Base is set for GitHub Pages deployment. 
  base: '/', 
  build: {
    outDir: 'dist',
  },
  // Explicitly define PostCSS plugins
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },
});

