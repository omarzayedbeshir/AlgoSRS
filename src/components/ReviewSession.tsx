import { useState, useEffect, useRef } from 'react';
import type { LeetCodeEntry, Rating } from '../types';
import { getReviewQueue } from '../lib/queue';
import {
  save,
  getAll,
  getReviewSessionState,
  saveReviewSessionState,
  isActiveReviewSession,
} from '../storage';
import type { ReviewResult } from '../storage';
import { api } from '../lib/api-client';
import { reviewEntry } from '../lib/fsrs';
import { sameProblemUrl } from '../lib/leetcode';
import { fontFamily, button, difficultyDot } from '../styles';
import { useTheme } from './ThemeContext';
import RatingButtons, { RATING_META } from './RatingButtons';

interface Props {
  onExit: () => void;
  onEntriesChanged: () => void;
}

export default function ReviewSession({ onExit, onEntriesChanged }: Props) {
  const { colors } = useTheme();
  const [queue, setQueue] = useState<LeetCodeEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [rating, setRating] = useState<Rating | null>(null);
  const [saving, setSaving] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [href, setHref] = useState(() => window.location.href);
  const queueRef = useRef<LeetCodeEntry[]>([]);
  const indexRef = useRef(0);
  const ratingRef = useRef<Rating | null>(null);
  const finishedRef = useRef(false);
  const resultsRef = useRef<ReviewResult[]>([]);
  const skippedRef = useRef(0);
  const startedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    ratingRef.current = rating;
  }, [rating]);
  useEffect(() => {
    finishedRef.current = finished;
  }, [finished]);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    skippedRef.current = skipped;
  }, [skipped]);

  const entry = queue[index];
  const locked = !entry || !sameProblemUrl(href, entry.url);
  const lockedRef = useRef(locked);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    const onPop = () => setHref(window.location.href);
    window.addEventListener('popstate', onPop);
    const poll = setInterval(() => {
      setHref((prev) => (prev === window.location.href ? prev : window.location.href));
    }, 1000);
    return () => {
      window.removeEventListener('popstate', onPop);
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await getReviewSessionState();
      if (cancelled) return;
      if (isActiveReviewSession(restored)) {
        const all = await getAll();
        const byId = new Map(all.map((e) => [e.id, e]));
        const restoredQueue = restored.ids
          .map((id) => byId.get(id))
          .filter((e): e is LeetCodeEntry => !!e);
        if (restoredQueue.length > 0) {
          const nextIndex = Math.min(restored.index, restoredQueue.length - 1);
          startedAtRef.current = restored.startedAt;
          setQueue(restoredQueue);
          setIndex(nextIndex);
          setSkipped(restored.skipped);
          setResults(restored.results);
          setLoaded(true);
          await saveReviewSessionState({
            ids: restoredQueue.map((e) => e.id),
            index: nextIndex,
            results: restored.results,
            skipped: restored.skipped,
            finished: false,
            startedAt: restored.startedAt,
          });
          return;
        }
      }
      const q = await getReviewQueue();
      if (cancelled) return;
      startedAtRef.current = new Date().toISOString();
      setQueue(q.dueNow);
      setLoaded(true);
      await saveReviewSessionState({
        ids: q.dueNow.map((e) => e.id),
        index: 0,
        results: [],
        skipped: 0,
        finished: false,
        startedAt: startedAtRef.current,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function finishSession() {
    const q = await getReviewQueue();
    setNextDue(q.upcoming[0]?.dueDate ?? null);
    setFinished(true);
    await saveReviewSessionState(null);
  }

  async function advance(results: ReviewResult[], skipped: number) {
    const next = indexRef.current + 1;
    if (next >= queueRef.current.length) {
      await finishSession();
    } else {
      setIndex(next);
      setRating(null);
      await saveReviewSessionState({
        ids: queueRef.current.map((e) => e.id),
        index: next,
        results,
        skipped,
        finished: false,
        startedAt: startedAtRef.current,
      });
    }
  }

  async function handleSubmit() {
    const cur = ratingRef.current;
    const entry = queueRef.current[indexRef.current];
    if (!cur || !entry || lockedRef.current) return;
    setSaving(true);
    const res = reviewEntry(entry, cur);
    await save(res.updatedEntry);
    api.upsertEntry(res.updatedEntry).catch(() => {});
    onEntriesChanged();
    const nextResults = [
      ...resultsRef.current,
      { title: entry.title, rating: cur, scheduledDays: res.scheduledDays },
    ];
    setResults(nextResults);
    setRating(null);
    setSaving(false);
    await advance(nextResults, skippedRef.current);
  }

  function handleSkip() {
    const nextSkipped = skippedRef.current + 1;
    setSkipped(nextSkipped);
    setRating(null);
    advance(resultsRef.current, nextSkipped);
  }

  function handleExit() {
    saveReviewSessionState(null).catch(() => {});
    onExit();
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (finishedRef.current) {
        if (e.key === 'Enter' || e.key === 'Escape') handleExit();
        return;
      }
      if (e.key === 'Escape') {
        handleExit();
        return;
      }
      if (e.key.toLowerCase() === 's') {
        handleSkip();
        return;
      }
      if (lockedRef.current) return;
      const num = Number(e.key);
      if (num >= 1 && num <= 4) {
        setRating(num as Rating);
        return;
      }
      if (e.key === 'Enter') {
        if (ratingRef.current && !saving) handleSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving]);

  if (!loaded) {
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily,
          fontSize: 14,
          color: colors.textSecondary,
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${colors.separator}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleExit}
          style={{
            flex: 1,
            textAlign: 'left',
            background: 'none',
            border: 'none',
            color: colors.accent,
            fontSize: 15,
            padding: 0,
            fontFamily,
            cursor: 'pointer',
          }}
        >
          ‹ Exit
        </button>
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Review
        </span>
        <span style={{ flex: 1, textAlign: 'right', fontSize: 13, color: colors.textSecondary }}>
          {finished ? queue.length : `${Math.min(index + 1, queue.length)}/${queue.length}`}
        </span>
      </div>

      {finished ? (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px' }}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
              Session complete
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
              {results.length} reviewed · {skipped} skipped
            </div>
            {nextDue && (
              <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8 }}>
                Next review:{' '}
                <span style={{ color: colors.text }}>
                  {new Date(nextDue).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={handleExit} style={{ ...button('primary', colors), width: '100%' }}>
              Done
            </button>
          </div>
        </div>
      ) : entry ? (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span style={difficultyDot(entry.difficulty, colors)} />
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, lineHeight: 1.3 }}>
              {entry.title}
            </div>
          </div>

          {entry.tags && entry.tags.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 12,
              }}
            >
              {entry.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 8,
                    background: colors.bgSecondary,
                    color: colors.textSecondary,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            Last rated {RATING_META[entry.rating].emoji} ·{' '}
            {entry.lastReviewAt
              ? new Date(entry.lastReviewAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : 'never reviewed'}
          </div>

          {locked && (
            <div
              style={{
                fontSize: 12,
                color: colors.orange,
                textAlign: 'center',
                marginBottom: 12,
                background: colors.bgSecondary,
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              Open the problem to rate it
            </div>
          )}

          <RatingButtons value={rating} onChange={setRating} disabled={locked || saving} />

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button onClick={handleSkip} disabled={saving} style={button('secondary', colors)}>
              Skip (S)
            </button>
            <a
              href={entry.url}
              onClick={() => setHref(entry.url)}
              style={{
                ...button('secondary', colors),
                textDecoration: 'none',
                flex: 1,
                textAlign: 'center',
              }}
            >
              Open problem →
            </a>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!rating || locked || saving}
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
              background: rating && !locked ? colors.accent : colors.bgTertiary,
              color: colors.bg,
              opacity: saving ? 0.6 : 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
            }}
          >
            {saving ? 'Saving...' : 'Submit (Enter)'}
          </button>

          <div
            style={{ fontSize: 11, color: colors.textTertiary, textAlign: 'center', marginTop: 10 }}
          >
            1-4 to rate · Enter submit · S skip
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: colors.textSecondary,
            fontSize: 14,
            padding: '0 24px',
            lineHeight: 1.6,
          }}
        >
          No problems due right now 🎉
        </div>
      )}
    </div>
  );
}
