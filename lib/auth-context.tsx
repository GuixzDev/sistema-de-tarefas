'use client';
/**
 * lib/auth-context.tsx
 * Contexto React de autenticação — armazena token JWT e dados do usuário.
 * Persiste o token em localStorage para sobreviver a reloads.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import type { Papel } from '@/types';

interface AuthUser {
  id: string;
  papel: Papel;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      try {
        const decoded = jwtDecode<AuthUser & { exp: number }>(stored);
        // Verificar se não está expirado
        if (decoded.exp * 1000 > Date.now()) {
          setToken(stored);
          setUser({ id: decoded.id, papel: decoded.papel });
        } else {
          localStorage.removeItem('auth_token');
        }
      } catch {
        localStorage.removeItem('auth_token');
      }
    }
    setIsLoading(false);
  }, []);

  function login(newToken: string) {
    const decoded = jwtDecode<AuthUser>(newToken);
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser({ id: decoded.id, papel: decoded.papel });
  }

  function logout() {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
