# EcoGo!

This is a code bundle for EcoGo!. The original design is available at https://www.figma.com/design/wSoUYzrk2gMgn0wVuecJK7/EcoGo-.

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server at http://localhost:5173.

## Backend (Supabase)

- The app reads its catalog from the Supabase project configured in `.env` (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`; public values). Put personal overrides or secrets in `.env.local`.
- The schema and seed data live in `supabase/migrations/`. To use your own Supabase project, apply them in
  order (Supabase CLI `supabase db push`, or paste them into the SQL editor), then set the two variables.
- If Supabase is unreachable, the app falls back to the bundled `src/data/products.csv`.

Project docs: [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) (start here), [ARCHITECTURE.md](ARCHITECTURE.md),
[KNOWN_ISSUES.md](KNOWN_ISSUES.md), [SYNOPSIS.md](SYNOPSIS.md).
