import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  const redis = getRedis();

  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      // Recupera tutto l'oggetto dati
      const rawData = await redis.get(KEYS.ORDERS);
      
      // Struttura di default se il DB è vuoto
      const data = rawData || {
        orders: [],
        lastOrderId: 0,
        currentPrefix: 'R68-',
        highlightedSizeCells: {}
      };

      // Risponde nel formato esatto che loadData si aspetta
      return res.status(200).json({
        success: true,
        data: data
      });
    }

    if (req.method === 'POST') {
      // Salva tutto quello che arriva dal frontend
      const dataToSave = req.body; 
      await redis.set(KEYS.ORDERS, dataToSave);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
}