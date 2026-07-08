# Lucky List

Online-first personal task web app built with Next.js, Tailwind CSS, React Query, Zod, local PIN unlock, and Supabase email/password cloud storage. IndexedDB is kept only as a temporary legacy migration and backup staging layer.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

For production, connect Supabase so task changes can be pushed to the cloud. Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Without Supabase env values, the production auth flow cannot save online. Add the Supabase URL and publishable/anon key before using the app as the source of truth.

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL files in `supabase/migrations/` in order, including the notification preference migration.
3. Confirm RLS is enabled for `profiles`, `tasks`, `subtasks`, `categories`, and `user_settings`.
4. In Authentication > Providers, keep Email enabled.
5. Decide whether email confirmation should be required for sign-up.
6. Copy the project URL and anon key into `.env.local` locally and Vercel environment variables in production.

## Vercel Deploy

1. Import this repo into Vercel.
2. Set Framework Preset to Next.js.
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` with the production URL
4. Deploy preview, test Supabase login, PIN unlock, cloud update, backup/export, then promote to production.

## QA Checklist

- `npm run lint`
- `npm run test`
- `npm run build`
- Supabase sign-in/sign-up, PIN setup/unlock, PIN lock, and protected routes
- PIN unlock requires an existing Supabase email/password session
- Create, edit, move, archive, delete, undo, and restore tasks
- Notification center, browser reminders, snooze, default reminders, and daily digest
- Search syntax: `#category`, `priority:urgent`, `status:wip`, `due:today`, `due:soon`, `reminder:today`, `repeat:weekly`
- Cloud update after create/edit/move/archive/delete when Supabase is connected
- JSON/HTML import, JSON backup, CSV export
- Mobile layout at 375-430px with bottom nav and More menu
