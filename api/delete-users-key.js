import { getRedis } from './lib/redis.js';

const USERS_KEY = 'orderflow:users';

// Aggiungi header CORS
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }

  const redis = getRedis();
  setCorsHeaders(res);
  
  try {
    if (req.method === 'DELETE' || req.method === 'GET') {
      // CANCELLA COMPLETAMENTE la chiave dal Redis
      await redis.del(USERS_KEY);
      
      return res.status(200).json({
        success: true,
        message: '🗑️ Chiave utenti CANCELLATA dal database Redis. Al prossimo accesso verrà ricreata vuota.',
        action: 'deleted',
        key: USERS_KEY
      });
    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Use GET or DELETE.'
      });
    }
    
  } catch (error) {
    console.error('Delete users key error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
