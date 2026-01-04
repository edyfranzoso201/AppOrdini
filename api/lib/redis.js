import { Redis } from '@upstash/redis';

let redis;

export function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// Helper per le chiavi
export const KEYS = {
  ORDERS: 'orderflow:orders',
  INVENTORY: 'orderflow:inventory',
  USERS: 'orderflow:users',
  ACTIVITY_LOG: 'orderflow:activity_log',
  GLOBAL_ITEMS: 'orderflow:global_items',
  GLOBAL_KIT_TYPES: 'orderflow:global_kit_types',
  PREFIX: 'orderflow:prefix',
  COUNTER: 'orderflow:counter',
};
