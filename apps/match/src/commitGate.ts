/** Hold public state until every idempotent ledger entry commits. A failed commit
 * freezes the arena instead of acknowledging scores that only exist in memory. */
export class CommitGate {
  private pending?: { persist: () => Promise<void>; publish: () => void }
  private running?: Promise<void>
  get blocked() {
    return Boolean(this.pending)
  }
  submit(persist: () => Promise<void>, publish: () => void) {
    if (this.pending) throw new Error('A score commit is already pending')
    this.pending = { persist, publish }
    return this.retry()
  }
  retry(): Promise<void> {
    if (this.running) return this.running
    const pending = this.pending
    if (!pending) return Promise.resolve()
    this.running = (async () => {
      try {
        await pending.persist()
        this.pending = undefined
        pending.publish()
      } catch {
        /* Retry with the same event IDs; never publish uncommitted scores. */
      } finally {
        this.running = undefined
      }
    })()
    return this.running
  }
}
