# Level 1 Schedule

A password-protected timetable and school-year tracker for Level 1 Dental Hygiene
(Oct 5, 2026 – Mar 27, 2027). It's built from the official L1 timetable PDF, with the
"Oct-26", "Dental Hygiene" and "Level 1" header rows and the Level 3 schedule removed.

## Features

- **Week view (Sunday to Saturday).** Colour-coded by course. Days without classes are shaded,
  and a red line marks the current time. On phones it switches to a list of days.
- **Online vs. in person.** In-person classes are solid tinted blocks with a 📍 icon, and online
  classes are dashed outlines with a 🖥 icon. Each day is labelled *On campus*, *Online* or *Campus + online*.
- **Groups.** Sessions for your groups (Pre-clinic **A**, Rad lab **A2** by default) carry a dark
  group chip. Toggle **My groups / All groups** to hide other groups' sessions or show them faded.
  You can change your groups in Settings.
- **Exams & tests** are outlined and badged. A countdown list appears on the Tasks page.
- **Sidebar legend and course filter.** It appears on the Week and Month views and is laid out as a table like the Notion page:
  a key table, then a *Current courses* table with columns Show, Code, Name and Instructor.
  Untick a course to hide its classes and deadlines from the timetable and from printouts. *Hide all*
  and *Show all* switch every course at once. The choice is synced to every device.
- **Month, Agenda and Courses views.** The Agenda is searchable and can be filtered by course.
  Each Courses card shows instructors, sessions done, the next class, the next exam, attendance and the
  weighted grade so far.
- **Tracking.** Click any class to tick *Prepared*, *Attended* and *Notes reviewed*, and to write
  class notes for that session. The notes then appear inside that class's time block on the timetable
  (and on printouts).
- **Deadlines (Tasks tab).** Every due date is listed in date order, with columns for Class, Name, Due date,
  Status (Not started / In progress / Done), Grade and Weight, like the Notion tracker. Timetable exams
  are included, and a line marks today. You can add more from the row at the bottom. The deadlines from the Notion
  "CADH L1 – Deadline Tracker" are preloaded once.
- **Notes.** Free-form notes you can tag with a course, pin and search. Class-session notes are
  also listed here.
- **Assignments, due dates, events, exams and reminders.** Each one can have a checklist,
  a priority and file attachments. Use **Import** to load a `.ics` calendar (Brightspace/D2L,
  Google, Outlook), a `.csv` file or a backup. **Settings → Export calendar** downloads an `.ics`
  file of your schedule.
- **Print.** Printouts are landscape and colour-coded. *Compact list* fills each page with as many
  weeks as fit (the whole term takes about 8 pages, versus 24 in the original PDF). *Time grid* fits 1–2 weeks per page.
  You can print only your groups.
- **Password protection** for every page, file and API call. Sessions last 30 days.

Keyboard shortcuts: `←`/`→` change week or month, `T` jumps to today, `N` adds a new item,
`P` prints, and `1`–`6` switch views.

## Deploy to Vercel

1. Import this repository in Vercel (**Add New → Project**). No build settings are needed,
   because `vercel.json` already sets them.
2. Under **Settings → Environment Variables**, add `APP_PASSWORD`, set to the password you want.
   You can also add `AUTH_SECRET` (any long random string) for extra cookie-signing entropy.
3. Deploy. If no password is set, the site refuses every request.

### Sync between devices and backups (Turso)

Without storage, notes and deadlines are saved in the browser you used. With a Turso database, everything
(notes, deadlines, class check-ins, grades, settings and attachments) is saved online. Any device you sign in on
gets the same data.

1. In the Vercel project, open **Storage** and create or connect a **Turso** database to the project.
   This adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Names with a custom prefix
   (e.g. `STORAGE_TURSO_DATABASE_URL`) also work.
2. Redeploy, because new environment variables only apply to new deployments. The header will then show **Synced**,
   and **Settings** will say "Cloud sync is on (Turso database)".

The app creates its one table (`kv`) by itself. Every save also writes that day's **backup**, and
the last 30 days are kept. In **Settings → Cloud backups** you can download any of them as a file or restore it.
Restoring makes that day's version the current one on every device.

Anything saved in a browser before the database was connected is uploaded the first time that
browser opens the site.

Upstash Redis (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) is still supported as an alternative.
Attachments of up to 2.5 MB are stored in the cloud. Without cloud storage, attachments of up to 1 MB
are stored on the device only.

## Run locally

```bash
cp .env.example .env.local   # set APP_PASSWORD
npm run dev                  # http://localhost:3000
npm test
```

To try out cloud sync locally without a database, set `LOCAL_STORE_FILE=.data/store.json`.

## Project layout

```
middleware.js        Vercel Routing Middleware – password gate for everything
api/login.js         POST password → signed HttpOnly cookie
api/logout.js        clears the cookie
api/data.js          GET/PUT synced user data (notes, tasks, checks, settings)
api/files.js         attachment upload/download
lib/auth.js          HMAC-signed session tokens (Web Crypto, Edge + Node)
lib/store.js         Turso (libSQL HTTP) / Upstash storage + daily backups (+ local JSON file for dev)
public/              the app (index.html, app.js, styles.css, schedule.json, login.html)
tools/               scripts that rebuilt schedule.json from the timetable PDF
dev-server.js        local stand-in for Vercel
```

## Updating the timetable

`public/schedule.json` was generated from the PDF by reading the cell geometry
(`tools/extract_timetable.py`, which needs `pdfplumber` and `pypdfium2`) and then cleaned up by
`tools/normalize_timetable.py`. If a revised timetable is released:

```bash
python3 tools/extract_timetable.py L1_Timetable.pdf raw.json
python3 tools/normalize_timetable.py raw.json schedule.json
```

Then copy the result to `public/schedule.json`, check a few weeks against the PDF, and run `npm test`.
Session IDs are derived from the date, time, course and title, so notes and checks on sessions
that haven't changed are kept.
