// api/logs.js
import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const redis = getRedis();

  try {
    if (req.method === 'GET') {
      const data = await redis.get(KEYS.ACTIVITY_LOG);
      const logs = data
        ? (typeof data === 'string' ? JSON.parse(data) : data)
        : [];
      return res.status(200).json({ success: true, logs });
    }

    if (req.method === 'POST') {
      const newLog = req.body;
      const currentData = await redis.get(KEYS.ACTIVITY_LOG);
      let logs = currentData
        ? (typeof currentData === 'string' ? JSON.parse(currentData) : currentData)
        : [];
      logs.unshift(newLog);
      await redis.set(KEYS.ACTIVITY_LOG, JSON.stringify(logs.slice(0, 50)));
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ success: false, error: 'Metodo non consentito' });
  } catch (error) {
    console.error('❌ Errore /api/logs:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
