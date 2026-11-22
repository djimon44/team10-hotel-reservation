// Date rules for a stay. Dates are 'YYYY-MM-DD' strings, which sort in date order,
// so they can be compared with < and > without creating Date objects.
import { z } from 'zod';

// Today on the server's calendar. toISOString() would give the UTC date, which is
// still yesterday in Tbilisi between 00:00 and 04:00.
function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// abort: true skips the later checks when the value isn't a real date.
export const dateString = z.iso.date({ error: 'Must be a real date as YYYY-MM-DD', abort: true });

export const checkInDate = dateString.refine((value) => value >= today(), 'Check-in cannot be in the past');
