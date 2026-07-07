## Security Coding Rules

These apply to all code written in this repo, not just security audits.

### Secrets & Environment Variables
- Server secrets (`OPENAI_API_KEY`, Firebase Admin credentials) must never appear in `NEXT_PUBLIC_*` vars or any file that could be bundled client-side
- Firebase Admin SDK (`src/lib/firebase-admin.ts`) is server-only - never import in `"use client"` files or client components

### URL Inputs (SSRF Prevention)
Any route that accepts a URL as input (`/api/fetch-file`, crawl trigger) must validate before fetching:
- Must start with `https://`
- Must not resolve to private IP ranges: `10.x`, `172.16-31.x`, `192.168.x`, `127.x`, `::1`, `localhost`

### LLM Prompt Construction (Injection Prevention)
Brand Memory and crawled website content originates from untrusted external sources. When constructing LLM prompts:
- Keep system instructions and external data in separate roles (`system` vs `user`)
- Never interpolate raw crawled content into the system prompt
- Treat Brand Memory fields as data to be quoted/structured, not as trusted instructions

### Firestore Writes
- Validate the shape of all data before writing - no raw request body fields written directly to Firestore
- Never use user-supplied strings as Firestore document IDs or field paths without validation

### API Error Responses
- Never include stack traces, internal paths, or Firestore query details in error responses
- Error messages must be safe to expose publicly
