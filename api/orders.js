import { createClient } from 'redis';

const redis = createClient({
    url: process.env.REDIS_URL,
});

await redis.connect();

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { action, orders, lastOrderId, currentPrefix, highlightedSizeCells } = req.body;
        
        if (action === 'save') {
            await redis.set('orders', JSON.stringify(orders));
            await redis.set('lastOrderId', lastOrderId);
            await redis.set('currentPrefix', currentPrefix);
            await redis.set('highlightedSizeCells', JSON.stringify(highlightedSizeCells));
            return res.status(200).json({ success: true });
        }
    } else {
        // GET: restituisce l'array dentro un oggetto con success: true
        const orders = await redis.get('orders');
        return res.status(200).json({ 
            success: true, 
            orders: orders ? JSON.parse(orders) : [] 
        });
    }
}