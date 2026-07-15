import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'output',
  manifest: {
    name: 'LC FSRS',
    version: '0.1.0',
    description: 'Track LeetCode problem difficulty with ratings',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['*://leetcode.com/*'],
    browser_specific_settings: {
      gecko: {
        id: 'lc-fsrs@example.com',
      },
    },
  },
  suppressWarnings: {
    firefoxDataCollection: true,
  },
});
