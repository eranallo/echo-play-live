// Blackout dates: create, change or remove your own.
//
// The person comes from their personal-link token, never from the request
// body, and only Date / End Date / Reason can be written. PATCH and DELETE
// first check the record belongs to the caller.

import { airtableRaw, airtableRequest, methodGuard } from '../../lib/airtable';
import { requirePerson } from '../../lib/identity';

const TABLE = 'BLACKOUT DATES';
const REASONS = ['Personal', 'Other Gig', 'Vacation', 'Illness', 'Family', 'Other'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RECORD_RE = /^rec[A-Za-z0-9]{14}$/;

// Validate the editable fields. Returns { fields } or { error }.
function cleanFields(input) {
  const date = input?.Date;
  const end = input?.['End Date'];
  const reason = input?.Reason;

  if (typeof date !== 'string' || !DATE_RE.test(date)) return { error: 'A start date is required' };
  if (end != null && end !== '' && (typeof end !== 'string' || !DATE_RE.test(end))) {
    return { error: 'End date is not a date' };
  }
  if (end && end < date) return { error: 'End date is before the start date' };
  if (reason != null && !REASONS.includes(reason)) return { error: 'Unknown reason' };

  const fields = { Date: date };
  // An end date equal to the start (or empty) means a single day.
  fields['End Date'] = end && end !== date ? end : null;
  if (reason) fields.Reason = reason;
  return { fields };
}

const linkField = (person) => (person.type === 'member' ? 'Member' : 'Crew');

// Does this blackout record belong to the caller? { owned } or { status }.
async function checkOwner(person, recordId) {
  const { ok, status, data } = await airtableRaw(`${TABLE}/${recordId}`, { method: 'GET' });
  if (!ok) return { status: status === 404 ? 404 : status };
  const linked = data?.fields?.[linkField(person)];
  return { owned: Array.isArray(linked) && linked.includes(person.id) };
}

export default async function handler(req, res) {
  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return methodGuard(res, ['POST', 'PATCH', 'DELETE']);
  }

  const person = await requirePerson(req, res);
  if (!person) return;

  const body = req.body || {};
  const shape = (data) => ({ id: data.id, fields: data.fields });

  if (req.method === 'POST') {
    const { fields, error } = cleanFields(body);
    if (error) return res.status(400).json({ error });
    if (!fields['End Date']) delete fields['End Date'];
    fields[linkField(person)] = [person.id];
    return airtableRequest(res, TABLE, { method: 'POST', body: { fields } }, shape);
  }

  const { recordId } = body;
  if (typeof recordId !== 'string' || !RECORD_RE.test(recordId)) {
    return res.status(400).json({ error: 'recordId required' });
  }

  let owner;
  try {
    owner = await checkOwner(person, recordId);
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message || 'Server error' });
  }
  if (owner.status) return res.status(owner.status).json({ error: 'Could not find that date' });
  if (!owner.owned) return res.status(403).json({ error: 'That date belongs to someone else' });

  if (req.method === 'PATCH') {
    const { fields, error } = cleanFields(body.fields);
    if (error) return res.status(400).json({ error });
    return airtableRequest(res, `${TABLE}/${recordId}`, { method: 'PATCH', body: { fields } }, shape);
  }

  return airtableRequest(res, `${TABLE}/${recordId}`, { method: 'DELETE' },
    (data) => ({ deleted: true, id: data.id || recordId }));
}
