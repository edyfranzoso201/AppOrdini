import { getRedis, KEYS } from './lib/redis.js';

const INVENTORY_KEY = 'orderflow:inventory';

export default async function handler(req, res) {
  const redis = getRedis();
  
  try {
    if (req.method === 'GET') {
      // Get inventory
      const inventory = await redis.get(INVENTORY_KEY);
      
      return res.status(200).json({
        success: true,
        data: { inventory: inventory || {} }
      });
      
    } else if (req.method === 'POST') {
      const { action, inventory } = req.body;
      
      if (action === 'save') {
        // Save inventory
        await redis.set(INVENTORY_KEY, inventory || {});
        
        return res.status(200).json({
          success: true,
          message: 'Inventory saved successfully'
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
    console.error('Inventory API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
