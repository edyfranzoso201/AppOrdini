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
            // Salva gli ordini
            const { action, orders, lastOrderId, currentPrefix, highlightedSizeCells } = req.body;
            
            if (action === 'save') {
                await redis.set('orderflow_orders', JSON.stringify({
                    orders: orders || [],
                    lastOrderId: lastOrderId || 0,
                    currentPrefix: currentPrefix || 'R68-',
                    highlightedSizeCells: highlightedSizeCells || {}
                }));
                return res.status(200).json({ success: true });
            }
        } else {
            // GET: restituisce gli ordini
            const ordersStr = await redis.get('orderflow_orders');
            const data = ordersStr ? JSON.parse(ordersStr) : {
                orders: [],
                lastOrderId: 0,
                currentPrefix: 'R68-',
                highlightedSizeCells: {}
            };
            return res.status(200).json({ success: true, data });
        }
    } catch (error) {
        console.error('❌ Errore in /api/orders:', error);
        return res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
}