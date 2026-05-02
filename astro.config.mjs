import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://thevelatium.com',
  output: 'static',
  build: {
    assets: 'assets'
  }
});
