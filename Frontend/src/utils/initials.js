// initials.js — "Shalaw Naji" -> "SN". Used anywhere a person's avatar
// needs a fallback (no photo yet). Was previously copy-pasted identically
// into App.jsx, EmployeeWorkspace.jsx, and LoginPage.jsx — pulled out here
// during the Employee-module polish pass so there's exactly one definition.
export function initialsOf(name) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
