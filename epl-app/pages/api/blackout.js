// API route for blackout dates: POST (create), PATCH (update), DELETE (remove).
//
// Phase 03: now routed through the shared lib/airtable.js helper. Removes ~50
// lines of boilerplate and eliminates the env-var-naming drift that caused
// the Phase 01 bug.

import { airtableRequest, methodGuard } from '../../lib/airtable';

const TABLE = 'BLACKOUT DATES';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const fields = req.body || {};
    return airtableRequest(res, TABLE, {
      method: 'POST',
      body: { fields },
    }, (data) => ({ id: data.id, fields: data.fields }));
  }

  if (req.method === 'PATCH') {
    const { recordId, fields } = req.body || {};
    if (!recordId || !fields) {
      return res.status(400).json({ error: 'recordId and fields required' });
    }
    return airtableRequest(res, `${TABLE}/${recordId}`, {
      method: 'PATCH',
      body: { fields },
    }, (data) => ({ id: data.id, fields: data.fields }));
  }

  if (req.method === 'DELETE') {
    const { recordId } = req.body || {};
    if (!recordId) {
      return res.status(400).json({ error: 'recordId required' });
    }
    return airtableRequest(res, `${TABLE}/${recordId}`, {
      method: 'DELETE',
    }, (data) => ({ deleted: true, id: data.id || recordId }));
  }

  return methodGuard(res, ['POST', 'PATCH', 'DELETE']);
}
