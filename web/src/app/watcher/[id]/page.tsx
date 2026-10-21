import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { StoryView } from "@/components/StoryView";

export default function StoryPage() {
  return (
    <AppShell active="watcher">
      <Suspense>
        <StoryView />
      </Suspense>
    </AppShell>
  );
}
