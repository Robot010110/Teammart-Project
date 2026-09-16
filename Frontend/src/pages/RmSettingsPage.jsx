import { ClipboardList } from "lucide-react";
import SettingsScreen from "../components/employee/SettingsScreen";

// RmSettingsPage.jsx — the Regional Manager's Settings tab.
//
// Now the same SettingsScreen every other role uses, rather than its own
// one-row page. That removes the last remaining "Security" entry in the
// app (password management lives in Account now) and gives a Regional
// Manager the same Notifications and Language preferences as everyone
// else — all through the same self-service endpoints, which were never
// role-specific.
//
// Zone Activities is the one RM-only entry, passed via SettingsScreen's
// `extraEntries` prop rather than added to that shared component's own
// ENTRIES list — every other role's Settings screen is unaffected.
const RM_EXTRA_ENTRIES = [
  { key: "zoneActivities", icon: ClipboardList, title: "rm.zoneActivities", sub: "rm.zoneActivitiesSub", to: "/rm/zone-activities" },
];

export default function RmSettingsPage({ onLogout }) {
  return <SettingsScreen onLogout={onLogout} extraEntries={RM_EXTRA_ENTRIES} />;
}
