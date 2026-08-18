import { defineConfig } from 'vite';

/** `BASE_PATH` is set by the deploy workflow; GitHub Pages serves from /<repo>/. */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: { host: true, port: 5174 },
});
