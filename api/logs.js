// /pages/api/logs.js o /app/api/logs/route.js (se App Router, la firma cambia)
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL,
});

redis.on('error', (err) => {
  console.error('❌ Errore connessione Redis:', err);
});

let redisReady = false;

async function getRedis() {
  if (!redisReady) {
    await redis.connect();
    redisReady = true;
  }
  return redis;
}

export default async function handler(req, res) {
  try {
    const redisClient = await getRedis();

    if (req.method === 'POST') {
      const { user, action, details } = req.body || {};

      const newLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        user: user || 'Utente sconosciuto',
        action: action || 'Azione sconosciuta',
        details: details || '',
      };

      // Leggi i log esistenti
      let logs = [];
      const existingLogs = await redisClient.get('activity_logs');

      if (existingLogs) {
        try {
          logs = JSON.parse(existingLogs);
        } catch (parseError) {
          console.warn('⚠️ Impossibile parsare i log esistenti, parto da zero.');
          logs = [];
        }
      }

      // Aggiungi il nuovo log in cima
      logs.unshift(newLog);

      // Mantieni solo gli ultimi 50
      if (logs.length > 50) {
        logs = logs.slice(0, 50);
      }

      // Salva su Redis
      await redisClient.set('activity_logs', JSON.stringify(logs));

      return res.status(200).json({ success: true });
    }

    // Metodo GET: restituisce i log
    if (req.method === 'GET') {
      const logsStr = await redisClient.get('activity_logs');
      const logs = logsStr ? JSON.parse(logsStr) : [];
      return res.status(200).json({ success: true, logs });
    }

    // Metodi non supportati
    return res.status(405).json({ success: false, error: 'Metodo non consentito' });
  } catch (error) {
    console.error('❌ Errore nell\'API /api/logs:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server',
    });
  }
}
