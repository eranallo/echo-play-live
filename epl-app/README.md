# Echo Play Live — member app

A phone web app for Echo Play Live's band members and crew: upcoming shows,
show details, the song library and setlists, the availability calendar and
blackout dates. All data
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

## Practices and who knows which song

Two tables in Airtable feed the newer features:

- **PRACTICES**: one row per practice (band, date, start/end, location,
  status, setlist to run, members needed, notes). Add them in Airtable; mark
  a skipped week **Cancelled** rather than deleting it, and the app shows it
  as called off. Leave "Members Needed" empty to mean the whole band.
- **SONG KNOWLEDGE**: one row per member per song (Know it / Learning / To
  learn). Members set their own answers in the app; the app writes the
  Entry and Key columns, so leave those alone.

## The Songs tab

A Library / Setlists switch. The library is built from SONGS:

- A band's songs are the ones whose **Performed By** links to it, plus any
  song on one of that band's setlists. Songs with **Show Status** "Dead" are
  left out of the band lists and show as Retired in the full catalog.
- **Full catalog** is every song in SONGS (about 1,200). It loads from
  `/api/songs?scope=catalog` only when someone opens it, so the first load
  stays small.
- Filters: band, your own answer (with counts), and songs on your upcoming
  shows' setlists.
- A song's page adds band status, album / year / time signature / shorthand,
  and **Lyrics**, fetched one song at a time from `/api/songs?id=`.

## What a person can change

- **Blackout dates**: add, edit and delete their own (`pages/api/blackout.js`).
  The server attaches the date to whoever owns the link and checks ownership
  before any edit or delete.
- **Their own answer for a song** (`pages/api/song-knowledge.js`): Know it,
  Learning, To learn, or cleared. Members only; always the caller's own row.
- **Their own profile photo** (`pages/api/upload-photo.js`), uploaded straight
  into their MEMBERS "Profile Photo" or CREW "Photo" field (the new photo
  replaces the old one).

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
|------|-------|
| `AIRTABLE_TOKEN` | Airtable personal access token for the Echo Play Live base |
| `AIRTABLE_BASE` | The base ID (starts with `app`) |

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

## Look and feel

The layout follows StageKin (cards on a recessed page, large titles, a bottom
tab bar, bottom sheets); colour and type are Echo Play Live's "After Hours"
brand from the website: night `#11191d`, warm white `#f5f0e8`, amber
`#efc47c`, Cabinet Grotesk headings and DM Sans text (both self-hosted in
`public/fonts`), and the EPL seal (`public/brand`). Light is the default;
members can switch to dark in their profile sheet (stored on their phone).
All colours are CSS variables at the top of `styles/globals.css`.

## Layout

```
pages/
  index.js            the bare address: "use your personal link"
  m/[token].js        a person's app
  _document.js        applies the saved light/dark theme before first paint
  api/me.js           everything a signed-in person can see, in one request
  api/blackout.js     create / edit / delete your own blackout dates
  api/upload-photo.js
  api/song-knowledge.js  your answer for a song
  api/songs.js        the full song catalog, and one song's lyrics
components/
  EplApp.js           loading, tabs, back stack, profile sheet, theme
  HomeScreen.js       needs you, next show, this week, upcoming
  CalendarScreen.js   month view (Personal / Echo Play Live), coming up, blackouts
  ShowScreen.js       call times, directions, lineup, crew, set, notes, weather
  PracticeScreen.js   practices: coming up, called off, who's needed
  PeopleScreen.js     everyone in EPL, by band or A–Z
  SongsScreen.js      the Songs tab: library (filters, catalog) / setlists
  SetlistsScreen.js   setlists by tuning; the song page; who knows each song
  ui.js               shared pieces: cards, rows, tags, sheets, avatars
  context.js          what every screen can reach (data, api, navigation)
lib/
  airtable.js         the one place that talks to Airtable
  identity.js         personal-link token → member or crew record
  visibility.js       which fields and shows a person may receive
  derive.js           whose show is this, who is out, what needs you
  format.js           dates, times, durations
styles/
  globals.css         design tokens and every component style
```
