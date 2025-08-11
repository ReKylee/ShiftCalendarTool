
export interface Shift {
  date: string; 
  startTime: string; 
  endTime: string; 
  location: string;
  dayOfWeek: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
}
