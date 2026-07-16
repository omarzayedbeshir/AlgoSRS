import React, { useState } from 'react';
import type { LeetCodeEntry, Rating } from '../types';
import { save } from '../storage';
import { reviewEntry, getRetrievability } from '../lib/fsrs';
import { autoSync } from '../lib/sync';

const GRADE_EMOJI: Record<Rating, { emoji: string; label: string }> = {
  1: { emoji: '😰', label: 'Again' },
  2: { emoji: '😅', label: 'Hard' },
  3: { emoji: '🙂', label: 'Good' },
  4: { emoji: '😎', label: 'Easy' },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#00b8a3',
  medium: '#ffc01e',
  hard: '#ff375f',
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
    autoSync();
    onComplete();
  }

  const diffColor = DIFFICULTY_COLORS[entry.difficulty] || '#888';

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
          Review
        </div>
        <div style={{
          padding: '10px 12px', borderRadius: '8px', background: '#f5f6f8',
          borderLeft: `4px solid ${diffColor}`, marginBottom: '8px',
        }}>
          <div style={{ fontSize: '14px', color: '#1a1a1a', wordBreak: 'break-word' }}>
            {entry.title}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center', fontSize: '12px', color: '#888' }}>
            <span>{RATING_EMOJI[entry.rating]}</span>
            <span style={{
              padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
              color: '#fff', background: diffColor,
            }}>
              {entry.difficulty}
            </span>
            {retrievability !== null && (
              <span>{Math.round(retrievability)}% recall</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', textAlign: 'center' }}>
        How was your recall?
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '16px' }}>
        {([1, 2, 3, 4] as Rating[]).map(g => (
          <button
            key={g}
            onClick={() => !busy && handleSubmit(g)}
            disabled={busy}
            style={{
              width: '58px', height: '58px', borderRadius: '12px',
              border: selected === g ? '2px solid #2563eb' : '2px solid #e8e8e8',
              background: selected === g ? '#eff6ff' : '#fff',
              cursor: busy ? 'default' : 'pointer', fontSize: '22px', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '1px', transition: 'all 0.12s', outline: 'none', opacity: busy ? 0.6 : 1,
            }}
          >
            <span>{GRADE_EMOJI[g].emoji}</span>
            <span style={{ fontSize: '8px', color: selected === g ? '#2563eb' : '#aaa', fontWeight: 500 }}>
              {GRADE_EMOJI[g].label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}