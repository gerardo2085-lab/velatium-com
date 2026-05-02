import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://thevelatium.com',
  output: 'static',
  publicDir: './public',
  build: {
    assets: 'assets'
  }
});
