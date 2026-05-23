// @ts-check
import { defineConfig } from 'astro/config';

// chrisbenedict.me — personal site
// builds to ./dist as plain static files for GitHub Pages
export default defineConfig({
  site: 'https://chrisbenedict.me',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
