declare global {
  var timeManager: TimeManager
}

interface TimeoutObject {
  id: number
  callback: () => void
  remainingTime: number
}

interface IntervalObject extends TimeoutObject {
  delay: number
}

@component
export class TimeManager extends BaseScriptComponent {
  private static instance: TimeManager
  private timeouts: TimeoutObject[] = []
  private intervals: IntervalObject[] = []
  private idCounter: number = 0

  onAwake(): void {
    TimeManager.instance = this
    ;(global as any).timeManager = this
    this.createEvent("UpdateEvent").bind(this.update.bind(this))
  }

  /**
   * Returns the singleton `TimeManager` instance.
   *
   * @example
   * const tm = TimeManager.getInstance()
   * tm.setTimeout(() => {
   *   print("Runs once after 1 second")
   * }, 1000)
   */
  public static getInstance(): TimeManager {
    if (!TimeManager.instance) {
      TimeManager.instance = new TimeManager()
    }
    return TimeManager.instance
  }

  private update(eventData: UpdateEvent): void {
    const deltaTime = eventData.getDeltaTime()

    // Update timeouts
    for (let i = this.timeouts.length - 1; i >= 0; i--) {
      const timeoutObj = this.timeouts[i]
      timeoutObj.remainingTime -= deltaTime
      if (timeoutObj.remainingTime <= 0) {
        timeoutObj.callback()
        this.timeouts.splice(i, 1)
      }
    }

    // Update intervals
    for (let i = 0; i < this.intervals.length; i++) {
      const intervalObj = this.intervals[i]
      intervalObj.remainingTime -= deltaTime
      if (intervalObj.remainingTime <= 0) {
        intervalObj.callback()
        intervalObj.remainingTime = intervalObj.delay
      }
    }
  }

  /**
   * Schedules a callback to run once after `delay` milliseconds.
   *
   * @example
   * const timeoutId = getTimeManager().setTimeout(() => {
   *   print("Timeout finished")
   * }, 2000)
   */
  public setTimeout(callback: () => void, delay: number): number {
    const timeoutId = this.idCounter++
    this.timeouts.push({
      id: timeoutId,
      callback: callback,
      remainingTime: delay / 1000,
    })
    return timeoutId
  }

  /**
   * Cancels a timeout previously created with `setTimeout`.
   *
   * @example
   * const tm = getTimeManager()
   * const timeoutId = tm.setTimeout(() => {
   *   print("This will not run")
   * }, 3000)
   * tm.clearTimeout(timeoutId)
   */
  public clearTimeout(timeoutId: number): void {
    const index = this.timeouts.findIndex((timeout) => timeout.id === timeoutId)
    if (index !== -1) {
      this.timeouts.splice(index, 1)
    }
  }

  /**
   * Repeats a callback every `delay` milliseconds until cleared.
   *
   * @example
   * const intervalId = getTimeManager().setInterval(() => {
   *   print("Runs every second")
   * }, 1000)
   */
  public setInterval(callback: () => void, delay: number): number {
    const intervalId = this.idCounter++
    this.intervals.push({
      id: intervalId,
      callback: callback,
      remainingTime: delay / 1000,
      delay: delay / 1000,
    })
    return intervalId
  }

  /**
   * Stops an interval previously created with `setInterval`.
   *
   * @example
   * const tm = getTimeManager()
   * const intervalId = tm.setInterval(() => {
   *   print("Tick")
   * }, 1000)
   * tm.clearInterval(intervalId)
   */
  public clearInterval(intervalId: number): void {
    const index = this.intervals.findIndex((interval) => interval.id === intervalId)
    if (index !== -1) {
      this.intervals.splice(index, 1)
    }
  }
}

// Export a helper function to get the instance
/**
 * Convenience helper for accessing the `TimeManager` singleton.
 *
 * @example
 * import { getTimeManager } from "./TimeManager"
 *
 * const tm = getTimeManager()
 * tm.setTimeout(() => {
 *   print("Using helper accessor")
 * }, 500)
 */
export function getTimeManager(): TimeManager {
  return TimeManager.getInstance()
}
