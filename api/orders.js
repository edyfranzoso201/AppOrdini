import { getRedis, KEYS } from './lib/redis.js';
import { requireAuth } from './lib/auth.js';

// ─────────────────────────────────────────────────────────────────────────────
// Permessi di scrittura sugli ordini, per ruolo.
//
// Il sistema di permessi (USER_ROLES in public/app.js) vive solo lato client:
// disabilita input e nasconde tab, ma ogni ruolo passa comunque per lo stesso
// POST /api/orders con action 'save', che riscrive l'INTERO blob ordini. Un
// utente in sola lettura poteva quindi, con una fetch diretta che ignora la UI,
// cancellare tutti gli ordini o modificare qualunque campo.
//
// Qui si replica lato server la stessa matrice di permessi: per i ruoli non
// admin il blob inviato dal client non viene mai considerato affidabile. Si
// rilegge lo stato attuale da Redis e si applicano solo i campi che quel ruolo
// può realmente toccare, scartando in silenzio tutto il resto (le operazioni
// legittime restano identiche, i tentativi di manomissione non hanno effetto).
//
// canCreate/canDelete: se false, il numero e l'identità degli ordini non
// possono cambiare. allowedFields: elenco dei campi modificabili sugli ordini
// esistenti. canHighlight: può aggiornare la mappa globale highlightedSizeCells.
const ROLE_WRITE_RULES = {
  // Sola lettura: nessuna modifica agli ordini.
  viewer:               { canCreate: false, canDelete: false, allowedFields: [], canHighlight: false },
  viewer_full:          { canCreate: false, canDelete: false, allowedFields: [], canHighlight: false },
  contributor:          { canCreate: false, canDelete: false, allowedFields: [], canHighlight: false },

  // Contributore Avanzato: può modificare SOLO la colonna Stato.
  contributor_advanced: { canCreate: false, canDelete: false, allowedFields: ['status', 'statusUpdatedAt'], canHighlight: false },

  // Gestione Stato: può modificare SOLO la colonna Pagamento.
  status_manager:       { canCreate: false, canDelete: false, allowedFields: ['paymentMark'], canHighlight: false },

  // Ruoli Tabella Ordini: modificano le celle (taglie/quantità degli articoli)
  // e le evidenziazioni, ma non possono creare o eliminare ordini né toccare
  // stato, pagamento o dati anagrafici del cliente.
  table_editor:         { canCreate: false, canDelete: false, allowedFields: ['itemsList', 'mainSize', 'sockSize'], canHighlight: true },
  tabella_full:         { canCreate: false, canDelete: false, allowedFields: ['itemsList', 'mainSize', 'sockSize'], canHighlight: true },
  tabella_readonly:     { canCreate: false, canDelete: false, allowedFields: ['itemsList', 'mainSize', 'sockSize'], canHighlight: true }
};

// Fonde il blob inviato dal client con quello salvato, applicando le regole del
// ruolo. Ritorna gli ordini risultanti e il numero di modifiche scartate.
function applyRoleWriteRules(currentOrders, incomingOrders, rules) {
  const incomingById = new Map();
  for (const o of incomingOrders) {
    if (o && o.id !== undefined && o.id !== null) incomingById.set(String(o.id), o);
  }

  let rejected = 0;

  // Si parte SEMPRE dagli ordini salvati: un ordine assente dal blob inviato
  // non viene eliminato, a meno che il ruolo non abbia il permesso di farlo.
  const result = currentOrders.map((saved) => {
    const incoming = incomingById.get(String(saved.id));
    if (!incoming) return saved;

    const merged = { ...saved };
    for (const field of rules.allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(incoming, field)) continue;
      if (JSON.stringify(incoming[field]) !== JSON.stringify(saved[field])) {
        merged[field] = incoming[field];
      }
    }

    // Conta come scartata ogni differenza su campi non consentiti.
    for (const field of Object.keys(incoming)) {
      if (rules.allowedFields.includes(field)) continue;
      if (JSON.stringify(incoming[field]) !== JSON.stringify(saved[field])) rejected++;
    }

    return merged;
  });

  if (rules.canDelete) {
    // (nessun ruolo non-admin ha oggi questo permesso, ma la regola resta esplicita)
    const keep = new Set(incomingById.keys());
    return { orders: result.filter(o => keep.has(String(o.id))), rejected };
  }

  const savedIds = new Set(currentOrders.map(o => String(o.id)));
  const newOnes = incomingOrders.filter(o => o && !savedIds.has(String(o.id)));
  if (newOnes.length > 0) {
    if (rules.canCreate) return { orders: [...result, ...newOnes], rejected };
    rejected += newOnes.length;
  }

  return { orders: result, rejected };
}

export default async function handler(req, res) {
  // ✅ CORS headers - necessari per tutte le API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const session = await requireAuth(req, res);
  if (!session) return;

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
        const role = (session.role || '').toLowerCase();

        // L'admin resta l'unico che può riscrivere l'intero blob così com'è.
        if (role === 'admin') {
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

        // Ruolo sconosciuto/non mappato: fail-closed, nessuna scrittura.
        const rules = ROLE_WRITE_RULES[role];
        if (!rules) {
          return res.status(403).json({
            success: false,
            error: 'Il tuo ruolo non è abilitato a modificare gli ordini'
          });
        }

        const current = await redis.get(KEYS.ORDERS) || {};
        const currentOrders = current.orders || [];

        const { orders: mergedOrders, rejected } = applyRoleWriteRules(
          currentOrders,
          Array.isArray(orders) ? orders : [],
          rules
        );

        // I metadati globali (lastOrderId, prefisso) li cambia solo chi può
        // creare ordini: per gli altri si conservano quelli salvati.
        const dataToSave = {
          ...current,
          orders: mergedOrders,
          lastOrderId: rules.canCreate ? (lastOrderId || 0) : (current.lastOrderId || 0),
          currentPrefix: rules.canCreate
            ? (currentPrefix || `${new Date().getFullYear()}_`)
            : (current.currentPrefix || `${new Date().getFullYear()}_`),
          highlightedSizeCells: rules.canHighlight
            ? (highlightedSizeCells || {})
            : (current.highlightedSizeCells || {}),
          updatedAt: new Date().toISOString()
        };

        await redis.set(KEYS.ORDERS, dataToSave);

        if (rejected > 0) {
          console.warn(`⚠️ POST /api/orders - ruolo "${role}" (${session.username}): ${rejected} modifiche non consentite scartate`);
        }
        console.log(`✅ POST /api/orders - ruolo "${role}": salvati ${mergedOrders.length} ordini`);

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
