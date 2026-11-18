# Open Source Everything (hub)

Static, bilingual (EN/ES) site for Open Source Everything and its projects. Served by a Cloudflare Worker with static assets at https://opensource.dalepanama.com.

- Build: `npm run build` writes `dist/`. Tests: `npm test` (node:test, zero dependencies). Preview: `npm run serve`.
- No em dashes (U+2014) or en dashes (U+2013) anywhere: copy, code, comments, docs.
- Zero runtime dependencies, no network at build time, no third-party requests from the site.
- New logic starts with a failing test. Return new objects, do not mutate inputs.
- Visual design is judged from rendered screenshots, not from source.
