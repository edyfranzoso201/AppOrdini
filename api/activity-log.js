import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const redis = getRedis();

  try {
    switch (req.method) {
      case 'GET':
        const logs = await redis.get(KEYS.ACTIVITY_LOG);
        res.status(200).json({ success: true, data: logs || [] });
        break;

      case 'POST':
        const { logs: newLogs } = req.body;
        await redis.set(KEYS.ACTIVITY_LOG, JSON.stringify(newLogs));
        res.status(200).json({ success: true, message: 'Log salvati' });
        break;

      case 'DELETE':
        await redis.set(KEYS.ACTIVITY_LOG, JSON.stringify([]));
        res.status(200).json({ success: true, message: 'Log cancellati' });
        break;

      default:
        res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in activity-log API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
