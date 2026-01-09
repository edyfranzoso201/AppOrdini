import { createClient } from 'redis';

const redis = createClient({
    url: process.env.REDIS_URL,
});

await redis.connect();

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, inventory } = req.body;
        
        if (action === 'save') {
            await redis.set('inventory', JSON.stringify(inventory));
            return res.status(200).json({ success: true });
        }
    } else {
        // GET: restituisce l'oggetto dentro un oggetto con success: true
        const inventoryStr = await redis.get('inventory');
        const inventory = inventoryStr ? JSON.parse(inventoryStr) : {};

        return res.status(200).json({
            success: true,
             {
                inventory
            }
        });
    }
}