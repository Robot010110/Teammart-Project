// csvParse.js — parses a .csv export of the company's attendance system
// into the shape POST /api/attendance/import expects (see
// importAttendanceRecordsSchema in backend/src/utils/validate.js).
//
// TODO(supervisor-import-ui): no screen calls this yet — there is no
// Supervisor/Admin UI in this codebase to upload an attendance export.
// Built now so the backend import endpoint is exercised by a real parser
// end-to-end (see attendanceController.js's importAttendanceRecords),
// ready for that screen to wire up: read the File with `file.text()`,
// pass the result to parseAttendanceCsv(), POST the `records` array to
// attendance/import via a new staff-only service function.
//
// Expected header row (order doesn't matter, extra columns are ignored):
//   employeeCode,date,status,shift,checkIn,checkOut,breakStart,breakEnd,dayOffType
// `status` defaults to PRESENT if omitted. Date/time columns should be
// ISO-parseable strings (e.g. "2026-07-28", "2026-07-28T08:00:00").

function parseCsvLine(line) {
  // Handles quoted fields containing commas — attendance exports
  // routinely quote free-text columns even though none of the columns
  // this app reads need it, so this is cheap insurance against a real
  // export breaking a naive split(",").
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Returns { records, errors } — errors are { line, message } for rows
// that couldn't be parsed, so a bad row in the file doesn't block the
// good ones (same "partial success" philosophy as the import endpoint
// itself).
export function parseAttendanceCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { records: [], errors: [] };

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const records = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((key, idx) => {
      const value = values[idx]?.trim();
      if (value) row[key] = value;
    });

    if (!row.employeeCode || !row.date) {
      errors.push({ line: i + 1, message: "Missing employeeCode or date" });
      continue;
    }
    records.push(row);
  }

  return { records, errors };
}
