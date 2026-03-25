import { useState, useEffect, useCallback } from "react";
import { initData as tmaInitData } from "@tma.js/sdk-react";
import {
  loginWithTelegram,
  getMe,
  clearToken,
  getToken,
  AuthUser,
} from "@/api/client";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: getToken(),
    loading: true,
    error: null,
  });

  const initialize = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // ── Case 1: already have a stored token ──────────────────────────────
      if (getToken()) {
        try {
          const user = await getMe();
          setState({ user, token: getToken(), loading: false, error: null });
          return;
        } catch {
          // Token expired or invalid — fall through to re-login
          clearToken();
        }
      }

      // ── Case 2: use TMA SDK's initData (works in real Telegram AND mock) ─
      // tmaInitData.raw() returns the raw query string that was passed by Telegram
      const raw = tmaInitData.raw();
      if (raw) {
        const { user, token } = await loginWithTelegram(raw);
        setState({ user, token, loading: false, error: null });
        return;
      }

      setState({
        user: null,
        token: null,
        loading: false,
        error: "No Telegram initData available",
      });
    } catch (err: any) {
      setState({
        user: null,
        token: null,
        loading: false,
        error: err.message || "Login failed",
      });
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const logout = () => {
    clearToken();
    setState({ user: null, token: null, loading: false, error: null });
  };

  return { ...state, logout, retry: initialize };
}
