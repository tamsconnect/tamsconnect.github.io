# TAMS Connect

An independent student project by **Subhas Angara**, a Class of 2029 TAMS applicant.

TAMS Connect explores how a campus-specific social platform could help TAMS students and alumni meet people, discover clubs, and turn online conversations into campus plans. It is not an official UNT TAMS application.

## Try the demo

Publish the prepared website using [START-HERE.md](START-HERE.md). No installation is required for the initial GitHub Pages deployment.

The demo includes:

- Student profiles, friendships, posts, comments, mentions, polls, and bookmarks.
- Club pages, official public club logos, club walls, and leadership-based event creation.
- A calendar that follows the visitor's computer date, RSVP, reminders, and event photo collections.
- Messages, notifications, profile switching, saved drafts, editing, and undo for supported actions.

This version runs entirely in the browser. IndexedDB stores one fictional community per browser and repository path. Separate visitors do not share posts or messages. Demo roles model permissions but are not authentication. Real student registration is not open.

## Engineering

React and TypeScript provide the interface. Vite builds static files. A pure community model validates actions, handles permissions and versions, and updates activity. IndexedDB transactions replace the hosted API, so saves do not require a remote server. Uploaded images are validated and stored locally. Hash routing and relative asset paths support GitHub Pages repository URLs.

## Develop locally

Use Node.js 22.18 or newer, or a compatible newer LTS version.

```sh
npm ci
npm run dev
```

Open the address printed by Vite. To check and rebuild:

```sh
npm run typecheck
npm test
npm run build
```

The build updates `index.html`, `assets`, `brand`, `clubs`, and `fonts` at the project root. Commit those rebuilt files together with the source changes. GitHub Pages can serve them directly from `main` without an Actions workflow.

## Repository layout

| Location | Purpose |
| --- | --- |
| `index.html`, `assets/` | Prepared production website |
| `brand/`, `clubs/`, `fonts/` | Published local assets |
| `src/` | Editable application and community model |
| `public/` | Original assets used when rebuilding |
| `tests/` | Community behavior tests |
| `scripts/build.mjs` | Static export build |

See [PRIVACY.md](PRIVACY.md), [ASSET-CREDITS.md](ASSET-CREDITS.md), and [VALIDATION.md](VALIDATION.md).
