import { Redis } from '@upstash/redis';

export const KEYS = {
  ORDERS: 'orderflow:orders',
  USERS: 'orderflow:users',
  INVENTORY: 'orderflow:inventory',
  ACTIVITY_LOG: 'orderflow:activity_log',
  // Materiale di squadra (secondo modulo Google): richieste e catalogo dedicato
  TEAM_ORDERS: 'orderflow:team:orders'
};

export function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}