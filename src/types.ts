export type Difficulty = 'easy' | 'medium' | 'hard';

export type Rating = 1 | 2 | 3 | 4;

export type SyncStatus = 'local' | 'synced' | 'pending';

export interface LeetCodeEntry {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  tags?: string[];
  rating: Rating;
  date: string;
  updatedAt?: string;
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
  stability?: number;
  difficultyFsrs?: number;
  dueDate?: string;
  reps?: number;
  lapses?: number;
  fsrsState?: number;
  lastReviewAt?: string;
}

export interface ProblemData {
  title: string;
  url: string;
  difficulty: Difficulty;
  tags?: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
}
