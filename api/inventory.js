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
            // Salva l'inventario
            const { action, inventory } = req.body;
            
            if (action === 'save') {
                await redis.set('orderflow_inventory', JSON.stringify(inventory || {}));
                return res.status(200).json({ success: true });
            }
        } else {
            // GET: restituisce l'inventario
            const inventoryStr = await redis.get('orderflow_inventory');
            const data = inventoryStr ? JSON.parse(inventoryStr) : {};
            return res.status(200).json({ success: true, data });
        }
    } catch (error) {
        console.error('❌ Errore in /api/inventory:', error);
        return res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
}