import { getRedis } from './lib/redis.js';

const ACTIVITY_LOG_KEY = 'orderflow:activity_log';
const MAX_LOG_ENTRIES = 50;

export default async function handler(req, res) {
  const redis = getRedis();
  
  try {
    if (req.method === 'GET') {
      // Get activity log
      const logs = await redis.get(ACTIVITY_LOG_KEY) || [];
      
      return res.status(200).json({
        success: true,
        data: logs
      });
      
    } else if (req.method === 'POST') {
      const { action, type, message, user, orderId, details } = req.body;
      
      if (action === 'add') {
        // Get current logs
        let logs = await redis.get(ACTIVITY_LOG_KEY) || [];
        
        // Create new log entry
        const newLog = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          type: type || 'INFO', // INFO, CREATE, UPDATE, DELETE, STATUS_CHANGE, LOGIN, LOGOUT
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
        
        // Add to beginning of array
        logs.unshift(newLog);
        
        // Keep only last 50 entries
        if (logs.length > MAX_LOG_ENTRIES) {
          logs = logs.slice(0, MAX_LOG_ENTRIES);
        }
        
        // Save back to Redis
        await redis.set(ACTIVITY_LOG_KEY, logs);
        
        return res.status(200).json({
          success: true,
          message: 'Log entry added',
          log: newLog
        });
      }
      
      if (action === 'clear') {
        // Clear all logs
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
