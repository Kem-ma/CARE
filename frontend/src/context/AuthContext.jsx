import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSession, sessionInfo, signOut } from '../lib/auth';

// The signed-in citizen, if any. (Admin sessions are handled separately in the admin pages.)
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null });

  const refresh = useCallback(async () => {
    const session = await getSession('citizen');
    setState({ loading: false, user: session ? sessionInfo(session) : null });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    signOut('citizen');
    setState({ loading: false, user: null });
  }, []);

  const value = useMemo(() => ({ ...state, refresh, logout }), [state, refresh, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
