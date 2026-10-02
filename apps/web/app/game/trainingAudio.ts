import type { Position } from '@crossline/shared'
import { RIFLE } from '@crossline/shared/combat'

/** Local CC0 field recordings. Reload playback follows authoritative simulation progress. */
export function trainingAudio() {
  let context: AudioContext | undefined,
    master: GainNode | undefined,
    muted = false
  let shots: AudioBuffer[] = [],
    healBuffer: AudioBuffer | undefined,
    reloadBuffer: AudioBuffer | undefined
  let reloadVoice: AudioBufferSourceNode | undefined,
    reloadKey = 0
  const voices = new Set<AudioBufferSourceNode>()
  async function prepare() {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = 0.8
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -2
    limiter.knee.value = 3
    limiter.ratio.value = 12
    limiter.attack.value = 0.002
    limiter.release.value = 0.1
    master.connect(limiter)
    limiter.connect(context.destination)
    const buffers = await Promise.all(
      ['ak47-shot-1-8f2b986d6d', 'ak47-shot-2-39946610b0', 'ak47-reload-d5c4b39405'].map(async (name) => {
        const response = await fetch(`/audio/${name}.wav`)
        if (!response.ok) throw new Error(`Audio unavailable: ${name}`)
        return context!.decodeAudioData(await response.arrayBuffer())
      }),
    )
    healBuffer=context.createBuffer(1,Math.ceil(context.sampleRate*.22),context.sampleRate)
    const chime=healBuffer.getChannelData(0)
    for(let i=0;i<chime.length;i++){const t=i/context.sampleRate;chime[i]=Math.sin(2*Math.PI*(t<.1?660:880)*t)*Math.sin(Math.PI*i/chime.length)*.15}
    shots = buffers.slice(0, 2)
    reloadBuffer = buffers[2]
  }
  function unlock() {
    void context?.resume()
  }
  function play(buffer: AudioBuffer, volume: number, panValue = 0, offset = 0, rate = 1) {
    if (!context || !master || context.state !== 'running' || muted) return
    const voice = context.createBufferSource(),
      gain = context.createGain(),
      pan = context.createStereoPanner()
    voice.buffer = buffer
    voice.playbackRate.value = rate
    gain.gain.value = volume
    pan.pan.value = panValue
    voice.connect(gain)
    gain.connect(pan)
    pan.connect(master)
    voices.add(voice)
    voice.onended = () => {
      voices.delete(voice)
      voice.disconnect()
      gain.disconnect()
      pan.disconnect()
    }
    voice.start(0, Math.max(0, Math.min(buffer.duration - 0.001, offset)))
    return voice
  }
  function sound(
    kind: 'shot' | 'hit' | 'death' | 'heal',
    own = true,
    source?: Position,
    listener?: Position,
    yaw = 0,
  ) {
    if(kind==='heal'){if(healBuffer)play(healBuffer,1);return}
    if (kind !== 'shot' || !shots.length) return
    const dx = (source?.x ?? 0) - (listener?.x ?? 0),
      dz = (source?.z ?? 0) - (listener?.z ?? 0),
      distance = Math.hypot(dx, dz)
    const volume = own ? 1 : 1 / Math.pow(1 + distance / 8, 1.3)
    const pan = own
      ? 0
      : Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(distance, 1)))
    play(shots[Math.floor(Math.random() * shots.length)]!, volume, pan)
  }
  function stopReload() {
    reloadVoice?.stop()
    reloadVoice = undefined
  }
  function reload(remaining: number, playing: boolean, key: number) {
    if (!playing || remaining <= 0 || muted) {
      stopReload()
      return
    }
    if (reloadVoice && reloadKey === key) return
    stopReload()
    reloadKey = key
    if (reloadBuffer) {
      const progress = Math.max(0, Math.min(1, 1 - remaining / RIFLE.reloadMs))
      reloadVoice = play(
        reloadBuffer,
        0.9,
        0,
        progress * reloadBuffer.duration,
        reloadBuffer.duration / (RIFLE.reloadMs / 1000),
      )
    }
  }
  function stop() {
    stopReload()
    for (const voice of voices) voice.stop()
    voices.clear()
  }
  return {
    prepare,
    unlock,
    sound,
    reload,
    stop,
    mute(value: boolean) {
      muted = value
      if (master) master.gain.value = value ? 0 : 0.8
      if (value) stop()
    },
    dispose() {
      stop()
      void context?.close()
    },
  }
}
