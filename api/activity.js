import { getRedis } from './lib/redis.js';
const ACTIVITY_LOG_KEY = 'orderflow:activity_log';
const MAX_LOG_ENTRIES = 50;

export default async function handler(req, res) {
  // ✅ AGGIUNGI CORS HEADERS
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
      const logs = await redis.get(ACTIVITY_LOG_KEY) || [];
      
      return res.status(200).json({
        success: true,
        logs: logs  // ← CAMBIATO: da "data" a "logs"
      });
      
    } else if (req.method === 'POST') {
      const { action, type, message, user, orderId, details } = req.body;
      
      if (action === 'add') {
        let logs = await redis.get(ACTIVITY_LOG_KEY) || [];
        
        const newLog = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          type: type || 'INFO',
          message: message || '',
          user: user || 'System',
          orderId: orderId || null,
          details: details || null,
          date: new Date().toLocaleString('it-IT', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        };
        
        logs.unshift(newLog);
        
        if (logs.length > MAX_LOG_ENTRIES) {
          logs = logs.slice(0, MAX_LOG_ENTRIES);
        }
        
        await redis.set(ACTIVITY_LOG_KEY, logs);
        
        return res.status(200).json({
          success: true,
          message: 'Log entry added',
          log: newLog
        });
      }
      
      if (action === 'clear') {
        await redis.set(ACTIVITY_LOG_KEY, []);
        
        return res.status(200).json({
          success: true,
          message: 'Activity log cleared'
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
    console.error('Activity log API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
