# Echo Play Live — Band Management App

A full-stack Next.js app connected to Airtable. Built for Echo Play Live to manage bands, shows, members, venues, and booking inquiries.

## Deploy to Vercel (5 minutes)

### Step 1: Push to GitHub
1. Create a new repository on github.com (name it `echo-play-live`)
2. Upload all these files to that repo (drag and drop the folder, or use GitHub Desktop)

### Step 2: Connect to Vercel
1. Go to vercel.com and click "Add New Project"
2. Import your `echo-play-live` GitHub repository
3. Vercel will auto-detect it as a Next.js app

### Step 3: Add Environment Variables
In Vercel project settings → Environment Variables, add:

| Name | Value |
|------|-------|
| `AIRTABLE_TOKEN` | Your Airtable Personal Access Token |
| `AIRTABLE_BASE` | Your Airtable Base ID (starts with `app`) |

### Step 4: Deploy
Click Deploy. Vercel builds and deploys automatically.
Your app will be live at `your-project-name.vercel.app`

### Step 5: Custom domain (optional)
In Vercel → Domains, add `app.echoplaylive.com` and follow DNS instructions.

---

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

The `.env.local` file already has your credentials for local development.

---

## App Structure

```
pages/
  index.js          — Main app (all views)
  api/
    airtable.js     — Server-side Airtable fetch (no CORS)
    inquiry.js      — Submit booking inquiries to Airtable
styles/
  globals.css       — All styles
```

## Airtable Tables Used
- BANDS
- MEMBERS  
- SHOWS
- VENUES
- COMMUNICATIONS
- BLACKOUT DATES
- TASKS
- INQUIRIES

## Features
- Admin dashboard with live Airtable data
- Shows tracker with band filter
- Full P&L finance view
- Member roster with sub/replacement tracking
- Availability calendar with conflict detection
- Venue CRM with communication log
- Booking inquiry pipeline
- Promote tab with copy generation for Facebook, Bandsintown, Instagram, text
- Member portal (select your name, see your shows + blackouts)
- Public booking form (submits directly to Airtable INQUIRIES table)
- Role switcher: Admin / Member / Public
