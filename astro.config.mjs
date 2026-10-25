// @ts-check
import { defineConfig } from 'astro/config';

// Set SITE_URL in your host's build settings (e.g. https://twentieth-century.pages.dev).
// It is used for canonical URLs, Open Graph images and the sitemap.
const site = process.env.SITE_URL || 'https://example.pages.dev';

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  i18n: {
    // Add 'it' here (and src/i18n/it.ts, content/days/it/) when Italian arrives.
    locales: ['en'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    ssr: { external: ['@resvg/resvg-js'] },
    optimizeDeps: { exclude: ['@resvg/resvg-js'] },
  },
});
