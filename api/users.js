import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
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
        // Ottieni tutti gli utenti
        const usersData = await redis.get(KEYS.USERS);
        res.status(200).json({ success: true, data: usersData || [] });
        break;

      case 'POST':
        if (req.body.action === 'login') {
          // Login
          const { username, password } = req.body;
          const users = await redis.get(KEYS.USERS) || [];
          const user = users.find(u => u.username === username && u.password === password);
          
          if (user) {
            res.status(200).json({ success: true, user });
          } else {
            res.status(401).json({ success: false, error: 'Credenziali non valide' });
          }
        } else {
          // Salva utenti
          const { users } = req.body;
          await redis.set(KEYS.USERS, JSON.stringify(users));
          res.status(200).json({ success: true, message: 'Utenti salvati' });
        }
        break;

      default:
        res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in users API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
