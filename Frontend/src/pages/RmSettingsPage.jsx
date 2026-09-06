import SettingsScreen from "../components/employee/SettingsScreen";

// RmSettingsPage.jsx — the Regional Manager's Settings tab.
//
// Now the same SettingsScreen every other role uses, rather than its own
// one-row page. That removes the last remaining "Security" entry in the
// app (password management lives in Account now) and gives a Regional
// Manager the same Notifications and Language preferences as everyone
// else — all through the same self-service endpoints, which were never
// role-specific.
export default function RmSettingsPage({ onLogout }) {
  return <SettingsScreen onLogout={onLogout} />;
}
