/** Bounded acknowledgment tracking; a live socket alone does not mean inputs arrive. */
export class NetworkHealth {
 private sent=new Map<number,number>()
 private lastAck=0
 private acknowledgedAt=0
 latency=0
 reset(now:number){this.sent.clear();this.lastAck=0;this.acknowledgedAt=now;this.latency=0}
 command(seq:number,now:number){this.sent.set(seq,now);while(this.sent.size>40)this.sent.delete(this.sent.keys().next().value!)}
 acknowledge(seq:number,now:number){
  if(seq<=this.lastAck)return
  const sent=this.sent.get(seq);if(sent!==undefined)this.latency=now-sent
  this.lastAck=seq;this.acknowledgedAt=now
  for(const key of this.sent.keys())if(key<=seq)this.sent.delete(key)
 }
 state(now:number,buffered=0){
  const age=now-this.acknowledgedAt
  return age>=1000||buffered>8192?'stalled':age>=350||this.latency>=250?'weak':'good'
 }
}
