import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages sert le site sous /<nom-du-dépôt>/ : le workflow fournit BASE_PATH
  base: process.env.BASE_PATH ?? '/',
  test: {
    include: ['src/**/*.test.ts'],
  },
})
