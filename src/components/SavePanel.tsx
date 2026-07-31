import { useState, useEffect, useRef } from 'react';
import type { ProblemData, Rating, LeetCodeEntry } from '../types';
import { getAll, save } from '../storage';
import { api } from '../lib/api-client';
import { reviewEntry } from '../lib/fsrs';
import { fontFamily, button } from '../styles';
import { useTheme } from './ThemeContext';
import RatingButtons from './RatingButtons';

interface Props {
  problem: ProblemData;
  onSaved: () => void;
  onBrowse: () => void;
}

export default function SavePanel({ problem, onSaved, onBrowse }: Props) {
  const { colors } = useTheme();
  const [rating, setRating] = useState<Rating | null>(null);
  const [savedEntry, setSavedEntry] = useState<LeetCodeEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<number>();

  useEffect(() => {
    const currentUrl = problem.url;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRating(null);
    setSavedEntry(null);
    setSaving(false);
    setSaved(false);
    getAll().then((entries) => {
      const existing = entries.find((e) => e.url === currentUrl);
      if (existing) {
        setSavedEntry(existing);
        setRating(existing.rating);
      }
    });
  }, [problem.url]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function handleSave() {
    if (!rating) return;
    setSaving(true);
    const id = savedEntry?.id || crypto.randomUUID();
    const now = new Date();
    const base: LeetCodeEntry = {
      id,
      title: problem.title,
      url: problem.url,
      difficulty: problem.difficulty,
      tags: problem.tags,
      rating,
      date: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const entry = {
      ...reviewEntry(savedEntry ?? base, rating).updatedEntry,
      rating,
      date: now.toISOString(),
    };
    await save(entry);
    try {
      await api.upsertEntry(entry);
    } catch (err) {
      console.error('upsertEntry:', err);
    }
    setSaved(true);
    setSaving(false);
    timerRef.current = window.setTimeout(onSaved, 800);
  }

  const diffColor = colors.difficulty[problem.difficulty] || colors.textTertiary;

  return (
    <div style={{ padding: 16, fontFamily }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>Rate</span>
        <button onClick={onBrowse} style={button('plain', colors)}>
          Practice
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: diffColor,
            flexShrink: 0,
          }}
        />
        <div style={{ fontSize: 15, fontWeight: 500, color: colors.text, lineHeight: 1.3 }}>
          {problem.title}
        </div>
      </div>

      <div
        style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 14, textAlign: 'center' }}
      >
        How was it for you?
      </div>

      <RatingButtons value={rating} onChange={setRating} />

      <button
        onClick={handleSave}
        disabled={!rating || saving}
        style={{
          fontFamily,
          width: '100%',
          padding: '13px 0',
          borderRadius: 12,
          border: 'none',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.15s',
          background: rating ? colors.accent : colors.bgTertiary,
          color: colors.bg,
          opacity: saving ? 0.6 : 1,
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        }}
      >
        {saved ? '✓ Saved' : 'Save Rating'}
      </button>
    </div>
  );
}
