import { prisma } from "../lib/prisma.js";

// excelExportAdapter.js — the OUTBOUND integration boundary: TeamMart
// pushing break/attendance data OUT to the company's existing Excel
// system, the mirror image of the INBOUND boundary that already exists
// (AttendanceImportBatch + AttendanceSource.IMPORT +
// attendanceController.importAttendanceRecords/utils/attendanceExcel.js
// — the company's Excel export coming INTO TeamMart). That inbound path
// is untouched by this file and needs no changes; this is the new,
// separate direction the Phase 1 spec asks for.
//
// WHAT THIS IS NOT: a connection to any real external system. We do not
// have the company's actual Excel environment/API details (not Microsoft
// Graph, not SharePoint, not OneDrive, not a shared network path — none
// of that is assumed or hard-coded here). Nothing in this file writes a
// file to disk as a "production" export, calls out to any URL, or
// pretends a real destination is connected.
//
// WHAT THIS IS: the one function — buildBreakAttendanceExportRows() —
// that shapes TeamMart's own data into the flat row structure the
// eventual export will need, decoupled from wherever those rows actually
// end up. When the real Excel system's details are confirmed, only the
// DESTINATION needs to be added (a new small function that takes these
// same rows and sends them somewhere real — email, SFTP, an API call,
// writing to a shared drive, whichever the company's system turns out to
// need) — the shaping logic here does not need to change.
//
// Required information/credentials this will need once a real
// destination is chosen (not yet available — documented here so it's
// not lost, not guessed at):
//   - the exact target (API endpoint + auth, SFTP host + credentials,
//     a shared network/cloud path, or a scheduled email recipient)
//   - the expected file format/column order/header names on their side
//   - how often an export should run and whether it's push (TeamMart
//     initiates) or pull (their system fetches from TeamMart)
export async function buildBreakAttendanceExportRows({ marketId, from, to }) {
  const breaks = await prisma.break.findMany({
    where: {
      marketId,
      date: { gte: from, lte: to },
    },
    include: {
      employee: { select: { name: true, employeeCode: true, role: true } },
      staffUser: { select: { name: true, role: true } },
      market: { select: { name: true } },
    },
    orderBy: { date: "asc" },
  });

  return breaks.map((b) => ({
    employeeId: b.employeeId ?? (b.staffUserId ? `user:${b.staffUserId}` : null),
    employeeName: b.employee?.name ?? b.staffUser?.name ?? null,
    role: b.employee?.role ?? b.staffUser?.role ?? null,
    market: b.market.name,
    date: b.date.toISOString().slice(0, 10),
    breakStart: b.startTime ? b.startTime.toISOString() : null,
    breakEnd: b.actualEndTime ? b.actualEndTime.toISOString() : null,
    durationMinutes:
      b.startTime && b.actualEndTime ? Math.round((b.actualEndTime.getTime() - b.startTime.getTime()) / 60000) : null,
    status: b.status,
  }));
}
