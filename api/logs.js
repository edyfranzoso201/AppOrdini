import { createClient } from 'redis';

const redis = createClient({
    url: process.env.REDIS_URL,
});

await redis.connect();

export default async function handler(req, res) {
    try {
        if (req.method === 'POST') {
            const { user, action, details } = req.body;
            
            const newLog = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                user: user || 'Utente sconosciuto',
                action: action || 'Azione sconosciuta',
                details: details || ''
            };

            let logs = [];
            const existingLogs = await redis.get('activity_logs');
            if (existingLogs) {
                try {
                    logs = JSON.parse(existingLogs);
                } catch (e) {
                    console.error('Errore parsing logs:', e);
                }
            }

            logs.unshift(newLog);

            if (logs.length > 50) {
                logs = logs.slice(0, 50);
            }

            await redis.set('activity_logs', JSON.stringify(logs));

            return res.status(200).json({ success: true });
        } else {
            const logsStr = await redis.get('activity_logs');
            const logs = logsStr ? JSON.parse(logsStr) : [];
            return res.status(200).json({ success: true, logs });
        }
    } catch (error) {
        console.error('Errore interno:', error);
        return res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
}