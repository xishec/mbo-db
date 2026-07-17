export interface DETCalendarEntry {
  season: string;
  date: string;
  start: string;
  end: string;
  censusStart: string;
  censusEnd: string;
}

let calendarPromise: Promise<Record<string, DETCalendarEntry>> | null = null;

export function loadDETCalendar(): Promise<Record<string, DETCalendarEntry>> {
  if (!calendarPromise) {
    calendarPromise = fetch("/data/det-calendar.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load DET calendar: ${response.status}`);
        }
        return response.json() as Promise<Record<string, DETCalendarEntry>>;
      })
      .then((calendar) => calendar ?? {});
  }

  return calendarPromise;
}
