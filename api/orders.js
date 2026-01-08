import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  const redis = getRedis();

  // Header per evitare blocchi CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // LETTURA ORDINI
    if (req.method === 'GET') {
      const orders = await redis.get(KEYS.ORDERS) || [];
      return res.status(200).json(orders);
    }

    // SALVATAGGIO ORDINI
    if (req.method === 'POST') {
      const orders = req.body;
      
      // Validazione base
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: 'Il body deve essere un array di ordini' });
      }

      await redis.set(KEYS.ORDERS, orders);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Metodo non consentito' });

  } catch (error) {
    console.error('Errore API Orders:', error);
    return res.status(500).json({ error: error.message });
  }
}