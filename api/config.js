import { createClient } from 'redis';

const redis = createClient({
    url: process.env.REDIS_URL,
});

await redis.connect();

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, globalItems, globalKitTypes } = req.body;
        
        if (action === 'save') {
            await redis.set('config', JSON.stringify({ globalItems, globalKitTypes }));
            return res.status(200).json({ success: true });
        }
    } else {
        // GET: restituisce l'oggetto dentro un oggetto con success: true
        const config = await redis.get('config');
        return res.status(200).json({ 
            success: true, 
            config: config ? JSON.parse(config) : {} 
        });
    }
}