import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  // Configurazione per permettere al frontend di comunicare con l'API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = getRedis();

  try {
    if (req.method === 'GET') {
      // Recupera i dati dal database
      const data = await redis.get(KEYS.ACTIVITY_LOG);
      const logs = data ? (typeof data === 'string' ? JSON.parse(data) : data) : [];
      return res.status(200).json(logs);
    }

    if (req.method === 'POST') {
      // Salva nuovi dati nel database
      const newLog = req.body;
      const currentData = await redis.get(KEYS.ACTIVITY_LOG);
      let logs = currentData ? (typeof currentData === 'string' ? JSON.parse(currentData) : currentData) : [];
      logs.unshift(newLog);
      await redis.set(KEYS.ACTIVITY_LOG, JSON.stringify(logs.slice(0, 50)));
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}