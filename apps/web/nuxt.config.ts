export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui'],
  css: ['~/assets/main.css'],
  ui: { fonts: false },
  devtools: { enabled: false },
  runtimeConfig: { public: { matchUrl: 'ws://127.0.0.1:2567' } },
  app: { head: { title: 'Crossline — Enter the proving ground', meta: [{name:'viewport',content:'width=device-width, initial-scale=1, viewport-fit=cover'}, { name: 'description', content: 'Crossline live-fire training on Mercer Block.' }] } },
})
