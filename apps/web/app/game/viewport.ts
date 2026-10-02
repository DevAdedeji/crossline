export interface ArenaViewport {width:number;height:number;portrait:boolean}
/** iOS standalone viewports may settle after orientationchange, without a window resize. */
export function observeArenaViewport(change:(viewport:ArenaViewport)=>void){
 let frame=0,stopped=false,last='',timers:ReturnType<typeof setTimeout>[]=[]
 function measure(){
  if(stopped)return
  const visual=window.visualViewport,unscaled=!visual||Math.abs(visual.scale-1)<.02
  const width=Math.round(unscaled&&visual?visual.width:window.innerWidth),height=Math.round(unscaled&&visual?visual.height:window.innerHeight)
  if(width<1||height<1)return
  const key=`${width}/${height}`
  if(key===last)return
  last=key;change({width,height,portrait:height>width})
 }
 function settle(){
  measure();cancelAnimationFrame(frame);timers.forEach(clearTimeout)
  frame=requestAnimationFrame(()=>{measure();frame=requestAnimationFrame(measure)})
  timers=[150,450,900].map(delay=>setTimeout(measure,delay))
 }
 function foreground(){if(!document.hidden)settle()}
 const visual=window.visualViewport,orientation=window.screen.orientation
 window.addEventListener('resize',settle);window.addEventListener('orientationchange',settle);window.addEventListener('pageshow',settle)
 visual?.addEventListener('resize',settle);orientation?.addEventListener('change',settle)
 document.addEventListener('visibilitychange',foreground)
 const observer=new ResizeObserver(settle);observer.observe(document.documentElement)
 // Last-resort dimension check for standalone WebKit versions that omit resize events.
 const poll=setInterval(()=>{if(!document.hidden)measure()},500)
 settle()
 return ()=>{stopped=true;cancelAnimationFrame(frame);timers.forEach(clearTimeout);clearInterval(poll);observer.disconnect();window.removeEventListener('resize',settle);window.removeEventListener('orientationchange',settle);window.removeEventListener('pageshow',settle);visual?.removeEventListener('resize',settle);orientation?.removeEventListener('change',settle);document.removeEventListener('visibilitychange',foreground)}
}
