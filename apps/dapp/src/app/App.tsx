import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { AuthProvider } from "../context/AuthContext";
import { ElectionProvider } from "../context/ElectionContext";
import { ScrollToTop } from "../components/ScrollToTop";
import { Landing } from "../pages/Landing";
import { infoPages } from "../pages/infoPages";

const Connect = lazy(() =>
  import("../pages/Connect").then((module) => ({ default: module.Connect }))
);
const Candidates = lazy(() =>
  import("../pages/Candidates").then((module) => ({
    default: module.Candidates,
  }))
);
const ConfirmVote = lazy(() =>
  import("../pages/ConfirmVote").then((module) => ({
    default: module.ConfirmVote,
  }))
);
const Receipt = lazy(() =>
  import("../pages/Receipt").then((module) => ({ default: module.Receipt }))
);
const Results = lazy(() =>
  import("../pages/Results").then((module) => ({ default: module.Results }))
);
const OfflineVoting = lazy(() =>
  import("../pages/OfflineVoting").then((module) => ({
    default: module.OfflineVoting,
  }))
);
const Login = lazy(() =>
  import("../pages/Login").then((module) => ({ default: module.Login }))
);
const Register = lazy(() =>
  import("../pages/Register").then((module) => ({ default: module.Register }))
);
const Kyc = lazy(() =>
  import("../pages/Kyc").then((module) => ({ default: module.Kyc }))
);
const AdminPanel = lazy(() =>
  import("../pages/AdminPanel").then((module) => ({
    default: module.AdminPanel,
  }))
);
const AdminKyc = lazy(() =>
  import("../pages/AdminKyc").then((module) => ({ default: module.AdminKyc }))
);
const Docs = lazy(() =>
  import("../pages/Docs").then((module) => ({ default: module.Docs }))
);
const InfoPage = lazy(() =>
  import("../pages/InfoPage").then((module) => ({ default: module.InfoPage }))
);
const NotFound = lazy(() =>
  import("../pages/NotFound").then((module) => ({ default: module.NotFound }))
);

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-16 text-sm text-text-muted">
      Loading page...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <ElectionProvider>
          <AppShell>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/connect" element={<Connect />} />
                <Route path="/candidates" element={<Candidates />} />
                <Route path="/confirm" element={<ConfirmVote />} />
                <Route path="/receipt" element={<Receipt />} />
                <Route path="/results" element={<Results />} />
                <Route path="/offline" element={<OfflineVoting />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/kyc" element={<Kyc />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/admin/kyc" element={<AdminKyc />} />
                <Route path="/docs" element={<Docs />} />
                {infoPages.map((page) => (
                  <Route
                    key={page.path}
                    path={page.path}
                    element={<InfoPage content={page} />}
                  />
                ))}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppShell>
        </ElectionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
