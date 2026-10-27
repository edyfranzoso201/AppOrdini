import { getRedis } from './lib/redis.js';
import { requireAuth } from './lib/auth.js';

const CONFIG_KEY = 'orderflow:config';
// Catalogo pubblico del materiale squadra (catalogo.html?tipo=squadra): blob
// separato da CONFIG_KEY, che saveData() riscrive a ogni salvataggio per tutti
// i ruoli. Stessa forma di config.catalog.
const TEAM_CATALOG_KEY = 'orderflow:team:public-catalog';
const TEAM_KIT_KEYS = ['kit_completo_campo', 'kit_completo_portiere', 'mini_kit_campo', 'mini_kit_portiere', 'kit_generico'];

function teamCatalogDefault() {
  return { title: 'Catalogo Squadra', logo: '', qrUrl: '', fullCatalogUrl: '', orderNote: '', items: [], kits: {} };
}

// Ruoli che possono salvare i Quick ID filters (permesso useQuickIdFilters in
// USER_ROLES): il pulsante "Configura Quick ID" non è nascosto per questi
// ruoli, e il salvataggio passa da saveData() -> POST /api/config.
const QUICK_ID_ROLES = ['status_manager', 'table_editor', 'tabella_full', 'tabella_readonly'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const redis = getRedis();

  try {
    // GET resta pubblico: catalogo.html lo consulta senza login
    if (req.method === 'GET' && req.query?.scope === 'team') {
      const catalog = { ...teamCatalogDefault(), ...((await redis.get(TEAM_CATALOG_KEY)) || {}) };
      if (!catalog.kits || typeof catalog.kits !== 'object') catalog.kits = {};
      return res.status(200).json({ success: true, data: { catalog } });
    }

    if (req.method === 'GET') {
      const config = await redis.get(CONFIG_KEY);
      console.log(`GET /api/config - items: ${config?.catalog?.items?.length||0}, kits: ${Object.keys(config?.catalog?.kits||{}).length}`);

      const data = config || {
        globalItems: [], globalKitTypes: {}, quickIdFilters: {},
        catalog: { title:'Catalogo Abbigliamento', logo:'', qrUrl:'', fullCatalogUrl:'', orderNote:'', items:[], kits:{} }
      };
      if (!data.catalog) data.catalog = { title:'Catalogo Abbigliamento', logo:'', qrUrl:'', fullCatalogUrl:'', orderNote:'', items:[], kits:{} };
      if (!data.catalog.kits) data.catalog.kits = {};

      return res.status(200).json({ success: true, data });

    } else if (req.method === 'POST') {
      const session = await requireAuth(req, res);
      if (!session) return;

      const { action, globalItems, globalKitTypes, quickIdFilters, catalog } = req.body;

      // Catalogo Squadra: solo admin, non tocca la config dell'abbigliamento
      if (action === 'save-team-catalog') {
        if ((session.role || '').toLowerCase() !== 'admin') {
          return res.status(403).json({ success: false, error: 'Solo admin' });
        }
        if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog) || !Array.isArray(catalog.items || [])) {
          return res.status(400).json({ success: false, error: 'Catalogo non valido' });
        }
        const str = (v, n) => String(v ?? '').trim().slice(0, n);
        const existing = await redis.get(TEAM_CATALOG_KEY);
        let items = (catalog.items || []).slice(0, 300);
        // Stessa protezione del catalogo abbigliamento: un client con la
        // lista vuota non cancella gli articoli salvati
        if ((existing?.items?.length || 0) > 0 && items.length === 0 && !catalog.clearItems) {
          items = existing.items;
        }
        const kits = {};
        for (const k of TEAM_KIT_KEYS) {
          const kit = catalog.kits?.[k];
          if (!kit || typeof kit !== 'object') continue;
          const price = parseFloat(kit.discountedPrice);
          kits[k] = {
            name: str(kit.name, 120),
            description: str(kit.description, 500),
            discountedPrice: isNaN(price) ? null : price,
            items: Array.isArray(kit.items) ? kit.items.slice(0, 100) : []
          };
        }
        const saved = {
          title: str(catalog.title, 200) || 'Catalogo Squadra',
          logo: str(catalog.logo, 1000),
          qrUrl: str(catalog.qrUrl, 1000),
          fullCatalogUrl: str(catalog.fullCatalogUrl, 1000),
          orderNote: str(catalog.orderNote, 300),
          items,
          kits,
          updatedAt: new Date().toISOString()
        };
        await redis.set(TEAM_CATALOG_KEY, saved);
        return res.status(200).json({ success: true, catalog: saved });
      }

      if (action === 'save') {
        const role = (session.role || '').toLowerCase();

        // Il tab Catalogo è visibile solo all'admin (applyUserPermissions in
        // public/app.js), ma questo endpoint era dietro il solo requireAuth:
        // qualsiasi utente autenticato, anche in sola lettura, poteva
        // riscrivere articoli, kit e prezzi dell'intero catalogo con una
        // fetch diretta che ignora la UI.
        //
        // Non si può però renderlo admin-only: saveData() invia la config a
        // ogni salvataggio, per tutti i ruoli, e i ruoli con permesso
        // useQuickIdFilters salvano legittimamente i Quick ID da qui.
        // Per i non-admin si conserva quindi la config esistente e si accetta
        // al più il solo campo quickIdFilters.
        if (role !== 'admin') {
          const existing = await redis.get(CONFIG_KEY);
          if (!existing) {
            // Nessuna config salvata: un non-admin non può crearla da zero.
            return res.status(200).json({ success: true, message: 'Config unchanged' });
          }

          if (QUICK_ID_ROLES.includes(role) && quickIdFilters !== undefined) {
            await redis.set(CONFIG_KEY, {
              ...existing,
              quickIdFilters: quickIdFilters || {},
              updatedAt: new Date().toISOString()
            });
            return res.status(200).json({ success: true, message: 'Quick ID filters saved' });
          }

          // Ogni altra modifica alla config viene ignorata in silenzio, così
          // il salvataggio ordini di un ruolo limitato continua a funzionare.
          return res.status(200).json({ success: true, message: 'Config unchanged' });
        }

        // PROTEZIONE: non sovrascrivere articoli catalogo con array vuoto
        const existing = await redis.get(CONFIG_KEY);
        const existingItems = existing?.catalog?.items?.length || 0;
        const incomingItems = catalog?.items?.length || 0;

        let finalCatalog = catalog || { title:'Catalogo Abbigliamento', logo:'', qrUrl:'', fullCatalogUrl:'', orderNote:'', items:[], kits:{} };

        if (existingItems > 0 && incomingItems === 0) {
          console.warn(`PROTEZIONE: salvataggio con 0 items bloccato (esistenti: ${existingItems}). Preservo items.`);
          finalCatalog = { ...finalCatalog, items: existing.catalog.items };
        }

        const newConfig = {
          globalItems: globalItems || [],
          globalKitTypes: globalKitTypes || {},
          quickIdFilters: quickIdFilters || {},
          catalog: finalCatalog,
          updatedAt: new Date().toISOString()
        };

        await redis.set(CONFIG_KEY, newConfig);
        console.log(`POST /api/config - salvato: items=${finalCatalog.items?.length||0}, kits=${Object.keys(finalCatalog.kits||{}).length}`);

        return res.status(200).json({ success: true, message: 'Config saved' });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });

    } else {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Config API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
