# Export validation

Checked on October 9, 2026.

| Check | Result |
| --- | --- |
| Production static build | Passed |
| TypeScript type check | Passed |
| Community behavior tests | 16 passed, 0 failed |
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

The scan checked source and compiled files for common API-key, token, private-key, authorization-header, private filesystem path, and original hosted-runtime patterns. Environment files, private account exports, Git history, caches, server routes, and build dependencies are excluded from the upload folder. This is a focused export check, not a full security audit of a production shared network.

The demo still uses local browser storage. Tests confirm the behavior of the fictional demo, not real student adoption or a live multi-user backend. No actual GitHub deployment was performed; deployment is completed by following START-HERE.md.
