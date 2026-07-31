import { useState, useEffect } from 'react';
import type { LeetCodeEntry, Rating } from '../types';
import { remove } from '../storage';
import { getReviewQueue } from '../lib/queue';
import { api } from '../lib/api-client';
import { fontFamily, difficultyDot, sectionHeader, emptyState, button } from '../styles';
import { useTheme } from './ThemeContext';

const RATING_EMOJI: Record<Rating, string> = {
  1: '😰',
  2: '😅',
  3: '🙂',
  4: '😎',
};

interface Props {
  onSaveNew: () => void;
  showNewButton?: boolean;
  isAuthenticated?: boolean;
  syncKey?: number;
  onStartReview?: () => void;
}

export default function PracticeList({
  onSaveNew,
  showNewButton,
  isAuthenticated,
  syncKey,
  onStartReview,
}: Props) {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<LeetCodeEntry[]>([]);
  const [delayedIds, setDelayedIds] = useState<string[]>([]);

  async function loadEntries() {
    const queue = await getReviewQueue();
    setEntries(queue.all);
    setDelayedIds(queue.delayed.map((e) => e.id));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEntries();
  }, [isAuthenticated, syncKey]);

  async function handleDelete(id: string) {
    await remove(id);
    if (isAuthenticated) {
      api.deleteEntry(id).catch(() => {});
    }
    const queue = await getReviewQueue();
    setEntries(queue.all);
    setDelayedIds(queue.delayed.map((e) => e.id));
  }

  function formatDueDate(dateStr: string | undefined, today: string): string {
    if (!dateStr) return 'Now';
    const dateKey = dateStr.slice(0, 10);
    if (dateKey < today) {
      const daysOverdue = Math.floor(
        (new Date(today).getTime() - new Date(dateKey).getTime()) / 86400000,
      );
      if (daysOverdue <= 1) return 'Today';
      return `${daysOverdue}d ago`;
    }
    if (dateKey === today) return 'Today';
    const daysAhead = Math.floor(
      (new Date(dateKey).getTime() - new Date(today).getTime()) / 86400000,
    );
    if (daysAhead === 1) return 'Tomorrow';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const dueEntries = entries.filter((e) => !e.dueDate || e.dueDate.slice(0, 10) <= today);
  const upcomingEntries = entries.filter((e) => e.dueDate && e.dueDate.slice(0, 10) > today);

  dueEntries.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    if (da !== db) return da - db;
    const sa = a.stability ?? 0;
    const sb = b.stability ?? 0;
    return sa - sb;
  });

  upcomingEntries.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return da - db;
  });

  const delayedSet = new Set(delayedIds);
  const dueNowEntries = dueEntries.filter((e) => !delayedSet.has(e.id));
  const delayedEntries = dueEntries.filter((e) => delayedSet.has(e.id));

  return (
    <div style={{ fontFamily, paddingBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px 8px',
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>Practice</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>
            {dueEntries.length + upcomingEntries.length}
          </span>
          {showNewButton && (
            <button
              onClick={onSaveNew}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: 'none',
                background: colors.accent,
                color: colors.bg,
                fontSize: 18,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily,
                fontWeight: 400,
              }}
            >
              +
            </button>
          )}
        </div>
      </div>

      {dueNowEntries.length > 0 && onStartReview && (
        <div style={{ padding: '0 16px 8px' }}>
          <button
            onClick={onStartReview}
            style={{ ...button('primary', colors), width: '100%', fontSize: 15, padding: '11px 0' }}
          >
            Start Review ({dueNowEntries.length})
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div style={emptyState(colors)}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
          No saved problems yet.
          <br />
          Open a LeetCode problem to rate it.
        </div>
      ) : (
        <>
          {dueNowEntries.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={sectionHeader(colors)}>Due Now</div>
              <div style={{ background: colors.bg }}>
                {dueNowEntries.map((entry, i) =>
                  renderEntry(entry, i === 0, i === dueNowEntries.length - 1),
                )}
              </div>
            </div>
          )}

          {delayedEntries.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={sectionHeader(colors)}>Delayed</div>
              <div style={{ background: colors.bg }}>
                {delayedEntries.map((entry, i) =>
                  renderEntry(entry, i === 0, i === delayedEntries.length - 1),
                )}
              </div>
            </div>
          )}

          {upcomingEntries.length > 0 && (
            <div>
              <div style={sectionHeader(colors)}>Upcoming</div>
              <div style={{ background: colors.bg }}>
                {upcomingEntries.map((entry, i) =>
                  renderEntry(entry, i === 0, i === upcomingEntries.length - 1),
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  function renderEntry(entry: LeetCodeEntry, first: boolean, last: boolean) {
    return (
      <a
        key={entry.id}
        href={entry.url}
        target="_blank"
        style={{
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
          borderTopLeftRadius: first ? 10 : 0,
          borderTopRightRadius: first ? 10 : 0,
          borderBottomLeftRadius: last ? 10 : 0,
          borderBottomRightRadius: last ? 10 : 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 16px',
            background: colors.bg,
            fontSize: 14,
            borderBottom: last ? 'none' : `1px solid ${colors.separator}`,
          }}
        >
          <span style={difficultyDot(entry.difficulty, colors)} />
          <span
            style={{
              flex: 1,
              fontWeight: 400,
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.title}
          </span>
          <span style={{ fontSize: 14, lineHeight: 1 }}>{RATING_EMOJI[entry.rating]}</span>
          <span
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              whiteSpace: 'nowrap',
              minWidth: 40,
              textAlign: 'right',
            }}
          >
            {formatDueDate(entry.dueDate, today)}
          </span>
          <button
            onClick={(e) => {
              e.preventDefault();
              handleDelete(entry.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textTertiary,
              fontSize: 14,
              padding: 0,
              lineHeight: 1,
              fontFamily,
            }}
          >
            ✕
          </button>
        </div>
      </a>
    );
  }
}
