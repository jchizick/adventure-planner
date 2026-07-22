import { useState } from "react";
import { CalendarPlus, Download } from "lucide-react";
import {
  buildGoogleCalendarUrl,
  createCalendarExportEvent,
  downloadICalendar,
} from "./calendar-export";
import type { Adventure } from "./types";

export function AdventureCalendarExport({ adventure }: { adventure: Adventure }) {
  const [error, setError] = useState<string | null>(null);
  const event = createCalendarExportEvent(adventure);
  if (!event) return null;

  const googleUrl = buildGoogleCalendarUrl(event);
  const download = () => {
    setError(null);
    try {
      downloadICalendar(event);
    } catch {
      setError("We could not create the calendar file. Please try again.");
    }
  };

  return (
    <section className="calendar-export" aria-labelledby="calendar-export-title">
      <div>
        <h2 id="calendar-export-title">Add to calendar</h2>
        <p>
          Adds a copy to your external calendar. Future changes in Our Adventures
          will not update it automatically.
        </p>
      </div>
      <div className="calendar-export-actions">
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Add to Google Calendar (opens in a new tab)"
          onClick={() => setError(null)}
        >
          <CalendarPlus aria-hidden="true" />
          Google Calendar
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" onClick={download}>
          <Download aria-hidden="true" />
          Download .ics file
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
