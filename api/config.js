import { getRedis } from './lib/redis.js';

const CONFIG_KEY = 'orderflow:config';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const redis = getRedis();

  try {
    if (req.method === 'GET') {
      const config = await redis.get(CONFIG_KEY);
      const itemsCount = config?.catalog?.items?.length || 0;
      const kitsCount = Object.keys(config?.catalog?.kits || {}).length;
      console.log(`⚙️ GET /api/config - catalog items: ${itemsCount}, kits: ${kitsCount}, updatedAt: ${config?.updatedAt || 'mai'}`);

      const data = config || {
        globalItems: [],
        globalKitTypes: {},
        quickIdFilters: {},
        catalog: {
          title: 'Catalogo Abbigliamento',
          logo: '', qrUrl: '', fullCatalogUrl: '', orderNote: '',
          items: [],
          kits: {}
        }
      };

      if (!data.catalog) {
        data.catalog = { title: 'Catalogo Abbigliamento', logo: '', qrUrl: '', fullCatalogUrl: '', orderNote: '', items: [], kits: {} };
      }
      if (!data.catalog.kits) data.catalog.kits = {};

      return res.status(200).json({ success: true, data });

    } else if (req.method === 'POST') {
      const { action, globalItems, globalKitTypes, quickIdFilters, catalog } = req.body;

      if (action === 'save') {
        // ✅ PROTEZIONE: non sovrascrivere catalogo con dati vuoti
        // Legge prima il valore attuale
        const existing = await redis.get(CONFIG_KEY);
        const existingItems = existing?.catalog?.items?.length || 0;
        const incomingItems = catalog?.items?.length || 0;

        if (existingItems > 0 && incomingItems === 0) {
          console.warn(`⚠️ POST /api/config - BLOCCO: tentativo di salvare catalogo VUOTO (esistenti: ${existingItems})`);
          // Salva tutto MA preserva gli items del catalogo esistente
          const protectedCatalog = {
            ...(catalog || {}),
            items: existing.catalog.items,  // preserva items
            kits: catalog?.kits || existing?.catalog?.kits || {}
          };
          const newConfig = {
            globalItems: globalItems || existing?.globalItems || [],
            globalKitTypes: globalKitTypes || existing?.globalKitTypes || {},
            quickIdFilters: quickIdFilters || existing?.quickIdFilters || {},
            catalog: protectedCatalog,
            updatedAt: new Date().toISOString()
          };
          await redis.set(CONFIG_KEY, newConfig);
          console.log(`✅ Config salvata con protezione items (${existing.catalog.items.length} items preservati)`);
          return res.status(200).json({ success: true, message: 'Config saved (catalog items protected)' });
        }

        const newConfig = {
          globalItems: globalItems || [],
          globalKitTypes: globalKitTypes || {},
          quickIdFilters: quickIdFilters || {},
          catalog: catalog || {
            title: 'Catalogo Abbigliamento',
            logo: '', qrUrl: '', fullCatalogUrl: '', orderNote: '',
            items: [],
            kits: {}
          },
          updatedAt: new Date().toISOString()
        };

        await redis.set(CONFIG_KEY, newConfig);
        console.log(`✅ POST /api/config - salvato: items=${incomingItems}, kits=${Object.keys(catalog?.kits||{}).length}`);

        return res.status(200).json({ success: true, message: 'Config saved successfully' });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });

    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ Config API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
