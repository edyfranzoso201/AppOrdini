import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const redis = getRedis();

  try {
    switch (req.method) {
      case 'GET':
        const inventory = await redis.get(KEYS.INVENTORY);
        res.status(200).json({ success: true, data: inventory || {} });
        break;

      case 'POST':
        const { inventory: newInventory } = req.body;
        await redis.set(KEYS.INVENTORY, JSON.stringify(newInventory));
        res.status(200).json({ success: true, message: 'Inventario salvato' });
        break;

      default:
        res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in inventory API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
