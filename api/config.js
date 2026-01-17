import { getRedis } from './lib/redis.js';

const CONFIG_KEY = 'orderflow:config';

export default async function handler(req, res) {
  const redis = getRedis();

  try {
    if (req.method === 'GET') {
      // Legge la config dal Redis
      const config = await redis.get(CONFIG_KEY);

      const data = config || {
        globalItems: [],
        globalKitTypes: {},
        quickIdFilters: {},
        catalog: {
          title: 'Catalogo Abbigliamento',
          logo: '',
          qrUrl: '',
          fullCatalogUrl: '',
          items: []
        }
      };

      // Se manca catalog nei dati vecchi, aggiungi default
      if (!data.catalog) {
        data.catalog = {
          title: 'Catalogo Abbigliamento',
          logo: '',
          qrUrl: '',
          fullCatalogUrl: '',
          items: []
        };
      }

      return res.status(200).json({
        success: true,
        data
      });

    } else if (req.method === 'POST') {
      const {
        action,
        globalItems,
        globalKitTypes,
        quickIdFilters,
        catalog
      } = req.body;

      if (action === 'save') {
        // Config completa da salvare
        const newConfig = {
          globalItems: globalItems || [],
          globalKitTypes: globalKitTypes || {},
          quickIdFilters: quickIdFilters || {},
          catalog: catalog || {
            title: 'Catalogo Abbigliamento',
            logo: '',
            qrUrl: '',
            fullCatalogUrl: '',
            items: []
          },
          updatedAt: new Date().toISOString()
        };

        await redis.set(CONFIG_KEY, newConfig);

        return res.status(200).json({
          success: true,
          message: 'Config saved successfully'
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Invalid action'
      });

    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('Config API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
