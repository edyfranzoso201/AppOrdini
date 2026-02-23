import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  const redis = getRedis();
  
  try {
    if (req.method === 'GET') {
      const data = await redis.get(KEYS.INVENTORY);
      
      const inventoryKeys = data?.inventory ? Object.keys(data.inventory).length : 0;
      console.log(`📦 GET inventory - chiavi trovate: ${inventoryKeys}, updatedAt: ${data?.updatedAt || 'mai'}`);
      
      return res.status(200).json({
        success: true,
        data: data || { inventory: {} }
      });
      
    } else if (req.method === 'POST') {
      const { action, inventory } = req.body;
      
      if (action === 'save') {
        const inventoryKeys = inventory ? Object.keys(inventory).length : 0;
        console.log(`💾 POST inventory - salvataggio ${inventoryKeys} chiavi`);
        
        if (inventoryKeys === 0) {
          // ✅ NON sovrascrivere Redis con un inventario vuoto!
          // Questo previene la cancellazione accidentale del magazzino
          console.warn('⚠️ Tentativo di salvare inventario VUOTO ignorato');
          return res.status(200).json({
            success: true,
            message: 'Inventory empty - save skipped to prevent data loss'
          });
        }
        
        await redis.set(KEYS.INVENTORY, {
          inventory: inventory,
          updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Inventario salvato: ${inventoryKeys} chiavi`);
        
        return res.status(200).json({
          success: true,
          message: `Inventory saved successfully (${inventoryKeys} keys)`
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
    console.error('❌ Inventory API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
