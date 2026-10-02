export type EntryInput = 'mouse' | 'touch' | 'pad'
interface Entry { input: EntryInput; audio: AudioContext }
let pending: Entry | undefined
/** Called inside the menu gesture, before asynchronous assets/room loading. */
export async function prepareEntry(input: EntryInput) {
  if (pending) void pending.audio.close()
  const audio = new AudioContext()
  void audio.resume()
  pending = { input, audio }
  if (input === 'mouse') {
    try { await document.documentElement.requestPointerLock() } catch { /* The arena offers capture retry. */ }
  }
}
export function takeEntry() { const value=pending;pending=undefined;return value }
