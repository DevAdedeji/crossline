<script setup lang="ts">
const props = defineProps<{ remainingMs: number; durationMs: number; killer?: string }>()
const seconds = computed(() => Math.ceil(Math.max(0, props.remainingMs) / 1000))
const progress = computed(() => Math.min(100, Math.max(0, (1 - props.remainingMs / props.durationMs) * 100)))
</script>
<template>
  <div class="respawn-overlay" data-testid="respawn-overlay">
    <section class="respawn-card" aria-label="Respawning">
      <div class="respawn-heading">
        <span class="respawn-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/><circle cx="12" cy="12" r="10"/></svg></span>
        <div><p class="respawn-eyebrow">BACK IN THE FIGHT SOON</p><h2>You were eliminated.</h2></div>
      </div>
      <p class="respawn-opponent" role="status">{{ killer ? 'Eliminated by' : 'Take a breath. You’ll be back.' }} <strong v-if="killer">{{ killer }}</strong></p>
      <div class="respawn-countdown"><div><span>Next deployment</span><p>{{ seconds > 0 ? 'Finding your next opening.' : 'Returning to the arena…' }}</p></div><strong data-testid="respawn-countdown">{{ seconds > 0 ? seconds : '…' }}<small v-if="seconds > 0">s</small></strong></div>
      <div class="respawn-track" role="progressbar" aria-label="Respawn progress" :aria-valuenow="Math.round(progress)" :aria-valuemin="0" :aria-valuemax="100"><i :style="{ width: `${progress}%` }" /></div>
      <p class="respawn-note">Fresh position <span>·</span> Full health <span>·</span> Reloaded</p>
    </section>
  </div>
</template>
<style scoped>
.respawn-overlay{position:absolute;inset:0;z-index:10;display:grid;place-items:center;background:radial-gradient(ellipse,#11151920,#111519a6);pointer-events:none}
.respawn-card{width:min(390px,calc(100vw - 40px));padding:24px;background:#191f24f2;border:1px solid var(--cl-line);border-top:2px solid #ff927c;border-radius:10px;box-shadow:0 16px 60px #0006;backdrop-filter:blur(12px);animation:respawn-enter .2s ease-out;color:var(--cl-text)}
.respawn-heading{display:flex;align-items:center;gap:12px}.respawn-symbol{display:grid;place-items:center;width:38px;height:38px;flex-shrink:0;background:#ff927c14;border:1px solid #ff927c40;border-radius:50%;color:#ff927c}.respawn-symbol svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round}.respawn-eyebrow{font-size:9px;font-weight:650;letter-spacing:.07em;color:#ffac99;margin-bottom:5px}h2{font-size:23px;font-weight:750;line-height:1.1;letter-spacing:-.035em}.respawn-opponent{font-size:12px;color:var(--cl-muted);margin:14px 0 20px}.respawn-opponent strong{font-weight:650;color:var(--cl-text);margin-left:4px;overflow-wrap:anywhere}
.respawn-countdown{display:flex;align-items:center;justify-content:space-between;gap:20px}.respawn-countdown span{font-size:13px;font-weight:650}.respawn-countdown p{font-size:11px;color:var(--cl-muted);margin-top:4px}.respawn-countdown strong{font-size:38px;font-weight:650;line-height:1;font-variant-numeric:tabular-nums;color:var(--cl-accent);min-width:50px;text-align:right}.respawn-countdown small{font-size:15px;font-weight:400;margin-left:3px;color:var(--cl-muted)}.respawn-track{height:4px;margin-top:14px;background:#ffffff19;border-radius:3px;overflow:hidden}.respawn-track i{display:block;height:100%;background:var(--cl-accent);transition:width .05s linear}.respawn-note{font-size:10px;color:var(--cl-muted);margin-top:12px;text-align:center}.respawn-note span{margin:0 7px;color:#ffffff40}
@keyframes respawn-enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@media(max-height:500px){.respawn-card{width:min(350px,calc(100vw - 32px));padding:18px 20px}h2{font-size:21px}.respawn-opponent{margin:10px 0 14px}.respawn-countdown strong{font-size:32px}.respawn-note{margin-top:10px}.respawn-track{margin-top:10px}}
</style>
