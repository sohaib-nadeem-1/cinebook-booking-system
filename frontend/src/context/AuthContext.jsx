import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { authService, readSession } from '../services/authService.js';

const AuthCtx = createContext(null);

/** Admin permission matrix (RBAC simulation). */
const PERMISSIONS = {
  system_admin: ['dashboard', 'movies', 'movies:delete', 'showtimes', 'bookings', 'bookings:refund', 'users', 'users:manage', 'settings'],
  box_office: ['dashboard', 'movies', 'showtimes', 'bookings', 'bookings:refund'],
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readSession('customer'));
  const [admin, setAdmin] = useState(() => readSession('admin'));

  const login = useCallback(async (creds) => { const u = await authService.login({ ...creds, portal: 'customer' }); setUser(u); return u; }, []);
  const adminLogin = useCallback(async (creds) => { const u = await authService.login({ ...creds, portal: 'admin' }); setAdmin(u); return u; }, []);
  const register = useCallback(async (data) => authService.register(data), []);
  const guest = useCallback(() => { const g = authService.continueAsGuest(); setUser(g); return g; }, []);
  const logout = useCallback(() => { authService.logout('customer'); setUser(null); }, []);
  const adminLogout = useCallback(() => { authService.logout('admin'); setAdmin(null); }, []);
  const refresh = useCallback(() => { setUser(readSession('customer')); setAdmin(readSession('admin')); }, []);
  const updateProfile = useCallback(async (patch) => { const u = await authService.updateProfile(user.id, patch); setUser(u); return u; }, [user]);
  const can = useCallback((perm) => !!admin && (PERMISSIONS[admin.role] || []).includes(perm), [admin]);

  const value = useMemo(() => ({
    user, admin, isCustomer: !!user && !user.guest, isGuest: !!user?.guest, isAdmin: !!admin,
    login, adminLogin, register, guest, logout, adminLogout, refresh, updateProfile, can,
  }), [user, admin, login, adminLogin, register, guest, logout, adminLogout, refresh, updateProfile, can]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
