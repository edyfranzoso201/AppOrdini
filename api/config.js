import { getRedis, KEYS } from './lib/redis.js';

const CONFIG_KEY = 'orderflow:config';

export default async function handler(req, res) {
  const redis = getRedis();
  
  try {
    if (req.method === 'GET') {
      // Get config
      const config = await redis.get(CONFIG_KEY);
      
      return res.status(200).json({
        success: true,
        data: config || { globalItems: [], globalKitTypes: {}, quickIdFilters: {} }
      });
      
    } else if (req.method === 'POST') {
      const { action, globalItems, globalKitTypes, quickIdFilters } = req.body;
      
      if (action === 'save') {
        // Save config (include quickIdFilters)
        await redis.set(CONFIG_KEY, {
          globalItems,
          globalKitTypes,
          quickIdFilters: quickIdFilters || {},
          updatedAt: new Date().toISOString()
        });
        
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
