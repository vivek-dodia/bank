/** Working hours: Monday to Friday, from `open` to `close` minutes after midnight in the time zone `tz`. */
export type Hours = { tz: string; open: number; close: number }

const DAY = 24 * 60 * 60 * 1000
const MINUTE = 60 * 1000
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const formats = new Map<string, Intl.DateTimeFormat>()

export function validZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** The day of the week (0 is Sunday) and the milliseconds since midnight at `ts` in `tz`. */
function local(ts: number, tz: string) {
  let format = formats.get(tz)
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
    formats.set(tz, format)
  }
  const parts: Record<string, string> = {}
  for (const part of format.formatToParts(ts)) parts[part.type] = part.value
  return {
    day: DAYS.indexOf(parts.weekday ?? ""),
    ms: (Number(parts.hour) * 60 + Number(parts.minute)) * MINUTE + Number(parts.second) * 1000 + (ts % 1000),
  }
}

/**
 * How far `ts` is into the working day: `left` is the working time remaining today, or `skip` is how long until the
 * next time worth looking at. Skips are re-checked on arrival, so a clock change over the weekend corrects itself.
 */
function position(ts: number, hours: Hours): { left: number } | { skip: number } {
  const { day, ms } = local(ts, hours.tz)
  const open = hours.open * MINUTE
  const close = hours.close * MINUTE
  const workday = day >= 1 && day <= 5
  if (workday && ms >= open && ms < close) return { left: close - ms }
  if (workday && ms < open) return { skip: open - ms }
  return { skip: DAY - ms + open }
}

/** The moment `work` milliseconds of working time have passed since `ts`. */
export function advance(ts: number, work: number, hours: Hours) {
  for (let i = 0; i < 1000; i++) {
    const at = position(ts, hours)
    if ("skip" in at) {
      ts += at.skip
      continue
    }
    if (work <= at.left) return ts + work
    ts += at.left
    work -= at.left
  }
  return ts
}

/** The working time between two moments. */
export function worked(from: number, to: number, hours: Hours) {
  let total = 0
  for (let i = 0; i < 1000 && from < to; i++) {
    const at = position(from, hours)
    if ("skip" in at) {
      from += at.skip
      continue
    }
    const span = Math.min(at.left, to - from)
    total += span
    from += span
  }
  return total
}
