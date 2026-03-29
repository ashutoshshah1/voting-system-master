import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient } from "../services/apiClient";
import {
  VOTING_MODE_CHANGE_EVENT,
  VOTING_MODE_STORAGE_KEY,
} from "../hooks/useVotingMode";
import type { PendingKyc, User } from "../types/auth";
import { getUserFacingErrorMessage } from "../utils/errorMessages";

const STORAGE_KEY = "votesphere_token";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  register: (payload: { fullName: string; email: string; nid: string; dob: string }) => Promise<void>;
  login: (payload: { nid: string; dob: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  submitKyc: (payload: { documentType: string; file: File }) => Promise<void>;
  getPendingKyc: () => Promise<PendingKyc[]>;
  approveKyc: (id: string, reviewNote?: string) => Promise<void>;
  rejectKyc: (id: string, reviewNote?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSession = useCallback((nextToken: string, nextUser: User) => {
    localStorage.setItem(STORAGE_KEY, nextToken);
    localStorage.setItem(VOTING_MODE_STORAGE_KEY, "online");
    window.dispatchEvent(new Event(VOTING_MODE_CHANGE_EVENT));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const register = useCallback(async (payload: { fullName: string; email: string; nid: string; dob: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = (await apiClient.register(payload)) as {
        token: string;
        user: User;
      };
      saveSession(response.token, response.user);
    } catch (err) {
      setError(
        getUserFacingErrorMessage(err, "authRegister", "Registration failed.")
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [saveSession]);

  const login = useCallback(async (payload: { nid: string; dob: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = (await apiClient.login(payload)) as {
        token: string;
        user: User;
      };
      saveSession(response.token, response.user);
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "authLogin", "Login failed."));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [saveSession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = (await apiClient.me(token)) as User;
      setUser(response);
    } catch (err) {
      setError(
        getUserFacingErrorMessage(
          err,
          "generic",
          "Failed to refresh profile."
        )
      );
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [token, clearSession]);

  const submitKyc = useCallback(async (payload: { documentType: string; file: File }) => {
    if (!token) throw new Error("Not authenticated");
    setIsLoading(true);
    setError(null);
    try {
      await apiClient.submitKyc(token, payload);
      await refresh();
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "kyc", "KYC submission failed."));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [token, refresh]);


  const getPendingKyc = useCallback(async () => {
    if (!token) throw new Error("Not authenticated");
    const response = (await apiClient.adminPending(token)) as PendingKyc[];
    return response;
  }, [token]);

  const approveKyc = useCallback(async (id: string, reviewNote?: string) => {
    if (!token) throw new Error("Not authenticated");
    await apiClient.approveKyc(token, id, reviewNote);
  }, [token]);

  const rejectKyc = useCallback(async (id: string, reviewNote?: string) => {
    if (!token) throw new Error("Not authenticated");
    await apiClient.rejectKyc(token, id, reviewNote);
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      error,
      register,
      login,
      logout,
      refresh,
      submitKyc,
      getPendingKyc,
      approveKyc,
      rejectKyc,
    }),
    [
      user,
      token,
      isLoading,
      error,
      register,
      login,
      logout,
      refresh,
      submitKyc,
      getPendingKyc,
      approveKyc,
      rejectKyc,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
