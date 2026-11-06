import { getRedis, KEYS } from './lib/redis.js';
import { requireAuth } from './lib/auth.js';

export default async function handler(req, res) {
  const session = await requireAuth(req, res);
  if (!session) return;

  const redis = getRedis();

  try {
    if (req.method === 'GET') {
      const data = await redis.get(KEYS.INVENTORY);
      
      const inventoryKeys = data?.inventory ? Object.keys(data.inventory).length : 0;
      console.log(`📦 GET inventory - chiavi trovate: ${inventoryKeys}, updatedAt: ${data?.updatedAt || 'mai'}`);
      
      return res.status(200).json({
        success: true,
        data: data || { inventory: {} }
      });
      
    } else if (req.method === 'POST') {
      const { action, inventory } = req.body;

      // Azzera tutte le giacenze (pulsante a pressione lunga in Distinta).
      // 'save' rifiuta apposta un inventario vuoto, quindi serve un'azione
      // esplicita. Solo admin; la copia precedente resta in una chiave a
      // parte per poterla recuperare in caso di errore.
      if (action === 'reset') {
        const role = (session.role || '').toLowerCase();
        if (role !== 'admin') {
          return res.status(403).json({ success: false, error: 'Solo l\'amministratore puo\' azzerare il magazzino' });
        }
        const previous = await redis.get(KEYS.INVENTORY);
        if (previous) {
          await redis.set(KEYS.INVENTORY + ':beforeReset', { ...previous, resetAt: new Date().toISOString(), resetBy: session.username || '' });
        }
        // Il client azzera solo l'abbigliamento: manda le chiavi da tenere
        // (calze, pallone). Accetta solo un oggetto semplice di numeri.
        const keep = {};
        if (inventory && typeof inventory === 'object' && !Array.isArray(inventory)) {
          for (const [k, v] of Object.entries(inventory)) {
            const n = Number(v);
            if (typeof k === 'string' && k.length < 300 && Number.isFinite(n)) keep[k] = n;
          }
        }
        await redis.set(KEYS.INVENTORY, { inventory: keep, updatedAt: new Date().toISOString() });
        console.warn(`🧹 Magazzino azzerato da ${session.username} (${previous?.inventory ? Object.keys(previous.inventory).length : 0} chiavi, copia in ${KEYS.INVENTORY}:beforeReset)`);
        return res.status(200).json({ success: true, message: 'Inventory reset' });
      }

      if (action === 'save') {
        // Le giacenze di magazzino le modifica SOLO l'amministratore.
        //
        // Le celle stock sono renderizzate da renderMatrices() nel tab
        // Distinta, visibile ai ruoli viewer/viewer_full/contributor/
        // contributor_advanced: tutti però hanno editOrders:false, quindi
        // disableEditInputs() disabilita quelle input. Nessun ruolo non admin
        // ha bisogno di scrivere qui. Senza controllo lato server, invece,
        // qualsiasi utente autenticato poteva con una fetch diretta azzerare
        // o falsare l'intero magazzino, mandando in errore lo scalamento
        // ordini e i calcoli del fabbisogno in Distinta.
        //
        // Come per config.js non si può rispondere 403: saveData() invia
        // l'inventario a OGNI salvataggio, per tutti i ruoli. Si conserva
        // quindi il dato esistente e si risponde success, così i salvataggi
        // legittimi dei ruoli limitati continuano a funzionare.
        const role = (session.role || '').toLowerCase();
        if (role !== 'admin') {
          console.warn(`⚠️ POST /api/inventory - ruolo "${role}" (${session.username}): scrittura magazzino ignorata`);
          return res.status(200).json({
            success: true,
            message: 'Inventory unchanged'
          });
        }

        const inventoryKeys = inventory ? Object.keys(inventory).length : 0;
        console.log(`💾 POST inventory - salvataggio ${inventoryKeys} chiavi`);
        
        if (inventoryKeys === 0) {
          // ✅ NON sovrascrivere Redis con un inventario vuoto!
          // Questo previene la cancellazione accidentale del magazzino
          console.warn('⚠️ Tentativo di salvare inventario VUOTO ignorato');
          return res.status(200).json({
            success: true,
            message: 'Inventory empty - save skipped to prevent data loss'
          });
        }
        
        await redis.set(KEYS.INVENTORY, {
          inventory: inventory,
          updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Inventario salvato: ${inventoryKeys} chiavi`);
        
        return res.status(200).json({
          success: true,
          message: `Inventory saved successfully (${inventoryKeys} keys)`
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
    console.error('❌ Inventory API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
