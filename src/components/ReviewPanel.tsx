import React, { useState } from 'react';
import type { LeetCodeEntry, Rating } from '../types';
import { save } from '../storage';
import { reviewEntry, getRetrievability } from '../lib/fsrs';
import { api } from '../lib/api-client';
import { colors, fontFamily } from '../styles';

const GRADE_META: Record<Rating, { emoji: string; label: string }> = {
  1: { emoji: '😰', label: 'Again' },
  2: { emoji: '😅', label: 'Hard' },
  3: { emoji: '🙂', label: 'Good' },
  4: { emoji: '😎', label: 'Easy' },
};

const RATING_EMOJI: Record<Rating, string> = {
  1: '😰', 2: '😅', 3: '🙂', 4: '😎',
};

interface Props {
  entry: LeetCodeEntry;
  onComplete: () => void;
}

export default function ReviewPanel({ entry, onComplete }: Props) {
  const [selected, setSelected] = useState<Rating | null>(null);
  const [busy, setBusy] = useState(false);

  const retrievability = getRetrievability(entry);

  async function handleSubmit(grade: Rating) {
    setSelected(grade);
    setBusy(true);
    const { updatedEntry } = reviewEntry(entry, grade);
    await save(updatedEntry);
    try { await api.upsertEntry(updatedEntry); } catch (err) { console.error('review sync failed:', err); }
    onComplete();
  }

  const diffColor = colors.difficulty[entry.difficulty] || colors.textTertiary;

  return (
    <div style={{ padding: 16, fontFamily }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 10 }}>Review</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: diffColor, flexShrink: 0 }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: colors.text, lineHeight: 1.3 }}>{entry.title}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: colors.textSecondary, marginLeft: 20 }}>
          <span>{RATING_EMOJI[entry.rating]}</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: diffColor }}>{entry.difficulty}</span>
          {retrievability !== null && (
            <span>{Math.round(retrievability)}% recall</span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14, textAlign: 'center' }}>
        How was your recall?
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {([1, 2, 3, 4] as Rating[]).map(g => {
          const sel = selected === g;
          return (
            <button
              key={g}
              onClick={() => !busy && handleSubmit(g)}
              disabled={busy}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '14px 8px', borderRadius: 12, border: 'none',
                background: sel ? colors.accentLight : colors.bgSecondary,
                cursor: busy ? 'default' : 'pointer', fontFamily, transition: 'all 0.12s',
                outline: 'none', opacity: busy ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }}>{GRADE_META[g].emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: sel ? colors.accent : colors.textSecondary }}>
                {GRADE_META[g].label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
