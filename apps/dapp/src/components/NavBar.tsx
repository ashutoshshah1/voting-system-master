import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useVotingMode } from "../hooks/useVotingMode";
import { formatAddress } from "../utils/format";
import { Button } from "./Button";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Wallet", to: "/connect" },
  { label: "Candidates", to: "/candidates" },
  { label: "Offline", to: "/offline" },
  { label: "Results", to: "/results" },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const { votingMode } = useVotingMode();
  const location = useLocation();
  const isAdmin = user?.role === "ADMIN";
  const walletAddress = user?.walletAddress;
  const [isOpen, setIsOpen] = useState(false);
  const isOfflineRoute = location.pathname.startsWith("/offline");
  const visibleNavItems = navItems.filter(
    (item) => item.to !== "/offline" || (votingMode === "offline" && isOfflineRoute)
  );

  return (
    <header className="sticky top-6 z-50 mx-auto max-w-6xl px-6 sm:px-10">
      <div className="glass rounded-2xl px-6 py-4 shadow-glass transition-all hover:border-white/20">
        <div className="flex items-center justify-between gap-6">
          <NavLink to="/" className="flex items-center gap-3 transition hover:opacity-80">
            <img
              src="/branding/logo.png"
              alt="VoteHybrid logo"
              className="h-10 w-10 rounded-full bg-white/5 p-1 shadow-neon object-contain"
            />
            <div>
              <div className="font-display text-base font-bold text-text-main tracking-wide">
                VoteHybrid
              </div>
            </div>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 text-sm font-medium text-text-muted md:flex">
            {user && visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `transition duration-300 hover:text-neon-blue ${isActive ? "text-neon-blue font-semibold drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <NavLink
                to="/kyc"
                className={({ isActive }) =>
                  `transition duration-300 hover:text-neon-blue ${isActive ? "text-neon-blue font-semibold drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" : ""}`
                }
              >
                KYC
              </NavLink>
            ) : null}
            {isAdmin ? (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `transition duration-300 hover:text-neon-blue ${isActive ? "text-neon-blue font-semibold drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" : ""}`
                }
              >
                Admin
              </NavLink>
            ) : null}
          </nav>

          {/* Desktop Right */}
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <button
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-muted transition hover:border-neon-blue/50 hover:text-white"
                onClick={logout}
              >
                Log out
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <NavLink to="/login" className="text-xs font-semibold text-text-muted hover:text-white transition">
                  Login
                </NavLink>
                <NavLink to="/register">
                  <Button variant="primary" className="!py-2 !px-4 !text-xs">Register</Button>
                </NavLink>
              </div>
            )}
            {walletAddress ? (
              <div className="rounded-full bg-surfaceHighlight/50 border border-border px-4 py-2 text-xs font-mono font-semibold text-neon-green shadow-[0_0_10px_rgba(74,222,128,0.2)]">
                {formatAddress(walletAddress)}
              </div>
            ) : null}
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-text-muted md:hidden"
          >
            <span className="sr-only">Toggle menu</span>
            {isOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 md:hidden animate-fadeUp">
            {user && visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `text-sm font-semibold transition ${isActive ? "text-neon-blue" : "text-text-muted hover:text-white"}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user ? (
              <NavLink
                to="/kyc"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `text-sm font-semibold transition ${isActive ? "text-neon-blue" : "text-text-muted hover:text-white"}`
                }
              >
                KYC
              </NavLink>
            ) : null}
            {isAdmin ? (
              <NavLink
                to="/admin"
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `text-sm font-semibold transition ${isActive ? "text-neon-blue" : "text-text-muted hover:text-white"}`
                }
              >
                Admin
              </NavLink>
            ) : null}
            <div className="flex flex-col gap-3 pt-2">
              {user ? (
                <button
                  className="w-full rounded-full border border-border px-4 py-2 text-xs font-semibold text-text-muted transition hover:border-neon-blue/50 hover:text-white"
                  onClick={logout}
                >
                  Log out
                </button>
              ) : (
                <>
                  <NavLink to="/login" onClick={() => setIsOpen(false)} className="w-full text-center text-xs font-semibold text-text-muted hover:text-white">
                    Login
                  </NavLink>
                  <NavLink to="/register" onClick={() => setIsOpen(false)}>
                    <Button variant="primary" className="w-full !py-2 !px-4 !text-xs">Register</Button>
                  </NavLink>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
