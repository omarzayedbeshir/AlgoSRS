import React, { useState, useEffect } from 'react';
import type { ProblemData, Rating, LeetCodeEntry } from '../types';
import { getAll, save } from '../storage';
import { autoSync } from '../lib/sync';
import { reviewEntry } from '../lib/fsrs';

const RATING_META: Record<Rating, { emoji: string; label: string }> = {
  1: { emoji: '😰', label: 'Very Hard' },
  2: { emoji: '😅', label: 'Hard' },
  3: { emoji: '🙂', label: 'Easy' },
  4: { emoji: '😎', label: 'Very Easy' },
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#00b8a3',
  medium: '#ffc01e',
  hard: '#ff375f',
};

interface Props {
  problem: ProblemData;
  onSaved: () => void;
  onBrowse: () => void;
}

export default function SavePanel({ problem, onSaved, onBrowse }: Props) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [savedEntry, setSavedEntry] = useState<LeetCodeEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setRating(null);
    setSavedEntry(null);
    setSaving(false);
    setSaved(false);
    getAll().then(entries => {
      const existing = entries.find(e => e.url === problem.url);
      if (existing) {
        setSavedEntry(existing);
        setRating(existing.rating);
      }
    });
  }, [problem.url]);

  async function handleSave() {
    if (!rating) return;
    setSaving(true);
    const id = savedEntry?.id || crypto.randomUUID();
    const now = new Date();
    const base: LeetCodeEntry = {
      id, title: problem.title, url: problem.url,
      difficulty: problem.difficulty, rating,
      date: now.toISOString(),
    };
    const entry = savedEntry
      ? { ...savedEntry, ...base, date: now.toISOString() }
      : reviewEntry(base, rating).updatedEntry;
    await save(entry);
    autoSync();
    setSaved(true);
    setSaving(false);
    setTimeout(onSaved, 800);
  }

  const diffColor = DIFFICULTY_COLORS[problem.difficulty] || '#888';

  return (
    <div style={{ padding: '16px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'
      }}>
        <h1 style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>Rate Problem</h1>
        <button
          onClick={onBrowse}
          style={{
            background: 'none', border: 'none', color: '#666', cursor: 'pointer',
            fontSize: '12px', textDecoration: 'underline', padding: '2px 4px'
          }}
        >
          Practice
        </button>
      </div>

      <div style={{
        padding: '10px 12px', borderRadius: '8px', background: '#f5f6f8',
        borderLeft: `4px solid ${diffColor}`, marginBottom: '20px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', wordBreak: 'break-word' }}>
          {problem.title}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', textAlign: 'center' }}>
          How was it for you?
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {([1, 2, 3, 4] as Rating[]).map(r => (
            <button
              key={r}
              onClick={() => setRating(r)}
              style={{
                width: '58px', height: '58px', borderRadius: '12px',
                border: rating === r ? '2px solid #2563eb' : '2px solid #e8e8e8',
                background: rating === r ? '#eff6ff' : '#fff',
                cursor: 'pointer', fontSize: '22px', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '1px', transition: 'all 0.12s', outline: 'none',
              }}
            >
              <span>{RATING_META[r].emoji}</span>
              <span style={{ fontSize: '8px', color: rating === r ? '#2563eb' : '#aaa', fontWeight: 500 }}>
                {r}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!rating || saving}
        style={{
          width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
          background: rating ? '#2563eb' : '#d0d0d0', color: '#fff',
          fontSize: '14px', fontWeight: 500, cursor: rating ? 'pointer' : 'default',
          transition: 'background 0.15s', opacity: saving ? 0.7 : 1,
        }}
      >
        {saved ? '✓ Saved!' : savedEntry ? 'Set Rating' : 'Save Rating'}
      </button>
    </div>
  );
}
