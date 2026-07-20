import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://thevelatium.com',
  output: 'static',
  publicDir: './public',
  build: {
    assets: 'assets'
  },
  integrations: [sitemap()]
});
