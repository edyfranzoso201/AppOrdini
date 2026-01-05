import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const redis = getRedis();

  try {
    // Controlla se esistono già utenti
    const existingUsers = await redis.get(KEYS.USERS);
    
    if (!existingUsers || existingUsers.length === 0) {
      // Crea utente admin di default
      const defaultUsers = [{
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        name: 'Amministratore',
        createdAt: new Date().toISOString()
      }];
      
      await redis.set(KEYS.USERS, JSON.stringify(defaultUsers));
    }

    // Inizializza ordini vuoti se non esistono
    const existingOrders = await redis.get(KEYS.ORDERS);
    if (!existingOrders) {
      await redis.set(KEYS.ORDERS, JSON.stringify([]));
    }

    // Inizializza inventario vuoto se non esiste
    const existingInventory = await redis.get(KEYS.INVENTORY);
    if (!existingInventory) {
      await redis.set(KEYS.INVENTORY, JSON.stringify({}));
    }

    // Inizializza activity log vuoto se non esiste
    const existingLogs = await redis.get(KEYS.ACTIVITY_LOG);
    if (!existingLogs) {
      await redis.set(KEYS.ACTIVITY_LOG, JSON.stringify([]));
    }

    res.status(200).json({
      success: true,
      message: 'Database inizializzato con successo',
      info: {
        admin: existingUsers ? 'Già esistente' : 'Creato (username: admin, password: admin123)'
      }
    });
  } catch (error) {
    console.error('Error in init API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
