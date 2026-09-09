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
    const noUsersYet = !existingUsers || existingUsers.length === 0;

    if (noUsersYet) {
      // Questo endpoint è pubblico per costruzione (serve a creare il primo
      // admin quando il database è vuoto, prima che esista qualunque
      // sessione con cui autenticarsi). Senza controllo, chiunque poteva
      // chiamarlo e ricreare un account admin/admin123 con password nota
      // (è nel sorgente, pubblico su GitHub) ogni volta che la chiave utenti
      // fosse vuota, anche non per un vero primo avvio. Richiede quindi un
      // secret separato (env INIT_SECRET), noto solo a chi amministra il
      // deploy, per poter effettivamente creare l'admin di bootstrap.
      const providedSecret = req.query.secret || req.headers['x-init-secret'];
      const initSecret = process.env.INIT_SECRET;

      if (!initSecret || providedSecret !== initSecret) {
        return res.status(403).json({
          success: false,
          error: 'Inizializzazione utenti non autorizzata: richiesto secret valido (INIT_SECRET)'
        });
      }

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
        // Non si espone più la password nella risposta: chi ha fornito il
        // secret sa già quali credenziali di default vengono create.
        admin: noUsersYet ? 'Creato account admin di bootstrap' : 'Già esistente'
      }
    });
  } catch (error) {
    console.error('Error in init API:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
