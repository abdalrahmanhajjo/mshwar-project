"use client";

import * as React from "react";
import { fetchCurrentUser, signOutAccount, type AuthUser } from "@/lib/auth";
import type { AuthState } from "@/components/shell/auth-status";
import { mergeFavorites } from "@/lib/hub";
import { peekSavedExperiences } from "@/lib/saved-experiences";

type AuthContextValue = {
  auth: AuthState;
  user: AuthUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [ready, setReady] = React.useState(false);

  const applyUser = React.useCallback((next: AuthUser | null) => {
    setUser(next);
    setReady(true);
  }, []);

  const refresh = React.useCallback(async () => {
    applyUser(await fetchCurrentUser());
  }, [applyUser]);

  React.useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser().then((next) => {
      if (!cancelled) {
        applyUser(next);
        if (next) {
          const slugs = peekSavedExperiences();
          if (slugs.length) {
            void mergeFavorites(slugs);
          }
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  const signOut = React.useCallback(async () => {
    await signOutAccount();
    setUser(null);
  }, []);

  const value = React.useMemo(() => {
    const auth: AuthState = user ? { status: "signed-in", name: user.display_name } : { status: "guest" };
    return { auth, user, ready, refresh, signOut };
  }, [user, ready, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    return {
      auth: { status: "guest" },
      user: null,
      ready: true,
      refresh: async () => undefined,
      signOut: async () => undefined,
    };
  }
  return ctx;
}
