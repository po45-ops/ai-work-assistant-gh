function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function nextCalendarDate(value: string) {
  if (!isIsoDate(value)) throw new Error("Calendar date is invalid");
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function previousCalendarDate(value: string) {
  if (!isIsoDate(value)) throw new Error("Calendar date is invalid");
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function googleAllDayRange(startDate: string, inclusiveEndDate = startDate) {
  if (!isIsoDate(startDate) || !isIsoDate(inclusiveEndDate) || inclusiveEndDate < startDate) {
    throw new Error("Calendar date range is invalid");
  }
  return {
    start: { date: startDate },
    // Google Calendar uses an exclusive end date for all-day events.
    end: { date: nextCalendarDate(inclusiveEndDate) },
  };
}
