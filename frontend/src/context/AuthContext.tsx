import React, { createContext, useContext, useEffect, useState } from 'react';

export type UserRole = 'ADMIN' | 'AGENT' | 'EDITOR' | 'VIEWER';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('estate_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('estate_user');
    const savedToken = localStorage.getItem('estate_token');

    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch (e) {
        localStorage.removeItem('estate_user');
        localStorage.removeItem('estate_token');
      }
    } else {
      // Default initial mock admin user for immediate seamless dev testing
      const defaultAdmin: User = {
        id: 1,
        email: 'admin@estate.com',
        name: 'Platform Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
      };
      setUser(defaultAdmin);
      setToken('mock_admin_jwt_token_2026');
      localStorage.setItem('estate_user', JSON.stringify(defaultAdmin));
      localStorage.setItem('estate_token', 'mock_admin_jwt_token_2026');
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('estate_token', newToken);
    localStorage.setItem('estate_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('estate_token');
    localStorage.removeItem('estate_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
