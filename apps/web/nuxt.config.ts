export default defineNuxtConfig({
  serverDir: 'server',
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/main.css'],
  ui: { fonts: false },
  devtools: { enabled: false },
  runtimeConfig: { matchProxySecret: '', webOrigin: '', public: { matchUrl: 'ws://127.0.0.1:2567' } },
  app: { head: { title: 'Crossline — Solo & Shared Arena', meta: [{name:'viewport',content:'width=device-width, initial-scale=1, viewport-fit=cover'}, { name: 'description', content: 'Five-minute Solo matches and one shared Online arena.' }] } },
})
