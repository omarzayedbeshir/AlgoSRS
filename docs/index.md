# AlgoSRS Privacy Policy

_Last updated: July 31, 2026_

This privacy policy describes how AlgoSRS (the "extension", "we") handles information when you use our Chrome extension for spaced-repetition review of LeetCode problems.

## 1. Information we collect

**Account information.** When you create an account, we collect your email address and a password to authenticate you. Passwords are handled by Supabase Auth and stored only as a salted hash — we never have access to your plaintext password. If you opt in at signup, we store your marketing-consent preference.

**Saved review data.** When you save a LeetCode problem for review, we collect the problem's title, URL, difficulty, and tags, together with your rating and review history (dates and FSRS scheduling state). This data is stored on your device first and synced to our servers only after you sign in.

**Page data.** To pre-fill the save form, the extension reads the current LeetCode problem page (title, difficulty, tags, URL) in your active tab on leetcode.com. It does not read other page content.

## 2. Local storage

All extension data is written to Chrome's local extension storage (`chrome.storage.local`) on your device, including your session token. This data stays on your device until you delete it or uninstall the extension.

## 3. How we use your information

We use the information we collect solely to provide the extension's single purpose: scheduling and syncing spaced-repetition reviews of LeetCode problems. Your email is used for account authentication, password resets, and — only if you opted in — occasional updates and tips.

## 4. Sharing

We do not sell, rent, or transfer your personal information to third parties, except as required to operate the service:

- **Supabase** — authentication and user account data.
- **Railway / PostgreSQL** — hosting our backend and database.

We do not use advertising networks, analytics SDKs, or tracking scripts.

## 5. Retention and your controls

- **Export:** You can export all of your data as a JSON file from the extension's Settings at any time.
- **Delete entries:** You can delete individual problems or all saved problems without deleting your account.
- **Delete account:** You can permanently delete your account and all associated data from Settings. Deletion is finalized after a confirmation step, and delete requests expire after 24 hours.
- **Uninstall:** Removing the extension clears locally stored data; server-side data remains until you delete your account.

## 6. Security

All traffic is encrypted over HTTPS. API requests are authenticated with signed JWT tokens validated against the provider's keys, requests are rate-limited, and server origins are restricted by an allowlist.

## 7. Children

The extension is not directed at children under 13, and we do not knowingly collect personal information from them.

## 8. Changes

We may update this policy from time to time. Updates will be posted at this URL, and material changes will be announced within the extension.

## 9. Contact

Questions about this policy? Open an issue at [github.com/omarzayedbeshir/AlgoSRS/issues](https://github.com/omarzayedbeshir/AlgoSRS/issues).
