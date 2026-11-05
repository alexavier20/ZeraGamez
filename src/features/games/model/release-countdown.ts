const MINUTE_MS = 60_000;

const saoPauloDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
});

function startOfReleaseDate(releaseDate: string): number {
  const [yearPart, monthPart, dayPart] = releaseDate.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const wallClock = Date.UTC(year, month - 1, day);
  let instant = wallClock;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(
      saoPauloDateTimeFormatter
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value]),
    );
    const localAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    instant = wallClock - (localAsUtc - instant);
  }

  return instant;
}

export interface ReleaseCountdown {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
}

export function getReleaseCountdown(releaseDate: string, now: number): ReleaseCountdown {
  const remainingMinutes = Math.max(
    0,
    Math.floor((startOfReleaseDate(releaseDate) - now) / MINUTE_MS),
  );

  return {
    days: Math.floor(remainingMinutes / (24 * 60)),
    hours: Math.floor((remainingMinutes % (24 * 60)) / 60),
    minutes: remainingMinutes % 60,
  };
}
