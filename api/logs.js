import { createClient } from 'redis';

// Crea il client una volta, ma NON connetterti subito
const redis = createClient({
  url: process.env.REDIS_URL,
});

// Gestione errori Redis (opzionale ma utile)
redis.on('error', (err) => {
  console.error('❌ Errore connessione Redis:', err);
});

export default async function handler(req, res) {
  // Imposta sempre Content-Type JSON
  res.setHeader('Content-Type', 'application/json');

  try {
    // Connetti a Redis SOLO quando serve
    if (!redis.isOpen) {
      await redis.connect();
    }

    if (req.method === 'POST') {
      // Protezione: req.body potrebbe essere undefined
      const { user, action, details } = req.body || {};
      const newLog = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        user: user || 'Utente sconosciuto',
        action: action || 'Azione sconosciuta',
        details: details || ''
      };

      // Leggi i log esistenti da Redis
      let logs = [];
      const existingLogs = await redis.get('activity_logs');
      if (existingLogs) {
        try {
          logs = JSON.parse(existingLogs);
        } catch (parseError) {
          console.warn('⚠️ Impossibile parsare i log esistenti, parto da zero.');
          logs = [];
        }
      }

      // Aggiungi il nuovo log in cima
      logs.unshift(newLog);

      // Mantieni solo gli ultimi 50
      if (logs.length > 50) {
        logs = logs.slice(0, 50);
      }

      // Salva su Redis
      await redis.set('activity_logs', JSON.stringify(logs));

      return res.status(200).json({ success: true });
    } else {
      // GET: restituisce gli ultimi log
      const logsStr = await redis.get('activity_logs');
      const logs = logsStr ? JSON.parse(logsStr) : [];

      return res.status(200).json({ success: true, logs });
    }
  } catch (error) {
    // 🛡️ Gestione globale degli errori: sempre risposta JSON valida
    console.error('❌ Errore nell\'API /api/logs:', error.message || error);
    // Risposta sempre in JSON, mai HTML
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
}