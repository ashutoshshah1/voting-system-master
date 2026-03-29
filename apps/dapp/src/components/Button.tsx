import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  isLoading?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-coral/40 disabled:cursor-not-allowed disabled:opacity-60";

const variants = {
  primary: "bg-gradient-to-r from-neon-purple to-neon-blue text-white shadow-neon hover:shadow-neonBlue hover:translate-y-[-1px] border border-transparent",
  ghost: "bg-transparent text-text-muted hover:text-white hover:bg-white/5",
  outline: "border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10 hover:border-neon-blue",
};

export function Button({
  variant = "primary",
  isLoading,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`${base} ${variants[variant]} ${props.className || ""}`}
      disabled={props.disabled || isLoading}
    >
      {isLoading ? "Processing..." : children}
    </button>
  );
}
