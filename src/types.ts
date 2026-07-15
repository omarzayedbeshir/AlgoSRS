export type Difficulty = 'easy' | 'medium' | 'hard';

export type Rating = 1 | 2 | 3 | 4;

export interface LeetCodeEntry {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  rating: Rating;
  date: string;
}

export interface ProblemData {
  title: string;
  url: string;
  difficulty: Difficulty;
}
