import ExcelJS from "exceljs";

// attendanceExcel.js — parses the fingerprint system's Excel attendance
// export into the row shape attendanceImportRowSchema expects, and builds
// the multi-sheet monthly report workbook. Kept as its own utility (not
// inline in the controller) so the "how do we read/write .xlsx" detail
// stays in one place — attendanceController.js never touches ExcelJS
// directly, same "wrap the messy library behind one small module"
// pattern as utils/imageCompression.js / utils/barcodeScanner.js on the
// frontend.
//
// Column matching is header-name-based and forgiving about
// spacing/casing/punctuation ("Check-In", "check in", "CheckIn" all
// match) rather than requiring an exact column order — real exports from
// a third-party fingerprint system are not guaranteed to use one exact
// layout, and this is the one part of the app that has to tolerate data
// it doesn't fully control.

const HEADER_ALIASES = {
  employeeCode: ["employeecode", "employeeid", "id", "code", "employeecodeid"],
  date: ["date"],
  status: ["status"],
  shift: ["shift"],
  checkIn: ["checkin", "timein", "in"],
  checkOut: ["checkout", "timeout", "out"],
  breakStart: ["breakstart", "breakin"],
  breakEnd: ["breakend", "breakout"],
};

function normalizeHeader(text) {
  return String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Excel's date epoch is 1899-12-30 (with a deliberate leap-year bug baked
// into the format) — a numeric cell in a date/time column is a serial day
// count from that epoch.
function excelSerialToDate(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

function cellToDate(value) {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "number") return excelSerialToDate(value);
  return value; // string — left for zod's z.coerce.date() to parse
}

// A time-only cell (e.g. a "Check In" column with just "08:05") comes
// back from ExcelJS as a Date anchored to the Excel null-date
// (1899-12-30). Detect that and combine the time-of-day with the row's
// real date instead of leaving it stuck on a 126-year-old placeholder day.
function combineWithDate(value, rowDate) {
  const asDate = cellToDate(value);
  if (!(asDate instanceof Date) || !(rowDate instanceof Date)) return asDate;
  if (asDate.getFullYear() === 1899 && asDate.getMonth() === 11 && asDate.getDate() === 30) {
    const combined = new Date(rowDate);
    combined.setHours(asDate.getHours(), asDate.getMinutes(), asDate.getSeconds(), 0);
    return combined;
  }
  return asDate;
}

// Returns { rows, errors } — rows are raw objects matching
// attendanceImportRowSchema's shape (still need per-row zod validation,
// this only handles the spreadsheet-specific parsing/coercion). errors
// are sheet-structure problems (no header row, no recognizable columns)
// distinct from per-row validation errors, which the caller reports
// separately per row.
export async function parseAttendanceWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { rows: [], errors: ["The workbook has no sheets."] };
  }

  const headerRow = sheet.getRow(1);
  const columnMap = {}; // canonical field name -> column index
  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(cell.value);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized)) columnMap[field] = colNumber;
    }
  });

  if (!columnMap.employeeCode || !columnMap.date) {
    return {
      rows: [],
      errors: ["Could not find an Employee ID/Code column and a Date column in the header row."],
    };
  }

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const employeeCode = row.getCell(columnMap.employeeCode).value;
    if (employeeCode == null || employeeCode === "") return; // blank row, skip silently

    const date = cellToDate(row.getCell(columnMap.date).value);

    rows.push({
      _sourceRow: rowNumber,
      employeeCode: String(employeeCode).trim(),
      date,
      status: columnMap.status ? row.getCell(columnMap.status).value || undefined : undefined,
      shift: columnMap.shift ? row.getCell(columnMap.shift).value || undefined : undefined,
      checkIn: columnMap.checkIn ? combineWithDate(row.getCell(columnMap.checkIn).value, date) : undefined,
      checkOut: columnMap.checkOut ? combineWithDate(row.getCell(columnMap.checkOut).value, date) : undefined,
      breakStart: columnMap.breakStart ? combineWithDate(row.getCell(columnMap.breakStart).value, date) : undefined,
      breakEnd: columnMap.breakEnd ? combineWithDate(row.getCell(columnMap.breakEnd).value, date) : undefined,
    });
  });

  return { rows, errors: [] };
}

// Builds the 5-sheet monthly report workbook (spec §15) and returns a
// Buffer ready to stream back as a file download.
export async function buildAttendanceReportWorkbook({
  market,
  year,
  month,
  generatedBy,
  summaryRows,
  dailyRows,
  offDayRows,
  adjustmentRows,
  exceptionRows,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TeamMart";
  workbook.created = new Date();

  const meta = [
    ["Market", market],
    ["Report Month", `${year}-${String(month).padStart(2, "0")}`],
    ["Generated By", generatedBy],
    ["Generated At", new Date().toISOString()],
    [],
  ];

  const summarySheet = workbook.addWorksheet("Attendance Summary");
  meta.forEach((row) => summarySheet.addRow(row));
  summarySheet.addRow([
    "Employee Name", "Employee ID", "Role", "Department", "Shift",
    "Total Worked Hours", "Total Required Hours", "Attendance Rate %",
  ]);
  summaryRows.forEach((r) => summarySheet.addRow(r));

  const dailySheet = workbook.addWorksheet("Daily Attendance");
  dailySheet.addRow([
    "Employee Name", "Employee ID", "Date", "Check In", "Check Out",
    "Break Duration (min)", "Worked Hours", "Required Hours", "Status", "Shift", "Source",
  ]);
  dailyRows.forEach((r) => dailySheet.addRow(r));

  const offDaySheet = workbook.addWorksheet("Approved Off Days");
  offDaySheet.addRow(["Employee Name", "Employee ID", "Date", "Type", "Reason", "Approved By", "Approved At"]);
  offDayRows.forEach((r) => offDaySheet.addRow(r));

  const adjustmentSheet = workbook.addWorksheet("Working-Hour Adjustments");
  adjustmentSheet.addRow(["Employee Name", "Employee ID", "Date", "Previous Hours", "New Hours", "Reason", "Adjusted By", "Date/Time"]);
  adjustmentRows.forEach((r) => adjustmentSheet.addRow(r));

  const exceptionSheet = workbook.addWorksheet("Exceptions");
  exceptionSheet.addRow(["Employee Name", "Employee ID", "Date", "Issue"]);
  exceptionRows.forEach((r) => exceptionSheet.addRow(r));

  return workbook.xlsx.writeBuffer();
}
