import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const redis = getRedis();

  try {
    switch (req.method) {
      case 'GET':
        // Ottieni tutti gli ordini
        const ordersData = await redis.get(KEYS.ORDERS);
        res.status(200).json({ success: true, data: ordersData || [] });
        break;

      case 'POST':
        // Salva ordini
        const { orders } = req.body;
        await redis.set(KEYS.ORDERS, JSON.stringify(orders));
        res.status(200).json({ success: true, message: 'Ordini salvati' });
        break;

      default:
        res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in orders API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
