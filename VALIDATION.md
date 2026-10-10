# Export validation

Checked on October 10, 2026.

| Check | Result |
| --- | --- |
| Production static build | Passed |
| TypeScript type check | Passed |
| Community, demo-access, and personalization tests | 27 passed, 0 failed |
| Static preview under a repository-style URL | Passed |
| Home and Clubs navigation and refresh | Passed |
| Dynamic browser tab title | Passed: Home and Clubs |
| Account switching | Passed |
| Post and message persistence after refresh | Passed |
| Event bookmark persistence after refresh | Passed |
| Local image upload, display, and persistence | Passed |
| Copy post link includes repository path and hash route | Passed |
| Mobile layout at 390 by 844 | Visually checked |
| Club and brand images | No broken loaded images |
| Browser error and warning logs during checks | None observed |
| Credential-pattern and private-file scan | No findings |
| Dependency download URLs | Public npm registry only |
| Upload-folder scan | 89 files checked, including hidden files and compiled assets |
| Browser walkthrough | Signup, profile switching, friends, messages, posts, polls, clubs, events, saved items, and moderation checked |
| Keyboard menus and post undo | Checked |

The scan checked all upload files for common service credentials, private keys, JWTs, literal secret assignments, credential-bearing URLs, private filesystem paths, and personal email addresses. It also checked filenames for private configuration, database exports, logs, source maps, and Git history. None were found. The included screenshots were visually reviewed and contain fictional demo activity. The only fetch call in the compiled bundle is Vite's module-preload helper for application assets; community activity is stored locally. Environment files, private account exports, Git history, caches, server routes, and build dependencies are excluded from the upload folder. This is a focused export check, not a guarantee against every possible security issue in a production shared network.

The demo still uses local browser storage. Tests confirm the behavior of the fictional demo, not real student adoption or a live multi-user backend. No actual GitHub deployment was performed; deployment is completed by following START-HERE.md.
