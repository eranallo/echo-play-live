# Echo Play Live — member app

A phone web app for Echo Play Live's band members and crew: upcoming shows,
show details, setlists, the availability calendar and blackout dates. All data
lives in the Echo Play Live Airtable base; the app reads it live, so what
members see is what Airtable says.

Management (booking, setlist building, money) stays in Airtable. This app
deliberately has none of it.

## How sign-in works

Each person has a personal link: `https://echo-play-live.vercel.app/m/<token>`.

- The token is the **App Token** field on their MEMBERS or CREW record. The
  ready-to-send link is in the **App Link** field next to it.
- People open their link once and add it to their home screen.
- To cut someone off, or replace a link that got shared, change or clear their
  App Token in Airtable. The old link stops working immediately.
- The bare address (`/`) only says to use your personal link.

## What the app sends to a person

Only the fields listed in [`lib/visibility.js`](lib/visibility.js) ever leave
the server. Members and crew see confirmed shows (and past completed ones),
bandmates' and crew phone numbers, venue logistics, setlists and blackout
dates. They never see emails, pay, rates, show finances, tokens or private
contact details. Holds, inquiries and cancelled shows stay in Airtable.

If you rename a field in Airtable that appears in `lib/visibility.js`, update
the name there too, or that table will fail to load (the app shows a banner
naming the table).

## What a person can change

- **Blackout dates**: add, edit and delete their own (`pages/api/blackout.js`).
  The server attaches the date to whoever owns the link and checks ownership
  before any edit or delete.
- **Their own profile photo** (`pages/api/upload-photo.js`), stored in Vercel
  Blob and attached to their MEMBERS "Profile Photo" or CREW "Photo" field.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
|------|-------|
| `AIRTABLE_TOKEN` | Airtable personal access token for the Echo Play Live base |
| `AIRTABLE_BASE` | The base ID (starts with `app`) |
| `BLOB_READ_WRITE_TOKEN` | Added automatically when a Vercel Blob store is connected |

Set them for both **Production** and **Preview** so preview links work.

## Local development

```bash
npm install
npm run dev
```

Put the variables above in `.env.local` (git ignores it). Then open
`http://localhost:3000/m/<your App Token>`.

`AIRTABLE_API_ROOT` can point the app at a stand-in Airtable API for testing;
leave it unset to use the real one.

## Layout

```
pages/
  index.js          the bare address: "use your personal link"
  m/[token].js      a person's app
  api/me.js         everything a signed-in person can see, in one request
  api/blackout.js   create / edit / delete your own blackout dates
  api/upload-photo.js
components/
  EplApp.js         every screen
lib/
  airtable.js       the one place that talks to Airtable
  identity.js       personal-link token → member or crew record
  visibility.js     which fields and shows a person may receive
styles/
  globals.css
```
