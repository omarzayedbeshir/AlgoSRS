export type Difficulty = 'easy' | 'medium' | 'hard';

export type Rating = 1 | 2 | 3 | 4;

export type SyncStatus = 'local' | 'synced' | 'pending';

export interface LeetCodeEntry {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  rating: Rating;
  date: string;
  syncStatus?: SyncStatus;
  lastSyncedAt?: string;
}

export interface ProblemData {
  title: string;
  url: string;
  difficulty: Difficulty;
}

export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
}
