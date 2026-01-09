export default async function handler(req, res) {
  const redis = getRedis();

  // Headers esistenti...
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // --- AGGIUNGI QUESTA RIGA ---
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  // ---------------------------
  
  // ... resto del codice
import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  const redis = getRedis();
  
  try {
    if (req.method === 'GET') {
      // Get all orders with metadata
      const data = await redis.get(KEYS.ORDERS);
      
      return res.status(200).json({
        success: true,
        data: data || { orders: [], lastOrderId: 0, currentPrefix: 'R68-', highlightedSizeCells: {} }
      });
      
    } else if (req.method === 'POST') {
      const { action, orders, lastOrderId, currentPrefix, highlightedSizeCells } = req.body;
      
      if (action === 'save') {
        // Save orders with metadata
        await redis.set(KEYS.ORDERS, {
          orders: orders || [],
          lastOrderId: lastOrderId || 0,
          currentPrefix: currentPrefix || 'R68-',
          highlightedSizeCells: highlightedSizeCells || {},
          updatedAt: new Date().toISOString()
        });
        
        return res.status(200).json({
          success: true,
          message: 'Orders saved successfully'
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
    console.error('Orders API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
