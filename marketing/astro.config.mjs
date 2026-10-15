import { defineConfig } from 'astro/config';
import { loadSnapshot } from './content.mjs';

const snapshot = loadSnapshot();

export default defineConfig({
  output: 'static',
  site: `https://about-${snapshot.appId}.proappstore.online`,
  outDir: process.env.PAS_MARKETING_OUT_DIR ?? './dist',
  publicDir: process.env.PAS_MARKETING_PUBLIC_DIR ?? './public',
});
