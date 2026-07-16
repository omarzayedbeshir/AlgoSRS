import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'output',
  manifest: {
    name: 'LC FSRS',
    version: '0.1.0',
    description: 'Track LeetCode problem difficulty with ratings',
    permissions: ['storage', 'activeTab'],
    host_permissions: [
      '*://leetcode.com/*',
      'https://*.supabase.co/*',
      'http://localhost:8080/*',
      'https://lc-fsrs-production.up.railway.app/*',
    ],
  },
});
