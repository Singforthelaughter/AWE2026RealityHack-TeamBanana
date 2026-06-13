/**
 * EventModule — a minimal observer/event helper.
 *
 * WHY THIS EXISTS: the original detection sample depended on an external "EventModule" that is no
 * longer in the project. This is a tiny, self-contained replacement so nothing in _Aggy relies on
 * any other folder.
 *
 * USAGE:
 *   const evt = new EventWrapper<Detection[]>()
 *   evt.add(callback)      // subscribe
 *   evt.trigger(payload)   // notify all subscribers
 *   evt.remove(callback)   // unsubscribe
 */
export class EventWrapper<T = any> {
  // All currently-subscribed callbacks.
  private callbacks: ((arg: T) => void)[] = []

  /** Subscribe a callback (ignored if null or already subscribed). */
  add(callback: (arg: T) => void): void {
    if (callback && this.callbacks.indexOf(callback) === -1) {
      this.callbacks.push(callback)
    }
  }

  /** Unsubscribe a previously-added callback. */
  remove(callback: (arg: T) => void): void {
    const index = this.callbacks.indexOf(callback)
    if (index !== -1) {
      this.callbacks.splice(index, 1)
    }
  }

  /**
   * Fire the event: call every subscriber with `arg`.
   * Iterates over a COPY so a callback that adds/removes during dispatch can't corrupt the loop.
   * Errors in one callback are caught so they don't stop the others.
   */
  trigger(arg: T): void {
    const list = this.callbacks.slice()
    for (let i = 0; i < list.length; i++) {
      try {
        list[i](arg)
      } catch (e) {
        print("EventWrapper callback error: " + e)
      }
    }
  }
}
