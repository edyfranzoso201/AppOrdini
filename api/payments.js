import { getRedis } from './lib/redis.js';

const PAYMENTS_KEY = 'orderflow:payments';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const redis = getRedis();

  try {

    // ─── GET: legge tutto il dato pagamenti ───────────────────────────────
    if (req.method === 'GET') {
      const data = await redis.get(PAYMENTS_KEY);
      return res.status(200).json({
        success: true,
        data: data || {
          payments: [],
          manualOverrides: {},
          quotaConfig: { annualQuotas: {}, primaSquadraQuota: 0, primaSquadraTranches: [] },
          importedAt: null
        }
      });
    }

    // ─── POST ─────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { action } = req.body;

      // ── Salva pagamenti (da import CSV) ──────────────────────────────────
      if (action === 'import') {
        const { payments } = req.body;
        const current = await redis.get(PAYMENTS_KEY) || {};

        const newData = {
          ...current,
          payments: payments || [],
          importedAt: new Date().toISOString()
        };
        await redis.set(PAYMENTS_KEY, newData);
        console.log(`✅ Importati ${payments?.length || 0} pagamenti su Redis`);
        return res.status(200).json({ success: true, count: payments?.length || 0 });
      }

      // ── Override manuale per un atleta ────────────────────────────────────
      if (action === 'override') {
        const { key, stato, nota } = req.body; // key = "Cognome Nome"
        const current = await redis.get(PAYMENTS_KEY) || {};
        const overrides = current.manualOverrides || {};

        if (stato === null) {
          // Rimuovi override
          delete overrides[key];
        } else {
          overrides[key] = { stato, nota: nota || '', updatedAt: new Date().toISOString() };
        }

        await redis.set(PAYMENTS_KEY, { ...current, manualOverrides: overrides });
        return res.status(200).json({ success: true });
      }

      // ── Salva configurazione quote ────────────────────────────────────────
      if (action === 'saveConfig') {
        const { quotaConfig } = req.body;
        const current = await redis.get(PAYMENTS_KEY) || {};
        await redis.set(PAYMENTS_KEY, { ...current, quotaConfig });
        return res.status(200).json({ success: true });
      }

      // ── Aggiungi pagamento manuale ─────────────────────────────────────────
      if (action === 'addManual') {
        const { payment } = req.body;
        const current = await redis.get(PAYMENTS_KEY) || {};
        const payments = current.payments || [];
        payments.push({
          ...payment,
          id: `manual_${Date.now()}`,
          manuale: true,
          stato: 'Completato'
        });
        await redis.set(PAYMENTS_KEY, { ...current, payments });
        return res.status(200).json({ success: true });
      }

      // ── Elimina pagamento manuale ──────────────────────────────────────────
      if (action === 'deleteManual') {
        const { paymentId } = req.body;
        const current = await redis.get(PAYMENTS_KEY) || {};
        const payments = (current.payments || []).filter(p => p.id !== paymentId);
        await redis.set(PAYMENTS_KEY, { ...current, payments });
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Payments API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
