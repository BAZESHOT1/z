import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeMode, Language, getThemeColors } from './i18n';

interface ThemeContextType {
  theme: ThemeMode;
  lang: Language;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  colors: ReturnType<typeof getThemeColors>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  lang: 'ru',
  toggleTheme: () => {},
  setLanguage: () => {},
  colors: getThemeColors('dark'),
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [lang, setLang] = useState<Language>('ru');

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then((savedTheme) => {
      if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
    });
    AsyncStorage.getItem('lang').then((savedLang) => {
      if (savedLang === 'ru' || savedLang === 'en') setLang(savedLang);
    });
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    AsyncStorage.setItem('app_theme', nextTheme);
  };

  const setLanguage = (newLang: Language) => {
    setLang(newLang);
    AsyncStorage.setItem('lang', newLang);
  };

  const colors = getThemeColors(theme);

  return (
    <ThemeContext.Provider value={{ theme, lang, toggleTheme, setLanguage, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);