export default defineNuxtConfig({
  serverDir: 'server',
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui', '@vite-pwa/nuxt'],
  css: ['~/assets/main.css'],
  ui: { fonts: false },
  // Keep Babylon's shader/loader modules together. Hundreds of tiny dynamic
  // chunks congested cold mobile entry before the scene could connect.
  vite: {build: {rolldownOptions: {output: {codeSplitting: {groups: [{name: 'babylon', test: /\/@babylonjs\//}]}}}}},
  pwa: {
    strategies: 'injectManifest', srcDir: '../service-worker', filename: 'sw.ts',
    registerType: 'prompt', injectRegister: false, client: {registerPlugin: false},
    manifest: {
      id: '/', name: 'Crossline', short_name: 'Crossline', start_url: '/', scope: '/',
      description: 'Practice, Solo vs Bots and Online Free-for-All. Internet required.',
      display: 'standalone', orientation: 'landscape', lang: 'en',
      background_color: '#101619', theme_color: '#101619', categories: ['games'],
      icons: [
        {src:'/icons/icon-192.png', sizes:'192x192', type:'image/png', purpose:'any'},
        {src:'/icons/icon-512.png', sizes:'512x512', type:'image/png', purpose:'any'},
        {src:'/icons/maskable-512.png', sizes:'512x512', type:'image/png', purpose:'maskable'},
      ],
    },
    injectManifest: {
      globPatterns: ['offline.html', 'icons/*.png'], maximumFileSizeToCacheInBytes: 256 * 1024,
      // This is a real public file, not a prerendered Nuxt route: retain .html.
      // Exclude Nuxt's injected build metadata from the offline precache too.
      manifestTransforms: [async entries => ({manifest: entries.filter(entry => entry.url === 'offline.html' || /^icons\/[^/]+\.png$/.test(entry.url)), warnings: []})],
      buildPlugins: {vite: [{name: 'crossline-release', transform(code, id) {
        if (id.endsWith('/service-worker/sw.ts')) return code.replace('release: __CROSSLINE_RELEASE__', `release: ${JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`)}`)
      }}]},
    },
  },
  routeRules: {'/sw.js': {headers: {'cache-control': 'no-cache'}}, '/manifest.webmanifest': {headers: {'cache-control': 'no-cache'}}},
  devtools: { enabled: false },
  runtimeConfig: { matchProxySecret: '', webOrigin: '', public: { matchUrl: 'ws://127.0.0.1:2567' } },
  app: { head: { title: 'Crossline — Solo & Shared Arena', link: [{rel:'apple-touch-icon',href:'/icons/apple-touch-icon.png'},{rel:'icon',type:'image/svg+xml',href:'/icons/crossline.svg'}], meta: [{name:'theme-color',content:'#101619'},{name:'apple-mobile-web-app-capable',content:'yes'},{name:'apple-mobile-web-app-status-bar-style',content:'black-translucent'},{name:'apple-mobile-web-app-title',content:'Crossline'}, {name:'viewport',content:'width=device-width, initial-scale=1, viewport-fit=cover'}, { name: 'description', content: 'Five-minute Solo matches and one shared Online arena.' }] } },
})
