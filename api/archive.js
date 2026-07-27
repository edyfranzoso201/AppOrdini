import { getRedis, KEYS } from './lib/redis.js';

const ARCHIVE_INDEX_KEY = 'orderflow:archive:index';
const archiveDataKey = (id) => `orderflow:archive:${id}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const redis = getRedis();

  try {
    // ─── GET: elenco archivi oppure dettaglio di un singolo archivio ───────
    if (req.method === 'GET') {
      const { id } = req.query;

      if (id) {
        const archive = await redis.get(archiveDataKey(id));
        if (!archive) {
          return res.status(404).json({ success: false, error: 'Archivio non trovato' });
        }
        return res.status(200).json({ success: true, archive });
      }

      const index = await redis.get(ARCHIVE_INDEX_KEY) || [];
      return res.status(200).json({ success: true, index });
    }

    // ─── POST ─────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { action } = req.body;

      // ── Crea un nuovo archivio a partire dai prefissi ordine scelti ──────
      if (action === 'create') {
        const { prefixes, label, createdBy } = req.body;

        if (!Array.isArray(prefixes) || prefixes.length === 0) {
          return res.status(400).json({ success: false, error: 'Nessun prefisso specificato' });
        }

        const ordersData = await redis.get(KEYS.ORDERS) || { orders: [], lastOrderId: 0, currentPrefix: `${new Date().getFullYear()}_`, highlightedSizeCells: {} };
        const allOrders = ordersData.orders || [];

        const toArchive = allOrders.filter(o => prefixes.some(p => (o.displayId || '').startsWith(p)));
        const remaining = allOrders.filter(o => !prefixes.some(p => (o.displayId || '').startsWith(p)));

        if (toArchive.length === 0) {
          return res.status(400).json({ success: false, error: 'Nessun ordine trovato per i prefissi indicati' });
        }

        // Snapshot dei pagamenti attualmente noti (fotografia, non spostamento:
        // i pagamenti restano anche nella lista live perché non sono legati
        // agli ordini da un ID, ma per nome atleta con matching fuzzy)
        const paymentsData = await redis.get('orderflow:payments') || { payments: [] };

        const archiveId = String(Date.now());
        const archive = {
          id: archiveId,
          label: label || prefixes.join(', '),
          prefixes,
          createdAt: new Date().toISOString(),
          createdBy: createdBy || null,
          orders: toArchive,
          paymentsSnapshot: paymentsData.payments || [],
          highlightedSizeCells: ordersData.highlightedSizeCells || {}
        };

        await redis.set(archiveDataKey(archiveId), archive);

        const index = await redis.get(ARCHIVE_INDEX_KEY) || [];
        index.unshift({
          id: archiveId,
          label: archive.label,
          prefixes,
          createdAt: archive.createdAt,
          createdBy: archive.createdBy,
          orderCount: toArchive.length
        });
        await redis.set(ARCHIVE_INDEX_KEY, index);

        // Rimuovi gli ordini archiviati dalla lista attiva
        await redis.set(KEYS.ORDERS, {
          ...ordersData,
          orders: remaining,
          updatedAt: new Date().toISOString()
        });

        console.log(`✅ Archivio ${archiveId} creato: ${toArchive.length} ordini (prefissi: ${prefixes.join(', ')})`);
        return res.status(200).json({ success: true, archiveId, archivedCount: toArchive.length, remainingCount: remaining.length });
      }

      // ── Ripristina un archivio negli ordini attivi e lo rimuove ──────────
      if (action === 'restore') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'ID archivio mancante' });

        const archive = await redis.get(archiveDataKey(id));
        if (!archive) {
          return res.status(404).json({ success: false, error: 'Archivio non trovato' });
        }

        const ordersData = await redis.get(KEYS.ORDERS) || { orders: [], lastOrderId: 0, currentPrefix: `${new Date().getFullYear()}_`, highlightedSizeCells: {} };
        const currentOrders = ordersData.orders || [];

        // Evita duplicati: non re-inserisce ordini il cui displayId esiste già tra gli attivi
        const currentIds = new Set(currentOrders.map(o => o.displayId));
        const toRestore = archive.orders.filter(o => !currentIds.has(o.displayId));
        const skipped = archive.orders.length - toRestore.length;

        await redis.set(KEYS.ORDERS, {
          ...ordersData,
          orders: [...currentOrders, ...toRestore],
          highlightedSizeCells: { ...(archive.highlightedSizeCells || {}), ...(ordersData.highlightedSizeCells || {}) },
          updatedAt: new Date().toISOString()
        });

        await redis.del(archiveDataKey(id));
        const index = await redis.get(ARCHIVE_INDEX_KEY) || [];
        const newIndex = index.filter(a => a.id !== id);
        await redis.set(ARCHIVE_INDEX_KEY, newIndex);

        console.log(`♻️ Archivio ${id} ripristinato: ${toRestore.length} ordini rimessi in attivo, ${skipped} saltati per ID duplicato`);
        return res.status(200).json({ success: true, restoredCount: toRestore.length, skippedCount: skipped });
      }

      // ── Elimina definitivamente un intero archivio ───────────────────────
      if (action === 'delete') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'ID archivio mancante' });

        await redis.del(archiveDataKey(id));

        const index = await redis.get(ARCHIVE_INDEX_KEY) || [];
        const newIndex = index.filter(a => a.id !== id);
        await redis.set(ARCHIVE_INDEX_KEY, newIndex);

        console.log(`🗑️ Archivio ${id} eliminato definitivamente`);
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Archive API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
