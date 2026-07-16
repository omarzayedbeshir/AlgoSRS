import React, { useState, useEffect } from 'react';
import type { LeetCodeEntry, Rating } from '../types';
import { getAll, remove } from '../storage';
import { api } from '../lib/api-client';

const RATING_EMOJI: Record<Rating, string> = {
  1: '😰', 2: '😅', 3: '🙂', 4: '😎',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#00b8a3',
  medium: '#ffc01e',
  hard: '#ff375f',
};

interface Props {
  onSaveNew: () => void;
  showNewButton?: boolean;
  isAuthenticated?: boolean;
  syncKey?: number;
}

export default function SavedList({ onSaveNew, showNewButton, isAuthenticated, syncKey }: Props) {
  const [entries, setEntries] = useState<LeetCodeEntry[]>([]);

  useEffect(() => {
    if (!isAuthenticated) { setEntries([]); return; }
    loadEntries();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadEntries();
  }, [syncKey]);

  async function loadEntries() {
    const all = await getAll();
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEntries(all);
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (isAuthenticated) {
      try {
        await api.deleteEntry(id);
      } catch {}
    }
    const all = await getAll();
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEntries(all);
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div style={{ padding: '16px', minHeight: '300px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px'
      }}>
        <h1 style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>
          Saved ({entries.length})
        </h1>
        {showNewButton && (
          <button
            onClick={onSaveNew}
            style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px',
              padding: '4px 12px', fontSize: '12px', cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + New
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div style={{
          textAlign: 'center', color: '#aaa', marginTop: '60px', fontSize: '13px'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
          No saved problems yet.<br />
          Open a LeetCode problem to rate it.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {entries.map(entry => (
            <div
              key={entry.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '6px',
                background: '#f5f6f8',
                borderLeft: `4px solid ${DIFFICULTY_COLORS[entry.difficulty] || '#888'}`,
                fontSize: '13px',
              }}
            >
              <a
                href={entry.url}
                target="_blank"
                title={entry.title}
                style={{
                  flex: 1, color: '#1a1a1a', textDecoration: 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {entry.title}
              </a>
              <span style={{ fontSize: '15px', lineHeight: 1 }} title={entry.difficulty}>
                {RATING_EMOJI[entry.rating]}
              </span>
              <span style={{ fontSize: '11px', color: '#999', whiteSpace: 'nowrap' }}>
                {formatDate(entry.date)}
              </span>
              <button
                onClick={() => handleDelete(entry.id)}
                title="Delete"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#ccc',
                  fontSize: '14px', padding: '0 2px', lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
