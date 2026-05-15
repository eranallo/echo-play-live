// API route for setlist saves — POST creates or updates a SETLISTS record.
// Phase 03: routes through the shared lib/airtable.js helper.

import { airtableRequest, methodGuard } from '../../lib/airtable';

const TABLE = 'SETLISTS';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodGuard(res, ['POST']);
  }

  const { recordId, setName, bandId, showId, songIds, builderData, setLength } = req.body || {};

  const fields = {};
  if (setName)              fields['Set Name'] = setName;
  if (bandId)               fields['Band'] = [bandId];
  if (showId)               fields['Show'] = [showId];
  if (songIds)              fields['Songs'] = songIds;
  if (setLength !== undefined) fields['Set Length'] = setLength;
  if (builderData)          fields['Notes'] = '%%BUILDER%%' + JSON.stringify(builderData);
  //                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  // Phase 02 audit M5: this %%BUILDER%% sentinel + JSON-in-Notes pattern is
  // fragile. Move to a dedicated `Builder Data` longText field on SETLISTS in
  // a future phase. Behavior unchanged here.

  const path = recordId ? `${TABLE}/${recordId}` : TABLE;
  const method = recordId ? 'PATCH' : 'POST';

  return airtableRequest(res, path, { method, body: { fields } },
    (data) => ({ success: true, id: data.id }));
}
