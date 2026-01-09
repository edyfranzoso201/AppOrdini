import { createClient } from 'redis';

const redis = createClient({
    url: process.env.REDIS_URL,
});

redis.on('error', (err) => {
    console.error('❌ Errore connessione Redis:', err);
});

await redis.connect();

export default async function handler(req, res) {
    try {
        if (req.method === 'POST') {
            // Salva la configurazione
            const { action, globalItems, globalKitTypes } = req.body;
            
            if (action === 'save') {
                await redis.set('orderflow_config', JSON.stringify({
                    globalItems: globalItems || [],
                    globalKitTypes: globalKitTypes || {}
                }));
                return res.status(200).json({ success: true });
            }
        } else {
            // GET: restituisce la configurazione
            const configStr = await redis.get('orderflow_config');
            const data = configStr ? JSON.parse(configStr) : {
                globalItems: [],
                globalKitTypes: {}
            };
            return res.status(200).json({ success: true, data });
        }
    } catch (error) {
        console.error('❌ Errore in /api/config:', error);
        return res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
}