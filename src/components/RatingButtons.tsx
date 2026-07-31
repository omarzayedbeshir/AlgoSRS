import type { Rating } from '../types';
import { fontFamily } from '../styles';
import { useTheme } from './ThemeContext';

export const RATING_META: Record<Rating, { emoji: string; label: string }> = {
  1: { emoji: '😰', label: 'Very Hard' },
  2: { emoji: '😅', label: 'Hard' },
  3: { emoji: '🙂', label: 'Easy' },
  4: { emoji: '😎', label: 'Very Easy' },
};

interface Props {
  value: Rating | null;
  onChange: (r: Rating) => void;
  disabled?: boolean;
}

export default function RatingButtons({ value, onChange, disabled }: Props) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 20,
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {([1, 2, 3, 4] as Rating[]).map((r) => {
        const selected = value === r;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            disabled={disabled}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '14px 8px',
              borderRadius: 12,
              border: 'none',
              background: selected ? colors.accentLight : colors.bgSecondary,
              cursor: disabled ? 'default' : 'pointer',
              fontFamily,
              transition: 'all 0.12s',
              outline: 'none',
              opacity: value !== null && !selected ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 28, lineHeight: 1 }}>{RATING_META[r].emoji}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: selected ? colors.accent : colors.textSecondary,
              }}
            >
              {RATING_META[r].label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
