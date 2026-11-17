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
    'Show Notes', 'Sound Notes', 'Merch Notes', 'SETLISTS',
  ],
  BANDS: ['Band Name', 'Logo/Photo', 'Active'],
  MEMBERS: ['Member Name', 'Primary Bands', 'Instruments', 'Profile Photo', 'Phone', 'Active'],
  CREW: ['Name', 'Role', 'Photo', 'Phone', 'Active'],
  VENUES: ['Venue Name', 'Address', 'City', 'State', 'Parking Notes', 'Photo'],
  'BLACKOUT DATES': ['Member', 'Crew', 'Date', 'End Date', 'Reason'],
  SETLISTS: ['Set Name', 'Songs', 'Band', 'Show', 'Duration', 'Notes'],
  SONGS: ['Song Title', 'Artist', 'Duration', 'Guitar Tuning', 'Bass Tuning', 'Key', 'BPM'],
};

// Members see confirmed shows (and past ones, which Airtable marks Completed).
// Inquiries, holds and cancelled shows stay in Airtable.
export const TABLE_FILTERS = {
  SHOWS: "OR({Status} = 'Confirmed', {Status} = 'Completed')",
};
