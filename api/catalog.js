import { createClient } from 'redis';

const redis = createClient({
    url: process.env.REDIS_URL,
});

redis.on('error', (err) => {
    console.error('❌ Errore Redis:', err);
});

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    try {
        // Connetti solo se necessario
        if (!redis.isOpen) {
            await redis.connect();
        }

        if (req.method === 'POST') {
            const catalogData = req.body || {};
            await redis.set('public_catalog_data', JSON.stringify(catalogData));
            return res.status(200).json({ success: true });
        } else if (req.method === 'GET') {
            const dataStr = await redis.get('public_catalog_data');
            const data = dataStr ? JSON.parse(dataStr) : {
                title: 'Catalogo Abbigliamento',
                logo: '',
                qrCodeUrl: '',
                fullCatalogUrl: '',
                items: []
            };
            return res.status(200).json(data);
        } else {
            return res.status(405).json({ error: 'Metodo non consentito' });
        }
    } catch (error) {
        console.error('❌ Errore in /api/catalog:', error.message || error);
        return res.status(500).json({ error: 'Errore interno del server' });
    }
}