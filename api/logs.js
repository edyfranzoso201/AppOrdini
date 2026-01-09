import { createClient } from 'redis';

const redis = createClient({
    url: process.env.REDIS_URL,
});

await redis.connect();

export default async function handler(req, res) {
    if (req.method === 'POST') {
        // Aggiungi un nuovo log
        const { user, action, details } = req.body;
        
        const newLog = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            user: user || 'Utente sconosciuto',
            action: action || 'Azione sconosciuta',
            details: details || ''
        };

        // Leggi i log esistenti
        let logs = [];
        const existingLogs = await redis.get('activity_logs');
        if (existingLogs) {
            try {
                logs = JSON.parse(existingLogs);
            } catch (e) {
                console.error('Errore parsing logs:', e);
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
}