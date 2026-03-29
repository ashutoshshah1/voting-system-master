import type { ReactNode } from "react";
import { Footer } from "../components/Footer";
import { NavBar } from "../components/NavBar";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-void text-text-main font-body selection:bg-neon-purple/30 selection:text-white">
      <div className="relative overflow-hidden min-h-screen">
        {/* Background Gradients */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-purple/20 rounded-full blur-[120px] animate-blob" />
          <div className="absolute top-[20%] right-[-10%] w-[35%] h-[40%] bg-neon-blue/20 rounded-full blur-[120px] animate-blob animation-delay-2000" />
          <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[35%] bg-neon-pink/15 rounded-full blur-[120px] animate-blob animation-delay-4000" />
        </div>

        <NavBar />

        <main className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-10 sm:px-10">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}
