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
- **Month, Agenda and Courses views.** The Agenda is searchable and can be filtered by course.
  Each Courses card shows instructors, sessions done, the next class, the next exam, and attendance.
- **Tracking.** Click any class to tick *Prepared*, *Attended* and *Notes reviewed*, and to write
  class notes for that session.
- **Notes.** Free-form notes you can tag with a course, pin and search. Class-session notes are
  also listed here.
- **Assignments, due dates, events, exams and reminders.** Each one can have a checklist,
  a priority and file attachments. Use **Import** to load a `.ics` calendar (Brightspace/D2L,
  Google, Outlook), a `.csv` file or a backup. **Settings → Export calendar** downloads an `.ics`
  file of your schedule.
- **Print.** Printouts are landscape and colour-coded. *Compact list* fits 3 weeks per page
  (the whole term takes 9 pages, versus 24 in the original PDF). *Time grid* fits 1–2 weeks per page.
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

### Sync between devices (recommended)

Without storage, notes and tasks are saved in the browser you used. To share them between
your phone and your laptop:

1. In the Vercel project, open **Storage**, choose **Upstash for Redis** from the Marketplace
   (the free plan is enough), and connect it to the project.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. Redeploy. The header will show **Synced**.

With cloud sync on, attachments of up to 2.5 MB are stored in the cloud. Without it, attachments
of up to 1 MB are stored on the device only.

## Run locally

```bash
cp .env.example .env.local   # set APP_PASSWORD
npm run dev                  # http://localhost:3000
npm test
```

To try out cloud sync locally without Redis, set `LOCAL_STORE_FILE=.data/store.json`.

## Project layout

```
middleware.js        Vercel Routing Middleware – password gate for everything
api/login.js         POST password → signed HttpOnly cookie
api/logout.js        clears the cookie
api/data.js          GET/PUT synced user data (notes, tasks, checks, settings)
api/files.js         attachment upload/download
lib/auth.js          HMAC-signed session tokens (Web Crypto, Edge + Node)
lib/store.js         Upstash Redis REST client (+ local JSON file for dev)
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
