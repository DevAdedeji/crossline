<script setup lang="ts">
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
 <div class="touch-controls" aria-label="Touch controls" @contextmenu.prevent>
  <div class="look-zone" data-testid="touch-look" aria-label="Swipe to look" @pointerdown="lookStart" @pointermove="lookMove" @pointerup="lookEnd" @pointercancel="lookEnd" @lostpointercapture="lookEnd"><span>SWIPE TO LOOK</span></div>
  <div ref="stick" class="move-stick" data-testid="touch-move" aria-label="Movement joystick" @pointerdown="moveStart" @pointermove="movement" @pointerup="moveEnd" @pointercancel="moveEnd" @lostpointercapture="moveEnd"><i :style="{transform:`translate(${offset.x}px,${offset.y}px)`}"/></div>
  <button class="touch-fire" aria-label="Fire" :class="{pressed:firing}" @pointerdown.stop="fireStart" @pointerup="fireEnd" @pointercancel="fireEnd" @lostpointercapture="fireEnd">FIRE</button>
  <button class="touch-aim" aria-label="Aim" :aria-pressed="aimed" @pointerdown.stop.prevent="aimed=!aimed;emit('aim',aimed)">AIM</button>
  <button class="touch-reload" aria-label="Reload" @pointerdown.stop.prevent="emit('reload')">RELOAD</button>
  <button class="touch-crouch" aria-label="Crouch" :aria-pressed="props.crouched" @pointerdown.stop.prevent="emit('crouch')">CROUCH</button>
  <button class="touch-pause" aria-label="Pause" @pointerdown.stop.prevent="emit('pause')">Ⅱ</button>
 </div>
</template>
<style scoped>
.touch-controls{position:absolute;inset:0;pointer-events:none;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none}
.touch-controls button,.move-stick,.look-zone{pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent}
.look-zone{position:absolute;left:40%;right:0;top:50px;bottom:62px}
.look-zone span{position:absolute;top:14%;left:20%;font-size:8px;letter-spacing:2px;color:#ffffff45;pointer-events:none}
.move-stick{position:absolute;left:max(22px,env(safe-area-inset-left));bottom:calc(96px + env(safe-area-inset-bottom));width:108px;height:108px;border:1px solid #ffffff50;border-radius:50%;background:#13202065;display:grid;place-items:center}
.move-stick i{width:42px;height:42px;border-radius:50%;background:#e9f2e355;border:1px solid #ffffff80;pointer-events:none}
.move-stick span{position:absolute;bottom:-16px;font-size:8px;letter-spacing:2px;color:#e6efdf9a}
button{position:absolute;border:1px solid #edf8ed80;border-radius:50%;background:#162322b0;color:#f1f5ed;width:51px;height:51px;font-size:9px;font-weight:bold;display:grid;place-items:center;padding:0}
button[aria-pressed=true],button.pressed{background:#ffb15cbd;color:#101915;border-color:#ffb15c}
.touch-fire{right:calc(24px + env(safe-area-inset-right));bottom:calc(150px + env(safe-area-inset-bottom));width:66px;height:66px;font-size:12px}
.touch-aim{right:calc(102px + env(safe-area-inset-right));bottom:calc(162px + env(safe-area-inset-bottom))}
.touch-reload{right:calc(102px + env(safe-area-inset-right));bottom:calc(92px + env(safe-area-inset-bottom))}
.touch-crouch{right:calc(28px + env(safe-area-inset-right));bottom:calc(92px + env(safe-area-inset-bottom))}
.touch-pause{top:max(10px,env(safe-area-inset-top));left:calc(50% - 19px);width:38px;height:32px;border-radius:6px;font-size:17px}
</style>
