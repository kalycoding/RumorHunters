import { AppShell } from "@/components/AppShell";
import { Replies } from "@/components/Replies";

export default function RepliesPage() {
  return (
    <AppShell active="replies">
      <Replies />
    </AppShell>
  );
}
