import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  // ✅ CORS headers - necessari per tutte le API
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
      const data = await redis.get(KEYS.ORDERS);
      console.log('📦 GET /api/orders - Dati trovati:', data ? 'SI' : 'NO');
      
      return res.status(200).json({
        success: true,
        data: data || { orders: [], lastOrderId: 0, currentPrefix: `${new Date().getFullYear()}_`, highlightedSizeCells: {} }
      });
      
    } else if (req.method === 'POST') {
      const { action, orders, lastOrderId, currentPrefix, highlightedSizeCells } = req.body;
      
      if (action === 'save') {
        const dataToSave = {
          orders: orders || [],
          lastOrderId: lastOrderId || 0,
          currentPrefix: currentPrefix || `${new Date().getFullYear()}_`,
          highlightedSizeCells: highlightedSizeCells || {},
          updatedAt: new Date().toISOString()
        };
        
        await redis.set(KEYS.ORDERS, dataToSave);
        console.log(`✅ POST /api/orders - Salvati ${orders?.length || 0} ordini, prefix: ${currentPrefix}`);
        
        return res.status(200).json({
          success: true,
          message: 'Orders saved successfully'
        });
      }
      
      return res.status(400).json({ success: false, error: 'Invalid action' });
      
    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('❌ Orders API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
