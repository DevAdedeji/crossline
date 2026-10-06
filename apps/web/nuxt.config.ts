import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
let offlineAssetRoot = ''
export default defineNuxtConfig({
  serverDir: 'server',
  experimental: { appManifest: false },
  hooks: {
    'nitro:init'(nitro) {
      offlineAssetRoot = nitro.options.output.publicDir
    },
  },
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui', '@vite-pwa/nuxt'],
  css: ['~/assets/main.css'],
  ui: { fonts: false },
  // Keep Babylon's shader/loader modules together. Hundreds of tiny dynamic
  // chunks congested cold mobile entry before the scene could connect.
  vite: {
    build: {
      rolldownOptions: {
        output: { codeSplitting: { groups: [{ name: 'babylon', test: /\/@babylonjs\// }] } },
      },
    },
  },
  pwa: {
    strategies: 'injectManifest',
    srcDir: '../service-worker',
    filename: 'sw.ts',
    registerType: 'prompt',
    injectRegister: false,
    client: { registerPlugin: false },
    manifest: {
      id: '/',
      name: 'Crossline',
      short_name: 'Crossline',
      start_url: '/',
      scope: '/',
      description:
        'Campaign and Online Free-for-All. Download Campaign for offline play. Online needs internet.',
      display: 'standalone',
      orientation: 'landscape',
      lang: 'en',
      background_color: '#101619',
      theme_color: '#101619',
      categories: ['games'],
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/icons/maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    injectManifest: {
      globPatterns: [
        'offline.html',
        'offline-shell/**/*.html',
        'icons/*.png',
        '_nuxt/**/*.js',
        '_nuxt/**/*.css',
        'models/*.glb',
        'audio/*.wav',
        'textures/*.jpg',
        'images/mercer-menu.jpg',
        'campaign/*.jpg',
      ],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      // Build-time public files only. SHA-256 protects resumable downloads from
      // mixing non-hashed model URLs across releases; no session HTML is saved.
      manifestTransforms: [
        async (entries) => ({
          manifest: await Promise.all(
            entries
              .filter((entry) => !/quaternius-|_nuxt\/builds\//.test(entry.url))
              .map(async (entry) => {
                const bytes = await readFile(resolve(offlineAssetRoot, entry.url))
                return {
                  ...entry,
                  revision: createHash('sha256').update(bytes).digest('hex'),
                  bytes: bytes.length,
                }
              }),
          ),
          warnings: [],
        }),
      ],
      buildPlugins: {
        vite: [
          {
            name: 'crossline-release',
            transform(code, id) {
              if (id.endsWith('/service-worker/sw.ts'))
                return code.replace(
                  'release: __CROSSLINE_RELEASE__',
                  `release: ${JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`)}`,
                )
            },
          },
        ],
      },
    },
  },
  routeRules: {
    '/offline-shell': { ssr: false, prerender: true },
    '/sw.js': { headers: { 'cache-control': 'no-cache' } },
    '/manifest.webmanifest': { headers: { 'cache-control': 'no-cache' } },
  },
  devtools: { enabled: false },
  runtimeConfig: {
    matchProxySecret: '',
    webOrigin: '',
    public: { matchUrl: 'ws://127.0.0.1:2567' },
  },
  app: {
    head: {
      title: 'Crossline — Campaign & Online',
      link: [
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/crossline.svg' },
      ],
      meta: [
        { name: 'theme-color', content: '#101619' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Crossline' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          name: 'description',
          content: 'Twenty campaign missions and one shared Online Free-for-All arena.',
        },
      ],
    },
  },
})
