# Lucky List

Hybrid personal task web app built with Next.js, Dexie/IndexedDB, Tailwind CSS, PWA support, and optional Supabase sync.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

The app works with a local PIN and IndexedDB without any environment variables. Copy `.env.example` to `.env.local` only when you want optional Supabase sync:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Without Supabase env values, the app runs in PIN-protected local mode with IndexedDB only.

## Supabase Setup

1. Create a Supabase project.
2. Run `supabase/migrations/20260704130000_lucky_list_schema.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Confirm RLS is enabled for `profiles`, `tasks`, `subtasks`, `categories`, and `user_settings`.
4. Copy the project URL and anon key into `.env.local` locally and Vercel environment variables in production.

## Vercel Deploy

1. Import this repo into Vercel.
2. Set Framework Preset to Next.js.
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` with the production URL
4. Deploy preview, test PIN unlock/sync/offline shell, then promote to production.

## QA Checklist

- `npm run lint`
- `npm run build`
- PIN setup/unlock/logout and protected routes
- Create, edit, move, archive, delete, undo, and restore tasks
- Search syntax: `#category`, `priority:urgent`, `status:wip`, `due:today`, `due:soon`, `reminder:today`, `repeat:weekly`
- Offline create/edit, then reconnect and sync
- JSON/HTML import, JSON backup, CSV export
- Mobile layout at 375-430px with bottom nav and More menu
