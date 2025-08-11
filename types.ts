
export interface Shift {
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  dayOfWeek: string;
  isConflicting?: boolean;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
}
