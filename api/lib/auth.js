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
