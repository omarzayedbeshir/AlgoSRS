import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getColors, type ThemeColors } from '../styles';

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: getColors(false),
});

function detectDarkMode(): boolean {
  return (
    document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(detectDarkMode);

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(detectDarkMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setIsDark(detectDarkMode());
    mq.addEventListener('change', handler);

    return () => {
      observer.disconnect();
      mq.removeEventListener('change', handler);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, colors: getColors(isDark) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
