import { defineConfig } from 'vite';

/**
 * `BASE_PATH` exists for GitHub Pages, which serves a project site from a
 * subdirectory rather than the domain root. It is set by the deploy workflow
 * so the repository name stays out of the source.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: { host: true, port: 5173 },
});
