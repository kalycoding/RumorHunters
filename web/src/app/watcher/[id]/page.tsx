import { AppShell } from "@/components/AppShell";
import { StoryView } from "@/components/StoryView";

export default function StoryPage() {
  return (
    <AppShell active="watcher">
      <StoryView />
    </AppShell>
  );
}
