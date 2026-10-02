<script setup lang="ts">
import type { Leaderboard } from '@crossline/shared'
defineProps<{board?:Leaderboard;unavailable?:boolean}>()
</script>
<template>
 <section class="leaderboard" aria-label="Online leaderboard">
  <h2>ARENA LEADERS</h2>
  <p v-if="unavailable" role="status">Leaderboard unavailable. Play can continue; totals will retry.</p>
  <template v-else-if="board">
   <p data-testid="stats-durability">{{ board.durable ? 'PERSISTENT TOTALS' : 'TEMPORARY SERVER TOTALS · RESET ON RESTART' }}{{ board.delayed ? ' · SAVING DELAYED' : '' }}</p>
   <div class="leader-columns">
    <div v-for="column in [{title:'TOP KILLS',rows:board.topKills},{title:'TOP DEATHS',rows:board.topDeaths}]" :key="column.title">
     <h3>{{ column.title }}</h3>
     <ol :aria-label="column.title"><li v-for="(row,i) in column.rows" :key="row.id"><span>{{ i+1 }}. {{ row.displayName }}</span><strong>{{ column.title==='TOP KILLS'?row.kills:row.deaths }}</strong></li></ol>
     <p v-if="!column.rows.length">The arena is waiting for its first player.</p>
    </div>
   </div>
   <p class="identity-note">Totals belong to your account. Only usernames and match statistics are public.</p>
  </template>
  <p v-else>Loading leaders…</p>
 </section>
</template>
<style scoped>
.leaderboard {text-align:left;border-top:1px solid #ffffff26;padding-top:16px;margin-top:18px}h2{font-size:18px;font-weight:900;letter-spacing:.08em}h3{font-size:11px;color:#ffb15c;letter-spacing:.12em;margin:12px 0}p{font-size:10px;color:#adbbb9;line-height:1.5}.leader-columns{display:grid;grid-template-columns:1fr 1fr;gap:24px}li{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #ffffff10;font-size:11px}li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.identity-note{margin-top:12px}@media(max-width:520px){.leader-columns{grid-template-columns:1fr}}
</style>
