import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Base is set for GitHub Pages deployment. 
  // Change '/your-repo-name/' to your repository name.
  base: '/', 
  build: {
    outDir: 'dist',
  },
});
