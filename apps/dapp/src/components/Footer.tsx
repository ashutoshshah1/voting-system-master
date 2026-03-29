import { Link } from "react-router-dom";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-32 border-t border-white/10 bg-black/20 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        <div className="grid gap-12 md:grid-cols-4 lg:gap-8">
          {/* Brand Column */}
          <div className="md:col-span-1 space-y-6">
            <div className="flex items-center gap-3">
              <img
                src="/branding/logo.png"
                alt="VoteHybrid logo"
                className="h-10 w-10 rounded-full bg-white/5 p-1 shadow-neon object-contain"
              />
              <div className="font-display text-xl font-bold text-text-main tracking-wide">
                VoteHybrid
              </div>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              The world's first hybrid voting protocol combining offline integrity with online transparency.
            </p>
            <div className="flex gap-4">
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="text-text-muted hover:text-white transition-colors"
                aria-label="VoteHybrid on X"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="text-text-muted hover:text-white transition-colors"
                aria-label="VoteHybrid on GitHub"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Product</h3>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link to="/features" className="hover:text-neon-blue transition-colors">Features</Link></li>
              <li><Link to="/security" className="hover:text-neon-blue transition-colors">Security</Link></li>
              <li><Link to="/roadmap" className="hover:text-neon-blue transition-colors">Roadmap</Link></li>
              <li><Link to="/changelog" className="hover:text-neon-blue transition-colors">Changelog</Link></li>
            </ul>
          </div>

          {/* Company Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Company</h3>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link to="/about" className="hover:text-neon-blue transition-colors">About</Link></li>
              <li><Link to="/careers" className="hover:text-neon-blue transition-colors">Careers</Link></li>
              <li><Link to="/blog" className="hover:text-neon-blue transition-colors">Blog</Link></li>
              <li><Link to="/contact" className="hover:text-neon-blue transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Resources Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Resources</h3>
            <ul className="space-y-3 text-sm text-text-muted">
              <li><Link to="/docs" className="hover:text-neon-blue transition-colors">Documentation</Link></li>
              <li><Link to="/help" className="hover:text-neon-blue transition-colors">Help Center</Link></li>
              <li><Link to="/status" className="hover:text-neon-blue transition-colors">Status</Link></li>
              <li><Link to="/legal/privacy" className="hover:text-neon-blue transition-colors">Privacy</Link></li>
              <li><Link to="/legal/terms" className="hover:text-neon-blue transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted/60">
          <p>&copy; {currentYear} VoteHybrid. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/legal/privacy" className="hover:text-text-muted transition-colors">Privacy Policy</Link>
            <Link to="/legal/terms" className="hover:text-text-muted transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
