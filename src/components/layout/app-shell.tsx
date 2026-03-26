import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {/* Scrollable main content */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-24 pt-safe">
        {children}
      </main>

      {/* Fixed bottom navigation */}
      <BottomNav />
    </div>
  );
}
