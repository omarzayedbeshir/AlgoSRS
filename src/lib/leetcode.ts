import type { ProblemData, Difficulty } from '../types';

export function extractTags(): string[] {
  const nextData = document.getElementById('__NEXT_DATA__');
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData.textContent || '');
      const queries = parsed?.props?.pageProps?.dehydratedState?.queries;
      if (queries) {
        for (const q of queries) {
          const tags = q?.state?.data?.question?.topicTags;
          if (tags && Array.isArray(tags)) {
            const names = tags.map((t: any) => t.name).filter(Boolean);
            if (names.length) return names;
          }
        }
      }
    } catch {}
  }

  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/tag/"]');
  const seen = new Set<string>();
  const result: string[] = [];
  for (const a of links) {
    const t = a.textContent?.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      result.push(t);
    }
  }
  return result;
}

export function extractTitle(): string | null {
  const og = document.querySelector('meta[property="og:title"]');
  if (og) {
    const c = og.getAttribute('content')?.replace(/ - LeetCode.*$/, '').trim();
    if (c) return c;
  }
  const titleEl = document.querySelector('[data-cy="question-title"]');
  if (titleEl?.textContent) return titleEl.textContent.trim();
  const t = document.title.replace(/ - LeetCode(?: - \w+)?$/, '').trim();
  if (t) return t;
  return null;
}

export function extractUrl(): string | null {
  const match = window.location.href.match(/^https?:\/\/leetcode\.com\/problems\/[^/?#]+/);
  return match ? match[0] : null;
}

export function tryExtractDifficulty(): Difficulty | null {
  const badge = document.querySelector('[data-difficulty]');
  if (badge) {
    const d = badge.getAttribute('data-difficulty')?.toLowerCase();
    if (d === 'easy' || d === 'medium' || d === 'hard') return d;
  }
  const diffEl = document.querySelector('.text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard, [class*="difficulty"]');
  if (diffEl?.textContent) {
    const t = diffEl.textContent.trim().toLowerCase();
    if (t === 'easy' || t === 'medium' || t === 'hard') return t;
  }
  const diffMatch = document.documentElement.innerHTML.match(/"difficulty"\s*:\s*"(Easy|Medium|Hard)"/);
  if (diffMatch) {
    return diffMatch[1].toLowerCase() as Difficulty;
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text === 'Easy') return 'easy';
    if (text === 'Medium') return 'medium';
    if (text === 'Hard') return 'hard';
  }
  return null;
}

export async function extractDifficulty(): Promise<Difficulty> {
  for (let i = 0; i < 10; i++) {
    const d = tryExtractDifficulty();
    if (d) return d;
    await new Promise(r => setTimeout(r, 200));
  }
  return tryExtractDifficulty() ?? 'medium';
}

export async function extractProblemData(): Promise<ProblemData | null> {
  const title = extractTitle();
  const url = extractUrl();
  if (!title || !url) return null;
  const difficulty = await extractDifficulty();
  const tags = extractTags();
  return { title, url, difficulty, tags: tags.length ? tags : undefined };
}

export async function waitForProblemData(): Promise<ProblemData | null> {
  for (let i = 0; i < 30; i++) {
    const data = await extractProblemData();
    if (data) return data;
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}
