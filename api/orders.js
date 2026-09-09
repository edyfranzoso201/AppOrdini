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

// ─────────────────────────────────────────────────────────────────────────────
// Merge a tre vie per i salvataggi admin concorrenti.
//
// Il blob ordini viene riscritto INTERO a ogni salvataggio. Con due admin che
// lavorano insieme (caso normale: uno in Gestione, uno in Tabella) l'ultimo che
// salva sovrascriveva silenziosamente il lavoro dell'altro: il controllo
// conflitti lato client confronta un hash che include solo status e note, quindi
// una taglia o un pagamento modificati da un collega non venivano nemmeno
// rilevati come conflitto.
//
// Qui si confrontano TRE versioni di ogni ordine:
//   base     = lo stato che il client aveva quando ha caricato i dati (baseVersion)
//   current  = lo stato attuale su Redis (può contenere modifiche altrui)
//   incoming = quello che il client sta inviando ora
//
// Per ogni campo si applica la modifica del client solo se l'ha davvero
// cambiato rispetto alla sua base; altrimenti si conserva il valore corrente su
// Redis. Così due modifiche a campi DIVERSI dello stesso ordine sopravvivono
// entrambe. Solo quando due utenti toccano lo STESSO campo vince chi salva per
// ultimo, e il caso viene tracciato nei log.
function mergeOrdersThreeWay(baseOrders, currentOrders, incomingOrders) {
  const baseById = new Map();
  for (const o of baseOrders) {
    if (o && o.id !== undefined && o.id !== null) baseById.set(String(o.id), o);
  }
  const currentById = new Map();
  for (const o of currentOrders) {
    if (o && o.id !== undefined && o.id !== null) currentById.set(String(o.id), o);
  }
  const incomingById = new Map();
  for (const o of incomingOrders) {
    if (o && o.id !== undefined && o.id !== null) incomingById.set(String(o.id), o);
  }

  const stats = { merged: 0, conflicts: 0, preservedOrders: 0, deleted: 0 };
  const result = [];
  const handled = new Set();

  // 1. Si parte dagli ordini presenti ORA su Redis: sono la verità più recente.
  for (const current of currentOrders) {
    const id = String(current.id);
    handled.add(id);

    const incoming = incomingById.get(id);
    if (!incoming) {
      // Assente dal payload del client. Se c'era nella sua base, l'ha eliminato
      // deliberatamente; se non c'era, è un ordine creato da altri nel frattempo
      // e va conservato.
      if (baseById.has(id)) {
        stats.deleted++;
        continue;
      }
      stats.preservedOrders++;
      result.push(current);
      continue;
    }

    const base = baseById.get(id);
    if (!base) {
      // Il client non aveva questo ordine nella sua base: non può sapere cosa
      // sta sovrascrivendo, quindi si tiene la versione su Redis.
      stats.preservedOrders++;
      result.push(current);
      continue;
    }

    const merged = { ...current };
    let touched = false;
    const fields = new Set([...Object.keys(base), ...Object.keys(current), ...Object.keys(incoming)]);

    for (const field of fields) {
      const baseVal = JSON.stringify(base[field]);
      const currVal = JSON.stringify(current[field]);
      const inVal = JSON.stringify(incoming[field]);

      if (inVal === baseVal) continue;        // il client non ha toccato il campo
      if (currVal === baseVal) {              // nessuno l'ha toccato nel frattempo
        merged[field] = incoming[field];
        touched = true;
        continue;
      }
      if (inVal === currVal) continue;        // stessa modifica, nulla da fare

      // Entrambi hanno cambiato lo stesso campo in modo diverso: vince chi
      // salva per ultimo, ma il caso viene registrato.
      merged[field] = incoming[field];
      stats.conflicts++;
      touched = true;
    }

    if (touched) stats.merged++;
    result.push(merged);
  }

  // 2. Ordini presenti nel payload ma non su Redis: sono nuovi, si aggiungono.
  for (const incoming of incomingOrders) {
    const id = String(incoming.id);
    if (handled.has(id)) continue;
    result.push(incoming);
  }

  return { orders: result, stats };
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

      // version identifica la revisione servita: il client la rimanda al
      // salvataggio come baseVersion, così il server sa su quale stato ha
      // lavorato e può fondere le modifiche altrui invece di sovrascriverle.
      const payload = data || { orders: [], lastOrderId: 0, currentPrefix: `${new Date().getFullYear()}_`, highlightedSizeCells: {} };

      return res.status(200).json({
        success: true,
        version: payload.version || 0,
        data: payload
      });

    } else if (req.method === 'POST') {
      const { action, orders, lastOrderId, currentPrefix, highlightedSizeCells, baseVersion, baseOrders } = req.body;
      
      if (action === 'save') {
        const role = (session.role || '').toLowerCase();

        // L'admin può riscrivere l'intero blob, ma non alla cieca: se dichiara
        // su quale versione ha lavorato, le modifiche fatte da altri nel
        // frattempo vengono fuse invece di essere sovrascritte.
        if (role === 'admin') {
          const current = await redis.get(KEYS.ORDERS) || {};
          const currentVersion = current.version || 0;
          const incomingOrders = Array.isArray(orders) ? orders : [];

          let finalOrders = incomingOrders;
          let mergeStats = null;

          // Il merge si applica solo se il client ha dichiarato la propria base
          // ED è rimasto indietro rispetto a Redis. Senza baseVersion (client
          // non ancora aggiornato) si conserva il comportamento precedente.
          const isStale = baseVersion !== undefined && baseVersion !== null && baseVersion !== currentVersion;

          if (isStale) {
            // baseOrders è lo stato che il client aveva al caricamento. Se non
            // lo invia, si usa il payload stesso come base: il merge degenera
            // allora nel conservare gli ordini altrui senza perderli.
            const base = Array.isArray(baseOrders) ? baseOrders : incomingOrders;
            const res3 = mergeOrdersThreeWay(base, current.orders || [], incomingOrders);
            finalOrders = res3.orders;
            mergeStats = res3.stats;

            console.warn(
              `🔀 POST /api/orders - merge concorrente (${session.username}): ` +
              `base v${baseVersion} vs corrente v${currentVersion} — ` +
              `${mergeStats.merged} ordini fusi, ${mergeStats.preservedOrders} preservati da altri, ` +
              `${mergeStats.conflicts} conflitti sullo stesso campo, ${mergeStats.deleted} eliminati`
            );
          }

          const dataToSave = {
            orders: finalOrders,
            lastOrderId: Math.max(lastOrderId || 0, current.lastOrderId || 0),
            currentPrefix: currentPrefix || `${new Date().getFullYear()}_`,
            highlightedSizeCells: highlightedSizeCells || {},
            version: currentVersion + 1,
            updatedAt: new Date().toISOString()
          };

          await redis.set(KEYS.ORDERS, dataToSave);
          console.log(`✅ POST /api/orders - Salvati ${finalOrders.length} ordini, prefix: ${currentPrefix}, v${dataToSave.version}`);

          return res.status(200).json({
            success: true,
            message: 'Orders saved successfully',
            version: dataToSave.version,
            merged: mergeStats || undefined
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
          // Anche le scritture dei ruoli limitati fanno avanzare la versione,
          // altrimenti un admin non si accorgerebbe della loro modifica.
          // Qui non serve il merge a tre vie: applyRoleWriteRules rilegge già
          // sempre lo stato corrente e ci applica sopra i soli campi consentiti.
          version: (current.version || 0) + 1,
          updatedAt: new Date().toISOString()
        };

        await redis.set(KEYS.ORDERS, dataToSave);

        if (rejected > 0) {
          console.warn(`⚠️ POST /api/orders - ruolo "${role}" (${session.username}): ${rejected} modifiche non consentite scartate`);
        }
        console.log(`✅ POST /api/orders - ruolo "${role}": salvati ${mergedOrders.length} ordini, v${dataToSave.version}`);

        return res.status(200).json({
          success: true,
          message: 'Orders saved successfully',
          version: dataToSave.version
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
