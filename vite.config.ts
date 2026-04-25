import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    electron([
      {
        // Main process entry file of the Electron App.
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'better-sqlite3', 
                'playwright', 
                'playwright-core',
                'fluent-ffmpeg',
                'ffmpeg-static',
                'node:module',
                'node:path',
                'node:fs',
                'node:url',
                'node:crypto',
                'node:events',
                'node:stream',
                'node:http',
                'node:https',
                'node:util'
              ],
              output: {
                banner: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); globalThis.require = require;"
              }
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs'
              }
            }
          }
        }
      },
    ]),
    renderer(),
  ],
  server: {
    watch: {
      ignored: ['**/data.db*', '**/browser_profiles/**'],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: [
      'better-sqlite3', 
      'playwright', 
      'playwright-core',
      'fluent-ffmpeg',
      'ffmpeg-static'
    ]
  }
})
