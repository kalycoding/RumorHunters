import { AppShell } from "@/components/AppShell";
import { Settings } from "@/components/Settings";

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <Settings />
    </AppShell>
  );
}
