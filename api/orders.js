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
            await redis.set('lastOrderId', lastOrderId.toString());
            await redis.set('currentPrefix', currentPrefix);
            await redis.set('highlightedSizeCells', JSON.stringify(highlightedSizeCells));
            return res.status(200).json({ success: true });
        }
    } else {
        // GET: restituisce l'array dentro un oggetto con success: true
        const ordersStr = await redis.get('orders');
        const lastOrderIdStr = await redis.get('lastOrderId');
        const currentPrefixStr = await redis.get('currentPrefix');
        const highlightedSizeCellsStr = await redis.get('highlightedSizeCells');

        const orders = ordersStr ? JSON.parse(ordersStr) : [];
        const lastOrderId = lastOrderIdStr ? parseInt(lastOrderIdStr) : 0;
        const currentPrefix = currentPrefixStr || 'R68-';
        const highlightedSizeCells = highlightedSizeCellsStr ? JSON.parse(highlightedSizeCellsStr) : {};

        return res.status(200).json({
            success: true,
             {
                orders,
                lastOrderId,
                currentPrefix,
                highlightedSizeCells
            }
        });
    }
}