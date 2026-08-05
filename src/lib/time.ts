export const KYIV_TIME_ZONE = 'Europe/Kyiv';

const kyivDatePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KYIV_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function datePart(parts: Intl.DateTimeFormatPart[], type: 'year' | 'month' | 'day'): string {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Не вдалося визначити ${type} для часового поясу ${KYIV_TIME_ZONE}.`);
  return value;
}

function parseDateKey(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Некоректна дата: ${value}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day
  ) {
    throw new Error(`Некоректна дата: ${value}`);
  }

  return { year, month, day };
}

export function getKyivDateKey(date = new Date()): string {
  const parts = kyivDatePartsFormatter.formatToParts(date);
  return `${datePart(parts, 'year')}-${datePart(parts, 'month')}-${datePart(parts, 'day')}`;
}

export function addDaysToDateKey(value: string, amount: number): string {
  const { year, month, day } = parseDateKey(value);
  const result = new Date(Date.UTC(year, month - 1, day + amount, 12));
  const resultYear = result.getUTCFullYear();
  const resultMonth = String(result.getUTCMonth() + 1).padStart(2, '0');
  const resultDay = String(result.getUTCDate()).padStart(2, '0');
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

export function dateKeyToStableDate(value: string): Date {
  const { year, month, day } = parseDateKey(value);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatKyivDateKey(
  value: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'uk-UA',
): string {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: KYIV_TIME_ZONE,
  }).format(dateKeyToStableDate(value));
}

export function isKyivWeekday(value: string, weekday: number): boolean {
  const date = dateKeyToStableDate(value);
  const day = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: KYIV_TIME_ZONE,
    weekday: 'short',
  }).format(date) === 'Sun'
    ? 0
    : new Intl.DateTimeFormat('en-US', {
      timeZone: KYIV_TIME_ZONE,
      weekday: 'short',
    }).format(date) === 'Mon'
      ? 1
      : new Intl.DateTimeFormat('en-US', {
        timeZone: KYIV_TIME_ZONE,
        weekday: 'short',
      }).format(date) === 'Tue'
        ? 2
        : new Intl.DateTimeFormat('en-US', {
          timeZone: KYIV_TIME_ZONE,
          weekday: 'short',
        }).format(date) === 'Wed'
          ? 3
          : new Intl.DateTimeFormat('en-US', {
            timeZone: KYIV_TIME_ZONE,
            weekday: 'short',
          }).format(date) === 'Thu'
            ? 4
            : new Intl.DateTimeFormat('en-US', {
              timeZone: KYIV_TIME_ZONE,
              weekday: 'short',
            }).format(date) === 'Fri'
              ? 5
              : 6);
  return day === weekday;
}

export function millisecondsUntilNextKyivDay(now = new Date()): number {
  const currentKey = getKyivDateKey(now);
  const start = now.getTime();
  let lowerBound = start;
  let upperBound = start + (36 * 60 * 60 * 1000);

  if (getKyivDateKey(new Date(upperBound)) === currentKey) {
    upperBound = start + (48 * 60 * 60 * 1000);
  }

  while (upperBound - lowerBound > 1000) {
    const midpoint = Math.floor((lowerBound + upperBound) / 2);
    if (getKyivDateKey(new Date(midpoint)) === currentKey) lowerBound = midpoint;
    else upperBound = midpoint;
  }

  return Math.max(1000, upperBound - start + 250);
}
