import { getRedis, KEYS } from './lib/redis.js';

export default async function handler(req, res) {
  // Configurazione Header per evitare errori CORS e forzare l'HTML
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const redis = getRedis();

  try {
    // 1. Recupero dati dal Database Upstash
    const logsData = await redis.get(KEYS.ACTIVITY_LOG);
    const recentLogs = logsData ? (typeof logsData === 'string' ? JSON.parse(logsData) : logsData) : [];

    // 2. Costruzione della Pagina HTML (la tua interfaccia)
    let html = `
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <title>Log Attività - AppOrdini</title>
    </head>
    <body class="bg-gray-50 p-4 md:p-8">
        <div class="max-w-6xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
                <h1 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <span>🕒</span> LOG Attività (Ultime 20 Azioni)
                </h1>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-gray-50 text-gray-600 uppercase text-xs font-semibold">
                        <tr>
                            <th class="px-6 py-4 border-b">Data/Ora</th>
                            <th class="px-6 py-4 border-b">Utente</th>
                            <th class="px-6 py-4 border-b">Azione</th>
                            <th class="px-6 py-4 border-b">Descrizione</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">`;

    if (recentLogs.length === 0) {
      html += `<tr><td colspan="4" class="px-6 py-10 text-center text-gray-500 italic">Nessuna attività registrata</td></tr>`;
    } else {
      recentLogs.slice(0, 20).forEach(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleDateString('it-IT');
        const timeStr = date.toLocaleTimeString('it-IT');
        
        // Mappatura colori azioni (come nel tuo screenshot)
        const actionColors = {
          'CREATE_ORDER': 'bg-green-100 text-green-800',
          'EDIT_ORDER': 'bg-blue-100 text-blue-800',
          'DELETE_ORDER': 'bg-red-100 text-red-800',
          'LOGIN': 'bg-indigo-100 text-indigo-800'
        };
        const colorClass = actionColors[log.action] || 'bg-gray-100 text-gray-800';

        html += `
          <tr class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 text-sm text-gray-600">
                  <div class="font-medium text-gray-900">${dateStr}</div>
                  <div class="text-xs text-gray-400">${timeStr}</div>
              </td>
              <td class="px-6 py-4">
                  <span class="text-sm font-semibold text-gray-700">${log.userName || 'Sistema'}</span>
                  <div class="text-xs text-gray-400">${log.user || ''}</div>
              </td>
              <td class="px-6 py-4">
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold uppercase ${colorClass}">
                      ${log.action.replace(/_/g, ' ')}
                  </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-600">${log.description || '-'}</td>
          </tr>`;
      });
    }

    html += `
                    </tbody>
                </table>
            </div>
            <div class="p-4 bg-gray-50 text-right">
                <p class="text-xs text-gray-400 font-mono">Database Status: Connected (Upstash KV)</p>
            </div>
        </div>
    </body>
    </html>`;

    // 3. Invio della pagina al browser
    res.status(200).send(html);

  } catch (error) {
    console.error('Errore API:', error);
    res.status(500).send(`<h1>Errore di connessione</h1><p>${error.message}</p>`);
  }
}