import type { CSSProperties } from 'react';

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentLight: string;
  red: string;
  green: string;
  orange: string;
  separator: string;
  difficulty: { easy: string; medium: string; hard: string };
}

export const lightColors: ThemeColors = {
  bg: '#ffffff',
  bgSecondary: '#f5f5f7',
  bgTertiary: '#e8e8ed',
  text: '#1d1d1f',
  textSecondary: '#86868b',
  textTertiary: '#aeaeb2',
  accent: '#0071e3',
  accentLight: '#e8f0fe',
  red: '#ff3b30',
  green: '#34c759',
  orange: '#ff9500',
  separator: 'rgba(60,60,67,0.12)',
  difficulty: { easy: '#34c759', medium: '#ff9500', hard: '#ff3b30' },
};

export const darkColors: ThemeColors = {
  bg: '#1c1c1e',
  bgSecondary: '#2c2c2e',
  bgTertiary: '#3a3a3c',
  text: '#f5f5f7',
  textSecondary: '#98989d',
  textTertiary: '#636366',
  accent: '#64b5f6',
  accentLight: '#1c2a3a',
  red: '#ff453a',
  green: '#32d74b',
  orange: '#ff9f0a',
  separator: 'rgba(255,255,255,0.12)',
  difficulty: { easy: '#32d74b', medium: '#ff9f0a', hard: '#ff453a' },
};

export const colors = lightColors;

export function getColors(isDark: boolean): ThemeColors {
  return isDark ? darkColors : lightColors;
}

export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';

export function button(variant: 'primary' | 'secondary' | 'danger' | 'plain', c?: ThemeColors): CSSProperties {
  const col = c ?? colors;
  const base: CSSProperties = {
    fontFamily,
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 20,
    padding: '8px 20px',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  };
  switch (variant) {
    case 'primary':
      return { ...base, background: col.accent, color: col.bg };
    case 'secondary':
      return { ...base, background: col.bgSecondary, color: col.text };
    case 'danger':
      return { ...base, background: col.red, color: col.bg };
    case 'plain':
      return {
        ...base,
        background: 'none',
        color: col.accent,
        padding: '4px 8px',
        fontSize: 13,
      };
    default:
      return base;
  }
}

export function input(c?: ThemeColors): CSSProperties {
  const col = c ?? colors;
  return {
    fontFamily,
    fontSize: 15,
    padding: '12px 14px',
    borderRadius: 10,
    border: 'none',
    background: col.bgSecondary,
    color: col.text,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
}

export function sectionHeader(c?: ThemeColors): CSSProperties {
  const col = c ?? colors;
  return {
    fontSize: 13,
    fontWeight: 600,
    color: col.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: '16px 16px 6px',
  };
}

export function difficultyDot(difficulty: string, c?: ThemeColors): CSSProperties {
  const col = c ?? colors;
  return {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background:
      col.difficulty[difficulty as keyof typeof col.difficulty] || col.textTertiary,
    flexShrink: 0,
  };
}

export function emptyState(c?: ThemeColors): CSSProperties {
  const col = c ?? colors;
  return {
    textAlign: 'center',
    color: col.textTertiary,
    padding: '48px 16px',
    fontSize: 14,
    lineHeight: 1.6,
  };
}
