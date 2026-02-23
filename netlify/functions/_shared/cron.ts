// Lightweight 5-field cron expression parser.
// Fields: minute hour day-of-month month day-of-week
// Supports: numbers, ranges (1-5), steps (e.g. every 15), lists (1,3,5), wildcards

interface CronField {
  values: Set<number>
}

function parseField(field: string, min: number, max: number): CronField {
  const values = new Set<number>()

  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i)
    } else if (part.includes('/')) {
      const [range, stepStr] = part.split('/')
      const step = parseInt(stepStr, 10)
      let start = min
      let end = max
      if (range !== '*') {
        if (range.includes('-')) {
          const [a, b] = range.split('-')
          start = parseInt(a, 10)
          end = parseInt(b, 10)
        } else {
          start = parseInt(range, 10)
        }
      }
      for (let i = start; i <= end; i += step) values.add(i)
    } else if (part.includes('-')) {
      const [a, b] = part.split('-')
      const start = parseInt(a, 10)
      const end = parseInt(b, 10)
      for (let i = start; i <= end; i++) values.add(i)
    } else {
      values.add(parseInt(part, 10))
    }
  }

  return { values }
}

interface ParsedCron {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

export function parseCron(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`)
  }

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: parseField(parts[4], 0, 6), // 0 = Sunday
  }
}

function matches(cron: ParsedCron, date: Date): boolean {
  return (
    cron.minute.values.has(date.getUTCMinutes()) &&
    cron.hour.values.has(date.getUTCHours()) &&
    cron.dayOfMonth.values.has(date.getUTCDate()) &&
    cron.month.values.has(date.getUTCMonth() + 1) &&
    cron.dayOfWeek.values.has(date.getUTCDay())
  )
}

/**
 * Compute the next UTC date/time that matches the cron expression,
 * starting from `after` (exclusive). Searches up to 366 days ahead.
 */
export function nextCronDate(expression: string, after: Date = new Date()): Date {
  const cron = parseCron(expression)

  // Start from the next minute
  const candidate = new Date(after.getTime())
  candidate.setUTCSeconds(0, 0)
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)

  // Search up to ~366 days (527040 minutes)
  const maxIterations = 527040
  for (let i = 0; i < maxIterations; i++) {
    if (matches(cron, candidate)) {
      return candidate
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1)
  }

  throw new Error(`No matching cron date found within 366 days for: ${expression}`)
}

/**
 * Return a human-readable description of a cron expression.
 */
export function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return expression

  const [min, hour, dom, mon, dow] = parts

  // Common patterns
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${min.slice(2)} minutes`
  }
  if (hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${hour.slice(2)} hours at minute ${min}`
  }
  if (dom === '*' && mon === '*' && dow === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`
  }
  if (dom === '*' && mon === '*' && dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dayList = dow.split(',').map((d) => days[parseInt(d, 10)] || d).join(', ')
    return `${dayList} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')} UTC`
  }

  return expression
}
