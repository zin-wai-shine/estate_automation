import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'blue' | 'orange';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  actualTheme: 'dark' | 'light';
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

const resolveTheme = (mode: ThemeMode): 'dark' | 'light' => {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
  return mode === 'light' ? 'light' : 'dark';
};

const getSavedTheme = (): ThemeMode => {
  try {
    const saved = localStorage.getItem('estate_theme') as ThemeMode;
    return saved || 'dark';
  } catch {
    return 'dark';
  }
};

const getSavedAccent = (): AccentColor => {
  try {
    const saved = localStorage.getItem('estate_accent_color') as AccentColor;
    return saved || 'blue';
  } catch {
    return 'blue';
  }
};

const getInitialActualTheme = (): 'dark' | 'light' => {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  return resolveTheme(getSavedTheme());
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getSavedTheme);
  const [accentColor, setAccentColorState] = useState<AccentColor>(getSavedAccent);
  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>(getInitialActualTheme);

  // Synchronously ensure data-theme on root before browser paints
  useLayoutEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(theme);
    root.setAttribute('data-theme', resolved);
    setActualTheme(resolved);
    try {
      localStorage.setItem('estate_theme', theme);
    } catch {}
  }, [theme]);

  // Synchronously ensure data-color on root before browser paints
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-color', accentColor);
    try {
      localStorage.setItem('estate_accent_color', accentColor);
    } catch {}
  }, [accentColor]);

  // Handle system preference changes if 'system' mode is active
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', resolved);
      setActualTheme(resolved);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  const setTheme = (newTheme: ThemeMode) => {
    const resolved = resolveTheme(newTheme);
    document.documentElement.setAttribute('data-theme', resolved);
    setActualTheme(resolved);
    setThemeState(newTheme);
    try {
      localStorage.setItem('estate_theme', newTheme);
    } catch {}
  };

  const setAccentColor = (newColor: AccentColor) => {
    document.documentElement.setAttribute('data-color', newColor);
    setAccentColorState(newColor);
    try {
      localStorage.setItem('estate_accent_color', newColor);
    } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, actualTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
