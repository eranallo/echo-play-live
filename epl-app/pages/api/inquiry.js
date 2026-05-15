// API route for public booking inquiry submissions.
// Phase 03: routes through the shared lib/airtable.js helper.

import { airtableRequest, methodGuard } from '../../lib/airtable';

const TABLE = 'INQUIRIES';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodGuard(res, ['POST']);
  }
  return airtableRequest(res, TABLE, {
    method: 'POST',
    body: { fields: req.body || {} },
  });
}
