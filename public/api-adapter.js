// API Adapter - Sostituisce localStorage con chiamate API
const API_BASE = '/api';

// Cache locale per performance
let localCache = {
  orders: null,
  users: null,
  inventory: null,
  activityLog: null
};

// Sostituisci localStorage.getItem
const originalGetItem = localStorage.getItem.bind(localStorage);
localStorage.getItem = function(key) {
  // Se la chiave non è di OrderFlow, usa il localStorage normale
  if (!key.startsWith('orderFlow')) {
    return originalGetItem(key);
  }

  // Ritorna dalla cache se disponibile (sincrono)
  if (key === 'orderFlowOrders' && localCache.orders !== null) {
    return JSON.stringify(localCache.orders);
  }
  if (key === 'orderFlowUsers' && localCache.users !== null) {
    return JSON.stringify(localCache.users);
  }
  if (key === 'orderFlowInventory' && localCache.inventory !== null) {
    return JSON.stringify(localCache.inventory);
  }
  if (key === 'orderFlowActivityLog' && localCache.activityLog !== null) {
    return JSON.stringify(localCache.activityLog);
  }
  if (key === 'orderFlowCurrentUser') {
    return originalGetItem(key); // User corrente resta in localStorage
  }

  // Fallback a localStorage
  return originalGetItem(key);
};

// Sostituisci localStorage.setItem
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
  if (!key.startsWith('orderFlow')) {
    return originalSetItem(key, value);
  }

  // Salva nel localStorage originale
  originalSetItem(key, value);

  // Salva anche nella cache e nel backend
  const data = JSON.parse(value);
  
  if (key === 'orderFlowOrders') {
    localCache.orders = data;
    saveToAPI('orders', { orders: data });
  } else if (key === 'orderFlowUsers') {
    localCache.users = data;
    saveToAPI('users', { users: data });
  } else if (key === 'orderFlowInventory') {
    localCache.inventory = data;
    saveToAPI('inventory', { inventory: data });
  } else if (key === 'orderFlowActivityLog') {
    localCache.activityLog = data;
    saveToAPI('activity-log', { logs: data });
  }
};

// Funzione per salvare su API (asincrona)
async function saveToAPI(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      console.error(`Error saving to ${endpoint}:`, await response.text());
    }
  } catch (error) {
    console.error(`Error saving to ${endpoint}:`, error);
  }
}

// Funzione per caricare dati iniziali
async function loadInitialData() {
  try {
    console.log('📥 Caricamento dati dal server...');

    // Carica ordini
    const ordersRes = await fetch(`${API_BASE}/orders`);
    if (ordersRes.ok) {
      const ordersData = await ordersRes.json();
      localCache.orders = ordersData.data;
      originalSetItem('orderFlowOrders', JSON.stringify(ordersData.data));
    }

    // Carica utenti
    const usersRes = await fetch(`${API_BASE}/users`);
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      localCache.users = usersData.data;
      originalSetItem('orderFlowUsers', JSON.stringify(usersData.data));
    }

    // Carica inventario
    const inventoryRes = await fetch(`${API_BASE}/inventory`);
    if (inventoryRes.ok) {
      const inventoryData = await inventoryRes.json();
      localCache.inventory = inventoryData.data;
      originalSetItem('orderFlowInventory', JSON.stringify(inventoryData.data));
    }

    // Carica activity log
    const logsRes = await fetch(`${API_BASE}/activity-log`);
    if (logsRes.ok) {
      const logsData = await logsRes.json();
      localCache.activityLog = logsData.data;
      originalSetItem('orderFlowActivityLog', JSON.stringify(logsData.data));
    }

    console.log('✅ Dati caricati con successo');
    
    // Trigger evento per far sapere all'app che i dati sono pronti
    window.dispatchEvent(new Event('dataLoaded'));
  } catch (error) {
    console.error('❌ Errore caricamento dati:', error);
    alert('Errore caricamento dati dal server. Controlla la connessione.');
  }
}

// Carica i dati all'avvio
document.addEventListener('DOMContentLoaded', loadInitialData);
