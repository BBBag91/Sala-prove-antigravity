import React, { createContext, useContext, useEffect } from 'react';
import { usePreferences } from './PreferencesContext';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  isLight: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Il tema è una preferenza personale dell'account autenticato (vedi PreferencesContext):
 * cambiarlo su un account non modifica il tema degli altri account.
 * Dark mode per impostazione predefinita.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preferences, updatePreferences } = usePreferences();
  const theme: ThemeMode = preferences.theme === 'light' ? 'light' : 'dark';

  const setTheme = (newTheme: ThemeMode) => {
    updatePreferences({ theme: newTheme });
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    }
  }, [theme]);

  const value = React.useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      isLight: theme === 'light',
      toggleTheme,
      setTheme,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, updatePreferences]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve essere utilizzato all\'interno di un ThemeProvider');
  }
  return context;
};
