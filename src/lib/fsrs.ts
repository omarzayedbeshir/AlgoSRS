import { fsrs, createEmptyCard, Rating as FsrsRating, Grade } from 'ts-fsrs';
import type { LeetCodeEntry, Rating } from '../types';

const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9, enable_short_term: false });

export function reviewEntry(entry: LeetCodeEntry, grade: Rating): {
  updatedEntry: LeetCodeEntry;
  scheduledDays: number;
} {
  const card = cardFromEntry(entry);
  const now = new Date();
  const result = scheduler.next(card, now, gradeToFsrs(grade));
  return {
    updatedEntry: {
      ...entry,
      stability: result.card.stability,
      difficultyFsrs: result.card.difficulty,
      reps: result.card.reps,
      lapses: result.card.lapses,
      fsrsState: result.card.state,
      dueDate: result.card.due.toISOString(),
      lastReviewAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    scheduledDays: result.card.scheduled_days,
  };
}

function cardFromEntry(entry: LeetCodeEntry) {
  const card = createEmptyCard(entry.lastReviewAt ? new Date(entry.lastReviewAt) : new Date(entry.date));
  if (entry.fsrsState !== undefined && entry.fsrsState !== 0) {
    card.stability = entry.stability ?? card.stability;
    card.difficulty = entry.difficultyFsrs ?? card.difficulty;
    card.reps = entry.reps ?? 0;
    card.lapses = entry.lapses ?? 0;
    card.state = entry.fsrsState as any;
    if (entry.dueDate) card.due = new Date(entry.dueDate);
    if (entry.lastReviewAt) card.last_review = new Date(entry.lastReviewAt);
  } else if (entry.dueDate) {
    card.due = new Date(entry.dueDate);
  }
  return card;
}

function gradeToFsrs(grade: Rating): Grade {
  const map: Record<Rating, FsrsRating> = {
    1: FsrsRating.Again,
    2: FsrsRating.Hard,
    3: FsrsRating.Good,
    4: FsrsRating.Easy,
  };
  return map[grade] as Grade;
}