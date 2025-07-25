import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // You can add other configurations here if needed, e.g., base path for deployment
  // base: '/your-repo-name/', // if deploying to GitHub Pages or a subpath
});