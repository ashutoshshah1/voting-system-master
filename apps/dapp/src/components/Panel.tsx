import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className={`rounded-3xl glass p-6 shadow-glass ${className || ""}`}
    >
      {children}
    </div>
  );
}
