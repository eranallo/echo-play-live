// What the app is allowed to send to a signed-in member or crew person.
//
// Only fields listed here leave the server. Phone numbers are shared with
// everyone in EPL (Evan, 16 Nov 2026); emails, pay, rates, finances, tokens
// and private contact details are not. Every name must match Airtable
// exactly, or Airtable rejects the whole table request (422).

export const VISIBLE_FIELDS = {
  SHOWS: [
    'Show Name', 'Date', 'Status', 'Band', 'Venue',
    'Members Playing', 'Sound Provider', 'Sound Engineer', 'Merch Person',
    'Trailer Load-In Time', 'Load-In Time', 'Sound Check Time', 'Doors Time',
    'Start Time', 'End Time', 'Indoor / Outdoor',
    'Ticket Price', 'Ticket URL',
    'Show Notes', 'Sound Notes', 'Merch Notes', 'Production Notes', 'SETLISTS',
  ],
  BANDS: ['Band Name', 'Logo/Photo', 'Active'],
  // "Role - <band>" says what each member plays in that band, which is what
  // the lineup on a show shows. Add a field here when a band gets one.
  MEMBERS: [
    'Member Name', 'Primary Bands', 'Instruments', 'Profile Photo', 'Phone', 'Active',
    'Role - So Long Goodnight', 'Role - The Dick Beldings', 'Role - Jambi', 'Role - Elite',
  ],
  CREW: ['Name', 'Role', 'Photo', 'Phone', 'Active'],
  // Only what matters for playing the date (Evan, 18 Nov 2026): production,
  // parking, green room, photos. Contacts, deal terms and the general Notes
  // field stay in Airtable.
  VENUES: [
    'Venue Name', 'Address', 'City', 'State', 'Venue Type', 'Capacity', 'Age Restriction',
    'Parking Notes', 'Green Room', 'Stage Specs', 'PA System', 'House Console', 'FOH Location',
    'Power Drops', 'Mic Locker', 'Sound Notes', 'Photo', 'Room Layout',
  ],
  'BLACKOUT DATES': ['Member', 'Crew', 'Date', 'End Date', 'Reason'],
  SETLISTS: ['Set Name', 'Songs', 'Band', 'Show', 'Duration', 'Notes'],
  SONGS: ['Song Title', 'Artist', 'Duration', 'Guitar Tuning', 'Bass Tuning', 'Key', 'BPM'],
  // Practices, cancelled ones included so members see a week was called off.
  PRACTICES: ['Practice', 'Band', 'Date', 'Start Time', 'End Time', 'Location', 'Status', 'Setlist', 'Members Needed', 'Notes'],
  // Who knows which song (Know it / Learning / To learn), one row per
  // member per song, written by the members themselves.
  'SONG KNOWLEDGE': ['Member', 'Song', 'Status'],
};

// Members see confirmed shows (and past ones, which Airtable marks Completed).
// Inquiries, holds and cancelled shows stay in Airtable.
export const TABLE_FILTERS = {
  SHOWS: "OR({Status} = 'Confirmed', {Status} = 'Completed')",
};
