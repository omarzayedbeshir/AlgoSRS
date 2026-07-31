import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'output',
  manifest: {
    name: 'AlgoSRS',
    version: '0.1.0',
    description: 'Spaced repetition for LeetCode problem reviews',
    icons: {
      '16': 'icon-16.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
    permissions: ['storage', 'activeTab'],
    host_permissions: [
      '*://leetcode.com/*',
      'https://pghpcaitgemoryjfxzyy.supabase.co',
      'https://lc-fsrs-production.up.railway.app/*',
    ],
  },
});
