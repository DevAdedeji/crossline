import type { Position } from '@crossline/shared'
/** Original layered audio: transient crack, low-frequency body, mechanical click and short room tail. */
export function trainingAudio() {
  let context: AudioContext | undefined,
    master: GainNode | undefined,
    compressor: DynamicsCompressorNode | undefined,
    noise: AudioBuffer | undefined,
    muted = false
  function unlock() {
    if (!context) {
      context = new AudioContext()
      master = context.createGain()
      master.gain.value = 0.45
      compressor = context.createDynamicsCompressor()
      compressor.threshold.value = -12
      compressor.knee.value = 12
      compressor.ratio.value = 5
      master.connect(compressor)
      compressor.connect(context.destination)
      noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    void context.resume()
  }
  function sound(
    kind: 'shot' | 'hit' | 'reload' | 'death',
    own = true,
    source?: Position,
    listener?: Position,
    yaw = 0,
  ) {
    if (muted || !context || context.state !== 'running' || !master || !noise) return
    const ctx = context,
      now = ctx.currentTime,
      output = ctx.createGain(),
      pan = ctx.createStereoPanner()
    const dx = (source?.x ?? 0) - (listener?.x ?? 0),
      dz = (source?.z ?? 0) - (listener?.z ?? 0),
      distance = Math.hypot(dx, dz)
    output.gain.value = own ? 1 : 1 / Math.pow(1 + distance / 8, 1.3)
    pan.pan.value = own
      ? 0
      : Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(distance, 1)))
    output.connect(pan)
    pan.connect(master)
    function burst(
      delay: number,
      duration: number,
      volume: number,
      frequency: number,
      type: BiquadFilterType,
    ) {
      const sample = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        gain = ctx.createGain()
      sample.buffer = noise!
      filter.type = type
      filter.frequency.value = frequency
      filter.Q.value = 0.7
      gain.gain.setValueAtTime(0.001, now + delay)
      gain.gain.exponentialRampToValueAtTime(volume, now + delay + 0.001)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration)
      sample.connect(filter)
      filter.connect(gain)
      gain.connect(output)
      sample.start(now + delay, Math.random() * 0.2, duration)
      sample.onended = () => {
        sample.disconnect()
        filter.disconnect()
        gain.disconnect()
      }
    }
    function body(delay: number, duration: number, volume: number, frequency: number) {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now + delay)
      oscillator.frequency.exponentialRampToValueAtTime(32, now + delay + duration)
      gain.gain.setValueAtTime(volume, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration)
      oscillator.connect(gain)
      gain.connect(output)
      oscillator.start(now + delay)
      oscillator.stop(now + delay + duration)
      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
      }
    }
    if (kind === 'shot') {
      burst(0, 0.045, 0.68, 2200, 'highpass')
      burst(0.008, 0.16, 0.8, 1400, 'lowpass')
      body(0, 0.12, 0.52, 135)
      burst(0.04, 0.08, 0.2, 3500, 'bandpass')
      burst(0.08, 0.24, 0.16, 950, 'lowpass')
    } else if (kind === 'hit') {
      burst(0, 0.08, 0.5, 900, 'lowpass')
      burst(0, 0.025, 0.25, 2600, 'bandpass')
      body(0, 0.07, 0.18, 160)
    } else if (kind === 'reload') {
      burst(0, 0.05, 0.28, 2600, 'bandpass')
      burst(0.32, 0.08, 0.38, 1700, 'bandpass')
      burst(1.25, 0.065, 0.45, 3200, 'bandpass')
    } else {
      body(0, 0.28, 0.25, 80)
      burst(0, 0.18, 0.22, 500, 'lowpass')
    }
    // Every voice is finite; disconnect its shared route after its longest layer has stopped.
    setTimeout(() => {
      output.disconnect()
      pan.disconnect()
    }, 1600)
  }
  return {
    unlock,
    sound,
    mute(value: boolean) {
      muted = value
    },
    dispose() {
      void context?.close()
    },
  }
}
