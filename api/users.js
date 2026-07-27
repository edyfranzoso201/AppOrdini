import bcrypt from 'bcryptjs';
import { getRedis, KEYS } from './lib/redis.js';
import { createSession, verifySession, revokeSession, requireAuth } from './lib/auth.js';

const USERS_KEY = 'orderflow:users';
const BCRYPT_ROUNDS = 10;

// Riconosce un hash bcrypt (es. $2a$10$...) per distinguerlo da una password legacy in chiaro
function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

export default async function handler(req, res) {
  const redis = getRedis();

  try {
    if (req.method === 'GET') {
      if (!(await requireAuth(req, res))) return;

      // Get all users (senza passwords per sicurezza)
      const users = await redis.get(USERS_KEY) || [];
      const safeUsers = users.map(u => ({
        username: u.username,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt
      }));

      return res.status(200).json({
        success: true,
        users: safeUsers
      });

    } else if (req.method === 'POST') {
      const { action, username, password, name, role, newPassword } = req.body;

      // Azioni raggiungibili senza sessione attiva
      if (action === 'login') {
        // Login user
        const users = await redis.get(USERS_KEY) || [];
        const userIndex = users.findIndex(u => u.username === username);
        const user = userIndex !== -1 ? users[userIndex] : null;

        let valid = false;
        if (user) {
          if (isBcryptHash(user.password)) {
            valid = await bcrypt.compare(password, user.password);
          } else {
            // Password legacy in chiaro: verifica diretta, poi migra all'hash
            valid = user.password === password;
            if (valid) {
              users[userIndex].password = await bcrypt.hash(password, BCRYPT_ROUNDS);
              await redis.set(USERS_KEY, users);
            }
          }
        }

        if (valid) {
          const { token } = await createSession(user);
          return res.status(200).json({
            success: true,
            token,
            user: {
              username: user.username,
              name: user.name,
              role: user.role
            }
          });
        } else {
          return res.status(401).json({
            success: false,
            error: 'Credenziali non valide'
          });
        }

      } else if (action === 'verify') {
        const authHeader = req.headers['authorization'] || '';
        const token = (authHeader.match(/^Bearer\s+(.+)$/i) || [])[1];
        const session = await verifySession(token);
        if (!session) {
          return res.status(401).json({ success: false, error: 'Sessione non valida o scaduta' });
        }
        return res.status(200).json({ success: true, user: session });

      } else if (action === 'logout') {
        const authHeader = req.headers['authorization'] || '';
        const token = (authHeader.match(/^Bearer\s+(.+)$/i) || [])[1];
        await revokeSession(token);
        return res.status(200).json({ success: true });

      }

      // Da qui in poi serve una sessione valida
      if (!(await requireAuth(req, res))) return;

      if (action === 'create') {
        // Create new user
        const users = await redis.get(USERS_KEY) || [];
        
        // Check if username already exists
        if (users.find(u => u.username === username)) {
          return res.status(400).json({
            success: false,
            error: 'Username già esistente'
          });
        }
        
        users.push({
          username,
          password: await bcrypt.hash(password, BCRYPT_ROUNDS),
          name,
          role,
          createdAt: new Date().toISOString()
        });
        
        await redis.set(USERS_KEY, users);
        
        return res.status(200).json({
          success: true,
          message: 'Utente creato con successo'
        });
        
      } else if (action === 'update') {
        // Update user password
        const users = await redis.get(USERS_KEY) || [];
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex === -1) {
          return res.status(404).json({
            success: false,
            error: 'Utente non trovato'
          });
        }
        
        users[userIndex].password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        users[userIndex].updatedAt = new Date().toISOString();
        
        await redis.set(USERS_KEY, users);
        
        return res.status(200).json({
          success: true,
          message: 'Password aggiornata con successo'
        });
        
      } else if (action === 'edit') {
        // Edit user (name and role)
        const users = await redis.get(USERS_KEY) || [];
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex === -1) {
          return res.status(404).json({
            success: false,
            error: 'Utente non trovato'
          });
        }
        
        if (name) users[userIndex].name = name;
        if (role) users[userIndex].role = role;
        users[userIndex].updatedAt = new Date().toISOString();
        
        await redis.set(USERS_KEY, users);
        
        return res.status(200).json({
          success: true,
          message: 'Utente modificato con successo'
        });
        
      } else if (action === 'delete') {
        // Delete user
        const users = await redis.get(USERS_KEY) || [];
        const filteredUsers = users.filter(u => u.username !== username);
        
        await redis.set(USERS_KEY, filteredUsers);
        
        return res.status(200).json({
          success: true,
          message: 'Utente eliminato con successo'
        });
        
      } else if (action === 'list') {
        // List all users (without passwords)
        const users = await redis.get(USERS_KEY) || [];
        const safeUsers = users.map(u => ({
          username: u.username,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt
        }));
        
        return res.status(200).json({
          success: true,
          users: safeUsers
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
    console.error('Users API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
