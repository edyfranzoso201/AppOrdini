import { randomUUID } from 'crypto';
import { getRedis } from './redis.js';

const SESSION_PREFIX = 'orderflow:session:';
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 ore, scorrevole

function sessionKey(token) {
  return `${SESSION_PREFIX}${token}`;
}

export async function createSession(user) {
  const redis = getRedis();
  const token = randomUUID();
  const session = {
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: new Date().toISOString()
  };
  await redis.set(sessionKey(token), session, { ex: SESSION_TTL_SECONDS });
  return { token, session };
}

// Verifica il token e rinnova il TTL (sliding expiration). Ritorna null se assente/scaduto.
export async function verifySession(token) {
  if (!token) return null;
  const redis = getRedis();
  const session = await redis.get(sessionKey(token));
  if (!session) return null;
  try {
    await redis.expire(sessionKey(token), SESSION_TTL_SECONDS);
  } catch (e) {
    // rinnovo TTL non bloccante
  }
  return session;
}

export async function revokeSession(token) {
  if (!token) return;
  const redis = getRedis();
  await redis.del(sessionKey(token));
}

function extractToken(req) {
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// Verifica l'header Authorization e allega req.session; risponde 401 e ritorna null se non valido.
export async function requireAuth(req, res) {
  const token = extractToken(req);
  const session = await verifySession(token);
  if (!session) {
    res.status(401).json({ success: false, error: 'Sessione non valida o scaduta, effettua di nuovo il login' });
    return null;
  }
  req.session = session;
  return session;
}

// Come requireAuth, ma richiede in aggiunta che il ruolo della sessione sia
// tra quelli consentiti. Risponde 401 se non autenticato, 403 se il ruolo
// non è autorizzato. Da usare per azioni server-side sensibili (creazione
// utenti, cancellazioni definitive, ecc.) dove il controllo lato client
// (UI disabilitata) non basta, perché un client malevolo può chiamare
// l'API direttamente ignorando l'interfaccia.
export async function requireRole(req, res, allowedRoles) {
  const session = await requireAuth(req, res);
  if (!session) return null;

  const role = (session.role || '').toLowerCase();
  const allowed = allowedRoles.map(r => r.toLowerCase());
  if (!allowed.includes(role)) {
    res.status(403).json({ success: false, error: 'Non hai i permessi per eseguire questa azione' });
    return null;
  }
  return session;
}
