import type { CSSProperties } from 'react';

export const colors = {
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

export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';

export function button(variant: 'primary' | 'secondary' | 'danger' | 'plain'): CSSProperties {
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
      return { ...base, background: colors.accent, color: colors.bg };
    case 'secondary':
      return { ...base, background: colors.bgSecondary, color: colors.text };
    case 'danger':
      return { ...base, background: colors.red, color: colors.bg };
    case 'plain':
      return {
        ...base,
        background: 'none',
        color: colors.accent,
        padding: '4px 8px',
        fontSize: 13,
      };
    default:
      return base;
  }
}

export const input: CSSProperties = {
  fontFamily,
  fontSize: 15,
  padding: '12px 14px',
  borderRadius: 10,
  border: 'none',
  background: colors.bgSecondary,
  color: colors.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export const sectionHeader: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: colors.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  padding: '16px 16px 6px',
};

export function difficultyDot(difficulty: string): CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background:
      colors.difficulty[difficulty as keyof typeof colors.difficulty] || colors.textTertiary,
    flexShrink: 0,
  };
}

export const emptyState: CSSProperties = {
  textAlign: 'center',
  color: colors.textTertiary,
  padding: '48px 16px',
  fontSize: 14,
  lineHeight: 1.6,
};
