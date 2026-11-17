// Who is asking? Every API route that returns or changes data starts here.
//
// Each member and crew person has a random token in Airtable's "App Token"
// field. Their personal link is /m/<token>; the page sends the token back on
// every API call in the x-epl-token header. Changing or clearing a token in
// Airtable cuts that one link off.

import { fetchTable } from './airtable';

export const TOKEN_FIELD = 'App Token';

// Tokens are checked against this before they go near an Airtable formula,
// so a crafted value can't break out of the quotes below.
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function readToken(req) {
  const t = req.headers['x-epl-token'];
  return typeof t === 'string' && TOKEN_RE.test(t) ? t : null;
}

/**
 * Find the member or crew record a token belongs to.
 * Returns { type: 'member' | 'crew', id, name } or null.
 */
export async function findPersonByToken(token) {
  if (!token || !TOKEN_RE.test(token)) return null;
  const formula = `{${TOKEN_FIELD}} = '${token}'`;
  const [members, crew] = await Promise.all([
    fetchTable('MEMBERS', { fields: [TOKEN_FIELD, 'Member Name'], filterByFormula: formula }),
    fetchTable('CREW', { fields: [TOKEN_FIELD, 'Name'], filterByFormula: formula }),
  ]);
  // Compare exactly here too, rather than trusting the formula's matching.
  const m = members.filter(r => r.fields[TOKEN_FIELD] === token);
  const c = crew.filter(r => r.fields[TOKEN_FIELD] === token);

  // A token shared by two records is a data mistake; refuse rather than guess.
  if (m.length + c.length !== 1) return null;
  if (m.length) return { type: 'member', id: m[0].id, name: m[0].fields['Member Name'] || '' };
  return { type: 'crew', id: c[0].id, name: c[0].fields['Name'] || '' };
}

/**
 * Resolve the caller or send a 401. Returns the person, or null after
 * responding (the route should just return).
 */
export async function requirePerson(req, res) {
  const token = readToken(req);
  if (!token) {
    res.status(401).json({ error: 'missing-link' });
    return null;
  }
  try {
    const person = await findPersonByToken(token);
    if (!person) {
      res.status(401).json({ error: 'unknown-link' });
      return null;
    }
    return person;
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message || 'Server error' });
    return null;
  }
}
