import { describe, it, expect, beforeEach } from 'vitest';
import { extractTitle, tryExtractDifficulty, extractTags } from '../leetcode';

describe('leetcode', () => {
  describe('extractTitle', () => {
    beforeEach(() => {
      document.head.innerHTML = '';
      document.title = '';
    });

    it('extracts from og:title meta tag', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      meta.setAttribute('content', 'Two Sum - LeetCode');
      document.head.appendChild(meta);

      expect(extractTitle()).toBe('Two Sum');
    });

    it('extracts from og:title with Unicode', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      meta.setAttribute('content', '合并两个有序链表 - LeetCode');
      document.head.appendChild(meta);

      expect(extractTitle()).toBe('合并两个有序链表');
    });

    it('extracts from document.title', () => {
      document.title = 'Two Sum - LeetCode - Prepare';
      expect(extractTitle()).toBe('Two Sum');
    });

    it('returns null when no title found', () => {
      expect(extractTitle()).toBeNull();
    });
  });

  describe('tryExtractDifficulty', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('extracts from data-difficulty attribute', () => {
      const div = document.createElement('div');
      div.setAttribute('data-difficulty', 'Easy');
      document.body.appendChild(div);

      expect(tryExtractDifficulty()).toBe('easy');
    });

    it('extracts from text-difficulty class', () => {
      const span = document.createElement('span');
      span.className = 'text-difficulty-easy';
      span.textContent = 'Easy';
      document.body.appendChild(span);

      expect(tryExtractDifficulty()).toBe('easy');
    });

    it('extracts from inner HTML difficulty match', () => {
      document.body.innerHTML = '<script>{"difficulty":"Medium"}</script>';

      expect(tryExtractDifficulty()).toBe('medium');
    });

    it('extracts from visible text "Medium"', () => {
      const span = document.createElement('span');
      span.textContent = 'Medium';
      document.body.appendChild(span);

      expect(tryExtractDifficulty()).toBe('medium');
    });

    it('returns null when no difficulty found', () => {
      document.body.innerHTML = '<div>Some random content</div>';
      expect(tryExtractDifficulty()).toBeNull();
    });
  });

  describe('extractTags', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('extracts tags from Topics section', () => {
      const topicsHeader = document.createElement('span');
      topicsHeader.className = 'text-sd-foreground';
      topicsHeader.textContent = 'Topics';

      const section = document.createElement('div');
      section.className = 'flex-col';

      const link1 = document.createElement('a');
      link1.href = '/tag/array/';
      link1.textContent = 'Array';

      const link2 = document.createElement('a');
      link2.href = '/tag/hash-table/';
      link2.textContent = 'Hash Table';

      section.appendChild(topicsHeader);
      section.appendChild(link1);
      section.appendChild(link2);
      document.body.appendChild(section);

      expect(extractTags()).toEqual(['Array', 'Hash Table']);
    });

    it('deduplicates tags', () => {
      const topicsHeader = document.createElement('span');
      topicsHeader.className = 'text-sd-foreground';
      topicsHeader.textContent = 'Topics';

      const section = document.createElement('div');
      section.className = 'flex-col';

      const link1 = document.createElement('a');
      link1.href = '/tag/array/';
      link1.textContent = 'Array';

      const link2 = document.createElement('a');
      link2.href = '/tag/array/';
      link2.textContent = 'Array';

      section.appendChild(topicsHeader);
      section.appendChild(link1);
      section.appendChild(link2);
      document.body.appendChild(section);

      expect(extractTags()).toEqual(['Array']);
    });

    it('returns empty array when no Topics section', () => {
      document.body.innerHTML = '<div>No topics here</div>';
      expect(extractTags()).toEqual([]);
    });

    it('ignores non-tag links in Topics section', () => {
      const topicsHeader = document.createElement('span');
      topicsHeader.className = 'text-sd-foreground';
      topicsHeader.textContent = 'Topics';

      const section = document.createElement('div');
      section.className = 'flex-col';

      const tagLink = document.createElement('a');
      tagLink.href = '/tag/array/';
      tagLink.textContent = 'Array';

      const otherLink = document.createElement('a');
      otherLink.href = '/solution/';
      otherLink.textContent = 'Solution';

      section.appendChild(topicsHeader);
      section.appendChild(tagLink);
      section.appendChild(otherLink);
      document.body.appendChild(section);

      expect(extractTags()).toEqual(['Array']);
    });
  });
});
