<script setup lang="ts">
const preferences = useTouchPreferences()
const props=defineProps<{crouched:boolean}>()
const emit=defineEmits<{move:[x:number,z:number];look:[x:number,y:number];fire:[pressed:boolean];aim:[pressed:boolean];reload:[];crouch:[];pause:[]}>()
const stick=ref<HTMLElement>(),offset=ref({x:0,y:0}),aimed=ref(false),firing=ref(false)
let moveId:number|undefined,lookId:number|undefined,fireId:number|undefined,last={x:0,y:0}
function capture(event:PointerEvent){event.preventDefault();(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)}
function movement(event:PointerEvent){
 if(event.pointerId!==moveId||!stick.value)return
 const box=stick.value.getBoundingClientRect(),dx=event.clientX-box.left-box.width/2,dy=event.clientY-box.top-box.height/2,r=box.width*.36,d=Math.max(r,Math.hypot(dx,dy))
 offset.value={x:dx/d*r,y:dy/d*r};emit('move',Math.abs(dx/d)<.08?0:dx/d,Math.abs(dy/d)<.08?0:-dy/d)
}
function moveStart(event:PointerEvent){if(moveId!==undefined)return;capture(event);moveId=event.pointerId;movement(event)}
function moveEnd(event:PointerEvent){if(event.pointerId!==moveId)return;moveId=undefined;offset.value={x:0,y:0};emit('move',0,0)}
function lookStart(event:PointerEvent){if(lookId!==undefined)return;capture(event);lookId=event.pointerId;last={x:event.clientX,y:event.clientY}}
function lookMove(event:PointerEvent){if(event.pointerId!==lookId)return;emit('look',event.clientX-last.x,event.clientY-last.y);last={x:event.clientX,y:event.clientY}}
function lookEnd(event:PointerEvent){if(event.pointerId===lookId)lookId=undefined}
function fireStart(event:PointerEvent){if(fireId!==undefined)return;capture(event);fireId=event.pointerId;firing.value=true;emit('fire',true)}
function fireEnd(event:PointerEvent){if(event.pointerId!==fireId)return;fireId=undefined;firing.value=false;emit('fire',false)}
function reset(){moveId=undefined;lookId=undefined;fireId=undefined;offset.value={x:0,y:0};firing.value=false;aimed.value=false;emit('move',0,0);emit('fire',false);emit('aim',false)}
onBeforeUnmount(reset)
</script>
<template>
 <div class="touch-controls" :style="{'--touch-scale':preferences.size/100,'--touch-opacity':preferences.opacity/100}" aria-label="Touch controls" @contextmenu.prevent>
  <div class="look-zone" data-testid="touch-look" aria-label="Swipe to look" @pointerdown="lookStart" @pointermove="lookMove" @pointerup="lookEnd" @pointercancel="lookEnd" @lostpointercapture="lookEnd"><span>SWIPE TO LOOK</span></div>
  <div ref="stick" class="move-stick" data-testid="touch-move" aria-label="Movement joystick" @pointerdown="moveStart" @pointermove="movement" @pointerup="moveEnd" @pointercancel="moveEnd" @lostpointercapture="moveEnd"><i :style="{transform:`translate(${offset.x}px,${offset.y}px)`}"/></div>
  <button class="touch-fire" aria-label="Fire" :class="{pressed:firing}" @pointerdown.stop="fireStart" @pointerup="fireEnd" @pointercancel="fireEnd" @lostpointercapture="fireEnd"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 2v6m0 8v6M2 12h6m8 0h6"/></svg><span>Fire</span></button>
  <button class="touch-aim" aria-label="Aim" :aria-pressed="aimed" @pointerdown.stop.prevent="aimed=!aimed;emit('aim',aimed)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/></svg><span>Aim</span></button>
  <button class="touch-reload" aria-label="Reload" @pointerdown.stop.prevent="emit('reload')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6"/></svg><span>Reload</span></button>
  <button class="touch-crouch" aria-label="Crouch" :aria-pressed="props.crouched" @pointerdown.stop.prevent="emit('crouch')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="14" cy="4" r="2"/><path d="m12 8-4 6 7 2-3 5m0-13 3 5h5M8 14l-4 7"/></svg><span>Crouch</span></button>
  <button class="touch-pause" aria-label="Pause" @pointerdown.stop.prevent="emit('pause')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg></button>
 </div>
</template>
<style scoped>
.touch-controls{position:absolute;inset:0;pointer-events:none;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none}
.touch-controls button,.move-stick,.look-zone{pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent}
.look-zone{position:absolute;left:40%;right:0;top:50px;bottom:62px}
.look-zone span{position:absolute;top:14%;left:20%;font-size:9px;color:#ffffff65;pointer-events:none}
.move-stick{position:absolute;left:max(22px,env(safe-area-inset-left));bottom:calc(92px + env(safe-area-inset-bottom));width:calc(108px * var(--touch-scale));height:calc(108px * var(--touch-scale));border:1px solid #ffffff66;border-radius:50%;background:#111519a6;display:grid;place-items:center;opacity:var(--touch-opacity);box-shadow:inset 0 0 0 12px #ffffff06}
.move-stick i{width:40%;height:40%;border-radius:50%;background:#f5f2e96b;border:1px solid #ffffff99;pointer-events:none}
button{position:absolute;border:1px solid #ffffff80;border-radius:50%;background:#111519d9;color:var(--cl-text);width:calc(54px * var(--touch-scale));height:calc(54px * var(--touch-scale));display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;padding:0;opacity:var(--touch-opacity);transition:background .1s,border-color .1s;box-shadow:0 3px 12px #0003}
button svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}button span{font-size:9px;font-weight:600;line-height:1;pointer-events:none}
button[aria-pressed=true],button.pressed,button:active{background:#ffbb70e8;color:#111519;border-color:var(--cl-accent);opacity:1}
.touch-fire{right:calc(22px + env(safe-area-inset-right));bottom:calc(92px + 66px * var(--touch-scale) + env(safe-area-inset-bottom));width:calc(68px * var(--touch-scale));height:calc(68px * var(--touch-scale));border:2px solid #ffbb70bf;color:var(--cl-accent)}
.touch-fire svg{width:29px;height:29px}
.touch-aim{right:calc(22px + 82px * var(--touch-scale) + env(safe-area-inset-right));bottom:calc(92px + 72px * var(--touch-scale) + env(safe-area-inset-bottom))}
.touch-reload{right:calc(22px + 82px * var(--touch-scale) + env(safe-area-inset-right));bottom:calc(92px + env(safe-area-inset-bottom))}
.touch-crouch{right:calc(29px + env(safe-area-inset-right));bottom:calc(92px + env(safe-area-inset-bottom))}
.touch-pause{top:max(10px,env(safe-area-inset-top));left:calc(50% - 22px);width:44px;height:36px;border-radius:8px}
</style>
