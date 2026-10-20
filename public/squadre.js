// ─────────────────────────────────────────────────────────────────────────────
// Materiale di squadra: secondo modulo Google ("Ordine materiale Squadra"),
// compilato da dirigenti/allenatori/magazziniere. Le richieste vivono in un
// blob separato dagli ordini personali (/api/orders?scope=team, solo admin).
//
// Il foglio si legge per TITOLO di colonna, non per posizione: aggiungere o
// spostare una domanda nel modulo non fa slittare i dati, e una colonna che
// non si riconosce viene segnalata nell'anteprima invece di sparire.
//
// Limite noto del modulo: "Divise da Gioco Calcio" e' una tendina a scelta
// singola. Se si sceglie una maglia, il modulo prosegue anche nelle griglie
// pantaloncini e calzettoni senza chiederne il modello: quelle righe entrano
// come "modello da scegliere" e l'admin lo indica a mano.
// ─────────────────────────────────────────────────────────────────────────────

const TEAM_SHEET_ID = '1HN7tSFOe7ha-NzQLiDhXt9tOTBOQsM8XXTqt6ysRTfg';

// '' = articolo del calcio o valido per tutti gli sport
const TEAM_SPORTS = ['', 'Calcio', 'Basket', 'Pallavolo'];

const TEAM_GROUPS = {
    maglia: 'Maglia',
    pantaloncino: 'Pantaloncino',
    calzettone: 'Calzettone',
    attrezzatura: 'Attrezzatura'
};

// Catalogo iniziale ricavato dal modulo; l'admin lo modifica dal tab.
// alias = testo esatto con cui l'articolo compare nel modulo.
const TEAM_DEFAULT_CATALOG = [
    ['Maglia Portiere GK TEE Arancione', 'maglia', 'Maglia Portiere Calcio GK TEE (Arancione)'],
    ['Maglia Portiere GK TEE Gialla', 'maglia', 'Maglia Portiere Calcio GK TEE (Gialla)'],
    ['Maglia Portiere GK TEE Blue Turkis', 'maglia', 'Maglia Portiere Calcio GK TEE (Blue Turkis)'],
    ['Maglia CASTOLO Blue Marine', 'maglia', 'Maglia Giocatore da campo Calcio CASTOLO Blue Marine'],
    ['Maglia CASTOLO Red Chinese', 'maglia', 'Maglia Giocatore da campo Calcio CASTOLO Red Chinese'],
    ['Pantaloncino BORGO Blu Marine', 'pantaloncino', 'Pantaloncino Calcio BORGO Blu Marine'],
    ['Pantaloncino BORGO Rosso', 'pantaloncino', 'Pantaloncino Calcio BORGO Rosso'],
    ['Calzettone WULGAR Blu Marine', 'calzettone', 'Calzettone Calcio WULGAR Blu Marine'],
    ['Calzettone WULGAR Rosso', 'calzettone', 'Calzettone Calcio WULGAR Rosso'],
    ['Cinesini', 'attrezzatura', 'Cinesini'],
    ['Coni', 'attrezzatura', 'Coni'],
    ['Scalette', 'attrezzatura', 'Scalette'],
    ['Borsa medica', 'attrezzatura', 'Borsa medica'],
    ['Pettorine Gialle', 'attrezzatura', 'Pettorine Gialle'],
    ['Pallone Taglia 5', 'attrezzatura', ['Pallone Taglia 5', 'Pallone Calcio Taglia 5']],
    // Basket e Pallavolo: nel modulo la tendina dice solo "Maglia Blue", lo
    // sport lo dice la colonna Tipo Sport (vedi teamFindArticle)
    ['Maglia Basket Blue', 'maglia', 'Maglia Blue', 'Basket'],
    ['Maglia Basket Rossa', 'maglia', 'Maglia Rossa', 'Basket'],
    ['Pantaloncino Basket Blue', 'pantaloncino', 'Pantaloncino Blue', 'Basket'],
    ['Pantaloncino Basket Rosso', 'pantaloncino', 'Pantaloncino Rosso', 'Basket'],
    ['Calzettone Basket Blue', 'calzettone', 'Calzettone Blue', 'Basket'],
    ['Calzettone Basket Rosso', 'calzettone', 'Calzettone Rosso', 'Basket'],
    ['Maglia Pallavolo Blue', 'maglia', 'Maglia Blue', 'Pallavolo'],
    ['Maglia Pallavolo Rossa', 'maglia', 'Maglia Rossa', 'Pallavolo'],
    ['Pantaloncino Pallavolo Blue', 'pantaloncino', 'Pantaloncino Blue', 'Pallavolo'],
    ['Pantaloncino Pallavolo Rosso', 'pantaloncino', 'Pantaloncino Rosso', 'Pallavolo'],
    ['Calzettone Pallavolo Blue', 'calzettone', 'Calzettone Blue', 'Pallavolo'],
    ['Calzettone Pallavolo Rosso', 'calzettone', 'Calzettone Rosso', 'Pallavolo'],
    ['Pallone Basket', 'attrezzatura', 'Pallone Basket', 'Basket'],
    ['Pettorine Arancioni', 'attrezzatura', 'Pettorine Arancioni'],
    ['Pallone da Pallavolo', 'attrezzatura', 'Pallone da Pallavolo', 'Pallavolo']
].map(([nome, gruppo, alias, sport]) => ({ nome, gruppo, alias: [].concat(alias), ...(sport ? { sport } : {}) }));

// Catalogo salvato prima di un articolo nuovo del modulo: si aggiungono gli
// articoli di default che mancano (per nome) e i loro testi del modulo.
function teamMergeDefaultCatalog(catalog) {
    const out = catalog.map(a => ({ ...a, alias: [...(a.alias || [])] }));
    for (const d of TEAM_DEFAULT_CATALOG) {
        const a = out.find(x => teamNorm(x.nome) === teamNorm(d.nome));
        if (!a) { out.push({ ...d, alias: [...d.alias] }); continue; }
        d.alias.forEach(al => { if (!a.alias.some(x => teamNorm(x) === teamNorm(al))) a.alias.push(al); });
        if (d.sport && !a.sport) a.sport = d.sport;
    }
    return out;
}

// ── Funzioni pure (testabili senza DOM) ─────────────────────────────────────

function teamNorm(s) {
    return String(s ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
}

// CSV completo: le celle tra virgolette possono contenere virgole e "a capo"
// (es. Note). Si va a capo riga SOLO fuori dalle virgolette.
function teamParseCsv(text) {
    const rows = [];
    let cells = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { cell += '"'; i++; }
                else inQuotes = false;
            } else cell += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === ',') { cells.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            cells.push(cell); rows.push(cells); cells = []; cell = '';
        } else cell += ch;
    }
    if (cell !== '' || cells.length) { cells.push(cell); rows.push(cells); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
}

// Classifica ogni colonna dell'intestazione. Ritorna [{index, kind, extra}].
function teamClassifyColumns(header) {
    return header.map((raw, index) => {
        const h = teamNorm(raw);
        const br = String(raw).match(/^(.*)\[(.*)\]\s*$/);
        if (br) {
            const prefix = teamNorm(br[1]);
            const inner = br[2].trim();
            const num = (inner.match(/\d+/) || [])[0];
            if (prefix.includes('maglia')) return { index, kind: 'grid', group: 'maglia', numero: num ? Number(num) : null };
            if (prefix.includes('pantaloncin')) return { index, kind: 'grid', group: 'pantaloncino' };
            if (prefix.includes('calzett') || (prefix === '' && /^qt/i.test(teamNorm(inner)))) return { index, kind: 'grid', group: 'calzettone' };
            return { index, kind: 'equip', label: inner };
        }
        if (index === 0 || h.includes('cronologic') || h === 'timestamp') return { index, kind: 'timestamp' };
        if (h === 'e-mail' || h === 'email' || h.includes('indirizzo email')) return { index, kind: 'email' };
        if (h.includes('cognome')) return { index, kind: 'cognome' };
        if (h.includes('nome')) return { index, kind: 'nome' };
        if (h.includes('telefono')) return { index, kind: 'telefono' };
        if (h.includes('ruolo')) return { index, kind: 'ruolo' };
        if (h.includes('materiale richiesto')) return { index, kind: 'tipo' };
        if (h.includes('categoria') || h.includes('annata') || h.includes('squadra')) return { index, kind: 'categoria' };
        if (h.includes('sport')) return { index, kind: 'sport' };
        // Una tendina per sport: "Divise da Gioco Calcio", "... Basket", "... Pallavolo"
        if (h.includes('divise')) return { index, kind: 'principale', sport: h.replace(/.*divise da gioco\s*/, '') };
        // La domanda Note del modulo non ha titolo: Fogli la chiama "Colonna N".
        if (h.includes('note') || /^colonna \d+$/.test(h)) return { index, kind: 'note' };
        return { index, kind: 'unknown', label: String(raw).trim() };
    });
}

// Lo stesso testo ("Maglia Blue") puo' valere per piu' sport: vince l'articolo
// dello sport della richiesta, poi quello senza sport, poi qualunque.
function teamFindArticle(catalog, text, sport) {
    const t = teamNorm(text);
    if (!t) return null;
    const hits = catalog.filter(a => teamNorm(a.nome) === t || (a.alias || []).some(x => teamNorm(x) === t));
    const s = teamNorm(sport);
    return hits.find(a => s && teamNorm(a.sport) === s) || hits.find(a => !a.sport) || hits[0] || null;
}

// Articolo non in catalogo: il gruppo si legge dalla prima parola, cosi'
// "Pantaloncino Verde" va nella griglia pantaloncini invece di restare da scegliere.
function teamGuessGroup(text) {
    const t = teamNorm(text);
    if (/^maglia/.test(t)) return 'maglia';
    if (/^pantaloncin/.test(t)) return 'pantaloncino';
    if (/^calzett/.test(t)) return 'calzettone';
    return '';
}

// Sport di un articolo: quelli senza sport sono del calcio (il primo modulo)
function teamArticleSport(a) {
    return teamNorm(a && a.sport) || 'calcio';
}

// Colore di un articolo, per abbinare pantaloncini e calzettoni alla maglia:
// "CASTOLO Blue Marine" e "BORGO Blu Marine" danno entrambi 'blu'.
function teamColorKey(nome) {
    const t = teamNorm(nome);
    if (/turk|turch/.test(t)) return 'turchese';
    if (/\bblu|\bblue/.test(t)) return 'blu';
    if (/\bred\b|ross/.test(t)) return 'rosso';
    if (/arancio/.test(t)) return 'arancione';
    if (/giall/.test(t)) return 'giallo';
    return '';
}

// Il modulo ha una sola tendina: se e' una maglia, le griglie pantaloncini e
// calzettoni arrivano senza modello. Si deduce dal colore della maglia; se il
// colore non c'e' o non basta a scegliere un solo articolo, resta da scegliere.
function teamResolveByColor(righe, catalog, sport) {
    const colori = [...new Set(righe.filter(x => x.gruppo === 'maglia' && x.articolo)
        .map(x => teamColorKey(x.articolo)))];
    if (colori.length !== 1 || !colori[0]) return righe;
    // Una maglia blu da basket non deve tirarsi dietro il pantaloncino blu del calcio
    const s = teamNorm(sport) || 'calcio';
    return righe.map(x => {
        if (!x.daScegliere) return x;
        const match = catalog.filter(a => a.gruppo === x.gruppo && teamColorKey(a.nome) === colori[0] && teamArticleSport(a) === s);
        return match.length === 1 ? { ...x, articolo: match[0].nome, daScegliere: false } : x;
    });
}

// "15/10/2026 17.06.58" -> ISO; se il formato non e' riconosciuto, null.
function teamParseTimestamp(s) {
    const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})[.:](\d{2})[.:](\d{2})/);
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
    return isNaN(d) ? null : d.toISOString();
}

function teamParseQty(s) {
    const m = String(s).match(/\d+/);
    return m ? Number(m[0]) : 0;
}

// Converte le righe CSV in richieste. knownKeys = importKey gia' presenti o
// cancellati, da non reimportare.
function teamBuildRequests(rows, catalog, knownKeys) {
    // aggiornamenti: importKey -> { ruolo, sport } delle righe gia' importate,
    // per completare le richieste arrivate prima che il modulo li chiedesse
    const result = { nuove: [], giaPresenti: 0, senzaData: 0, colonneIgnote: [], aggiornamenti: {} };
    if (!rows.length) return result;
    const cols = teamClassifyColumns(rows[0]);
    const known = new Set(knownKeys || []);
    const ignote = new Set();

    for (const row of rows.slice(1)) {
        const get = (kind) => cols.filter(c => c.kind === kind).map(c => (row[c.index] || '').trim()).filter(Boolean);
        const ts = get('timestamp')[0];
        if (!ts) { result.senzaData++; continue; }
        const email = get('email')[0] || '';
        const importKey = `SQ-${ts}|${email.toLowerCase()}`;
        const sport = get('sport')[0] || '';
        const ruolo = get('ruolo')[0] || '';
        if (known.has(importKey)) {
            result.giaPresenti++;
            if (ruolo || sport) result.aggiornamenti[importKey] = { ruolo, sport };
            continue;
        }
        known.add(importKey);

        // Tendina dello sport della richiesta; se quella e' vuota, la prima compilata
        const tendine = cols.filter(c => c.kind === 'principale')
            .map(c => ({ sport: c.sport, val: (row[c.index] || '').trim() })).filter(c => c.val);
        const principaleTxt = (tendine.find(c => c.sport && c.sport === teamNorm(sport)) || tendine[0] || {}).val || '';
        const principale = teamFindArticle(catalog, principaleTxt, sport);
        const guessed = principale ? principale.gruppo : teamGuessGroup(principaleTxt);
        const avvisi = [];
        if (principaleTxt && !principale) avvisi.push(`"${principaleTxt}" non e' nel catalogo squadra`);

        // Articolo da usare per una griglia: quello scelto in tendina se e' dello
        // stesso gruppo, altrimenti resta da scegliere.
        const articleFor = (group) => {
            if (principale && principale.gruppo === group) return { articolo: principale.nome, daScegliere: false };
            if (!principale && principaleTxt && (guessed || 'maglia') === group) return { articolo: principaleTxt, daScegliere: false };
            return { articolo: '', daScegliere: true };
        };

        let righe = [];
        const aggregate = {};
        for (const c of cols) {
            const val = (row[c.index] || '').trim();
            if (!val) continue;
            if (c.kind === 'grid') {
                const art = articleFor(c.group);
                if (c.group === 'maglia') {
                    righe.push({ gruppo: 'maglia', ...art, taglia: val, numero: c.numero, qta: 1 });
                } else {
                    const k = `${c.group}|${val}`;
                    if (!aggregate[k]) {
                        aggregate[k] = { gruppo: c.group, ...art, taglia: val, numero: null, qta: 0 };
                        righe.push(aggregate[k]);
                    }
                    aggregate[k].qta++;
                }
            } else if (c.kind === 'equip') {
                const qta = teamParseQty(val);
                if (!qta) continue;
                const a = teamFindArticle(catalog, c.label, sport);
                if (!a) avvisi.push(`"${c.label}" non e' nel catalogo squadra`);
                righe.push({ gruppo: 'attrezzatura', articolo: a ? a.nome : c.label, daScegliere: false, taglia: '', numero: null, qta });
            } else if (c.kind === 'unknown') {
                ignote.add(c.label);
            }
        }
        righe = teamResolveByColor(righe, catalog, sport);
        if (righe.some(r => r.daScegliere)) avvisi.push('Modello da scegliere per alcune righe');
        if (!righe.length) avvisi.push('Nessun articolo compilato');

        const categoria = get('categoria')[0] || '';
        result.nuove.push({
            id: importKey,
            importKey,
            createdAt: teamParseTimestamp(ts) || ts,
            importedAt: new Date().toISOString(),
            status: 'Nuovo',
            richiedente: {
                nome: get('nome')[0] || '',
                cognome: get('cognome')[0] || '',
                email,
                telefono: get('telefono')[0] || '',
                ruolo
            },
            categoria,
            squadra: categoria,
            sport,
            tipo: get('tipo')[0] || '',
            articoloModulo: principaleTxt,
            righe,
            note: get('note').join('\n'),
            avvisi
        });
    }
    result.colonneIgnote = [...ignote];
    return result;
}

// ── Stato e salvataggio ─────────────────────────────────────────────────────

const teamState = {
    loaded: false,
    requests: [],
    baseRequests: [],
    catalog: TEAM_DEFAULT_CATALOG.map(a => ({ ...a, alias: [...a.alias] })),
    deletedImportKeys: [],
    version: 0,
    preview: null,
    filter: 'tutte',
    showCatalog: false,
    inventory: {},
    expanded: new Set(),  // richieste aperte nel dettaglio (solo a video)
    view: 'attive',       // 'attive' | 'archivio'
    colFilters: {}        // filtri della riga sotto le intestazioni di Richieste
};

function teamClone(x) { return JSON.parse(JSON.stringify(x)); }

function teamEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function teamNotify(msg, type) {
    if (typeof showQuickNotification === 'function') showQuickNotification(msg, type || 'success');
    else alert(msg);
}

async function loadTeamData() {
    const box = document.getElementById('teamRequestsList');
    try {
        const res = await fetch('/api/orders?scope=team');
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
        const d = json.data || {};
        teamState.requests = Array.isArray(d.requests) ? d.requests : [];
        teamState.baseRequests = teamClone(teamState.requests);
        if (Array.isArray(d.catalog) && d.catalog.length) teamState.catalog = teamMergeDefaultCatalog(d.catalog);
        // Richieste importate prima della deduzione dal colore della maglia:
        // si risolvono a video; base resta quella del server, quindi il primo
        // salvataggio le scrive su Redis.
        // Stati della prima versione -> stati di Gestione; come sopra, il primo
        // salvataggio li scrive su Redis
        teamState.requests.forEach(r => { if (TEAM_LEGACY_STATUS[r.status]) r.status = TEAM_LEGACY_STATUS[r.status]; });
        teamState.requests.forEach(r => {
            if (!(r.righe || []).some(x => x.daScegliere)) return;
            r.righe = teamResolveByColor(r.righe, teamState.catalog, r.sport);
            r.avvisi = (r.avvisi || []).filter(a => !a.startsWith('Modello da scegliere'));
            if (r.righe.some(x => x.daScegliere)) r.avvisi.push('Modello da scegliere per alcune righe');
        });
        teamState.deletedImportKeys = d.deletedImportKeys || [];
        teamState.inventory = (d.inventory && typeof d.inventory === 'object') ? d.inventory : {};
        teamState.version = json.version || 0;
        teamState.loaded = true;
        renderTeamTab();
    } catch (e) {
        console.error('Errore caricamento materiale squadra:', e);
        if (box) box.innerHTML = `<p class="text-red-600 text-sm">Errore nel caricamento: ${teamEsc(e.message)}</p>`;
    }
}

async function saveTeamRequests(newDeletedKeys) {
    const res = await fetch('/api/orders?scope=team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'save',
            requests: teamState.requests,
            baseRequests: teamState.baseRequests,
            baseVersion: teamState.version,
            deletedImportKeys: newDeletedKeys || []
        })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
    if (json.merged) {
        // Un altro dispositivo aveva salvato nel frattempo: si ricarica lo stato
        // fuso dal server, cosi' a video c'e' quello che c'e' davvero su Redis.
        await loadTeamData();
        return;
    }
    teamState.version = json.version;
    teamState.baseRequests = teamClone(teamState.requests);
    if (newDeletedKeys) teamState.deletedImportKeys.push(...newDeletedKeys);
}

async function teamSaveAndRender(newDeletedKeys) {
    try {
        await saveTeamRequests(newDeletedKeys);
        renderTeamTab();
    } catch (e) {
        alert('Salvataggio non riuscito: ' + e.message);
        await loadTeamData();
    }
}

// ── Import ──────────────────────────────────────────────────────────────────

async function importTeamFromGoogleSheet() {
    if (currentUser?.role !== 'admin') { alert('Solo l\'amministratore puo\' importare il materiale squadra.'); return; }
    const btn = document.getElementById('btnImportTeam');
    if (btn) btn.disabled = true;
    try {
        if (!teamState.loaded) await loadTeamData();
        const url = `https://docs.google.com/spreadsheets/d/${TEAM_SHEET_ID}/export?format=csv`;
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error('Impossibile leggere il foglio Google. Verifica che sia condiviso con "chiunque abbia il link".');
        const rows = teamParseCsv(await res.text());
        const known = [...teamState.requests.map(r => r.importKey), ...teamState.deletedImportKeys];
        teamState.preview = teamBuildRequests(rows, teamState.catalog, known);
        teamState.preview.completate = teamApplyUpdates(teamState.requests, teamState.preview.aggiornamenti, true);
        renderTeamTab();
    } catch (e) {
        alert('Importazione non riuscita: ' + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

// Richieste gia' importate: si riempiono Ruolo e Sport solo se vuoti, mai
// sovrascritti (l'admin puo' averli corretti a mano). dryRun = solo conta.
function teamApplyUpdates(requests, updates, dryRun) {
    let n = 0;
    for (const r of requests) {
        const u = updates && updates[r.importKey];
        if (!u) continue;
        const ruolo = u.ruolo && !(r.richiedente || {}).ruolo;
        const sport = u.sport && !r.sport;
        if (!ruolo && !sport) continue;
        n++;
        if (dryRun) continue;
        if (ruolo) r.richiedente = { ...r.richiedente, ruolo: u.ruolo };
        if (sport) r.sport = u.sport;
    }
    return n;
}

async function confirmTeamImport() {
    const p = teamState.preview;
    if (!p || (!p.nuove.length && !p.completate)) { teamState.preview = null; renderTeamTab(); return; }
    teamState.requests.push(...p.nuove);
    const completate = teamApplyUpdates(teamState.requests, p.aggiornamenti, false);
    const n = p.nuove.length;
    teamState.preview = null;
    await teamSaveAndRender();
    teamNotify(`${n} richieste importate${completate ? `, ${completate} completate con ruolo/sport` : ''}`);
}

function cancelTeamImport() {
    teamState.preview = null;
    renderTeamTab();
}

// ── Modifiche alle richieste ────────────────────────────────────────────────

function teamFind(id) { return teamState.requests.find(r => r.id === id); }

async function teamUpdateField(id, field, value) {
    const r = teamFind(id);
    if (!r) return;
    if (field === 'ruolo') r.richiedente = { ...r.richiedente, ruolo: value };
    else r[field] = value;
    await teamSaveAndRender();
}

async function teamChooseModel(id, idx, nome) {
    const r = teamFind(id);
    if (!r || !r.righe[idx]) return;
    r.righe = r.righe.map((x, i) => i === idx ? { ...x, articolo: nome, daScegliere: !nome } : x);
    r.avvisi = (r.avvisi || []).filter(a => !a.startsWith('Modello da scegliere'));
    if (r.righe.some(x => x.daScegliere)) r.avvisi.push('Modello da scegliere per alcune righe');
    await teamSaveAndRender();
}

async function teamDeleteRequest(id) {
    const r = teamFind(id);
    if (!r) return;
    const who = `${r.richiedente.nome} ${r.richiedente.cognome}`.trim();
    if (!confirm(`Eliminare la richiesta di ${who || 'questo richiedente'} (${r.squadra || 'senza squadra'})?\nNon verra' reimportata dal foglio.`)) return;
    teamState.requests = teamState.requests.filter(x => x.id !== id);
    await teamSaveAndRender([r.importKey]);
}

// ── Catalogo squadra ────────────────────────────────────────────────────────

function toggleTeamCatalog() {
    teamState.showCatalog = !teamState.showCatalog;
    renderTeamTab();
}

function teamCatalogAdd() {
    teamState.catalog.push({ nome: 'Nuovo articolo', gruppo: 'attrezzatura', alias: [] });
    renderTeamTab();
}

function teamCatalogRemove(i) {
    teamState.catalog.splice(i, 1);
    renderTeamTab();
}

async function saveTeamCatalog() {
    const rows = document.querySelectorAll('#teamCatalogBody tr[data-i]');
    const catalog = [];
    rows.forEach(tr => {
        const nome = tr.querySelector('[data-f="nome"]').value.trim();
        if (!nome) return;
        const sport = tr.querySelector('[data-f="sport"]').value;
        catalog.push({
            nome,
            gruppo: tr.querySelector('[data-f="gruppo"]').value,
            alias: tr.querySelector('[data-f="alias"]').value.split('\n').map(s => s.trim()).filter(Boolean),
            ...(sport ? { sport } : {})
        });
    });
    try {
        const res = await fetch('/api/orders?scope=team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save-catalog', catalog })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
        teamState.catalog = catalog;
        // save-catalog fa avanzare la versione: senza riallinearla il prossimo
        // salvataggio delle richieste verrebbe preso per concorrente.
        teamState.version = json.version;
        teamNotify('Catalogo squadra salvato');
        renderTeamTab();
    } catch (e) {
        alert('Salvataggio catalogo non riuscito: ' + e.message);
    }
}

// ── Render ──────────────────────────────────────────────────────────────────

// Stati identici a Gestione: si usa la lista di app.js (STATUSES); la copia
// serve solo se squadre.js gira da solo (test)
const TEAM_STATUSES = typeof STATUSES !== 'undefined' ? STATUSES : [
    { value: 'Nuovo', label: 'Nuovo', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'In Lavorazione', label: 'In Lavorazione', color: 'bg-blue-100 text-blue-800' },
    { value: 'Ordine Arrivato', label: 'Arrivato', color: 'bg-orange-100 text-orange-800' },
    { value: 'Consegna Parziale', label: 'Consegna Parziale', color: 'bg-amber-100 text-amber-800' },
    { value: 'Consegnato', label: 'Consegnato', color: 'bg-gray-700 text-white' },
    { value: 'Scomposto', label: 'Scomposto', color: 'bg-teal-100 text-teal-800' },
    { value: 'Ordine annullato', label: 'Annullato', color: 'bg-red-100 text-red-800' },
    { value: 'Ordine trasferito ad altro ID', label: 'Trasferito', color: 'bg-purple-100 text-purple-800' },
    { value: 'Da piazzare', label: 'Da piazzare', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'In sospeso', label: 'In sospeso', color: 'bg-slate-200 text-slate-700' },
    { value: 'Pronto', label: 'Pronto', color: 'bg-green-100 text-green-800' }
];
// Come in Tabella: annullati e trasferiti restano visibili ma non contano
const TEAM_VOID_STATUSES = ['Ordine annullato', 'Ordine trasferito ad altro ID'];
// Stati della prima versione della Distinta Squadre
const TEAM_LEGACY_STATUS = { in_attesa: 'Nuovo', approvata: 'In Lavorazione', rifiutata: 'Ordine annullato', consegnata: 'Consegnato' };

function teamIsVoid(r) {
    return TEAM_VOID_STATUSES.includes(r.status);
}

function teamFormatDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? teamEsc(iso) : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Distinta aggregata (stessa impostazione della Distinta ordini) ──────────
// Righe = taglie, colonne = articoli, cella = pezzi. Le maglie riportano
// anche i numeri richiesti. Le richieste rifiutate non entrano.

const TEAM_SIZE_ORDER = (typeof SIZE_ORDER !== 'undefined' ? SIZE_ORDER
    : ['23/26', '27/30', '31/34', '35/38', '39/42', '43/46', '47/49', '6 ANNI', '8 ANNI', '10 ANNI', '12 ANNI', '14 ANNI', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'UNICA']);

function teamSizeRank(taglia) {
    const t = String(taglia).toUpperCase();
    // I calzettoni arrivano come "39/42 n9": conta la misura prima dello spazio
    const i = TEAM_SIZE_ORDER.indexOf(t) >= 0 ? TEAM_SIZE_ORDER.indexOf(t) : TEAM_SIZE_ORDER.indexOf(t.split(' ')[0]);
    if (t === 'UNICA') return 9999;
    return i >= 0 ? i : 999;
}

// Taglia come riga della Distinta: "39/42 n9" del modulo diventa "39/42",
// cosi' richieste e giacenza finiscono sulla stessa riga
function teamSizeKey(taglia) {
    const t = String(taglia || '').trim().toUpperCase();
    if (!t || t === '-') return 'UNICA';
    if (TEAM_SIZE_ORDER.includes(t)) return t;
    const head = t.split(' ')[0];
    return TEAM_SIZE_ORDER.includes(head) ? head : String(taglia).trim();
}

function teamColumnName(x) {
    return x.daScegliere ? `${TEAM_GROUPS[x.gruppo] || x.gruppo} (modello da scegliere)` : x.articolo;
}

function teamAggregate(requests, catalog) {
    const cells = {}; // colonna -> taglia -> { qta, numeri[] }
    requests.filter(r => !teamIsVoid(r)).forEach(r => r.righe.forEach(x => {
        const col = teamColumnName(x);
        const size = teamSizeKey(x.taglia);
        const c = ((cells[col] = cells[col] || {})[size] = cells[col][size] || { qta: 0, numeri: [] });
        c.qta += Number(x.qta) || 0;
        if (x.numero) c.numeri.push(x.numero);
    }));
    const groupOf = {};
    requests.forEach(r => r.righe.forEach(x => { groupOf[teamColumnName(x)] = x.gruppo; }));
    const columns = teamSortColumns(Object.keys(cells), groupOf, catalog);
    const sizes = teamSortSizes(columns.flatMap(c => Object.keys(cells[c])));
    columns.forEach(c => Object.values(cells[c]).forEach(v => v.numeri.sort((a, b) => Number(a) - Number(b))));
    return { columns, sizes, cells };
}

// Colonne per gruppo (maglia, pantaloncino, calzettone, attrezzatura), poi
// nell'ordine del catalogo; il "modello da scegliere" chiude il suo gruppo
function teamSortColumns(cols, groupOf, catalog) {
    const groupOrder = Object.keys(TEAM_GROUPS);
    const rank = (col) => {
        const g = groupOrder.indexOf(groupOf[col]);
        const i = (catalog || []).findIndex(a => a.nome === col);
        return (g >= 0 ? g : groupOrder.length) * 1000 + (i >= 0 ? i : 999);
    };
    return [...new Set(cols)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function teamSortSizes(sizes) {
    return [...new Set(sizes)].sort((a, b) => teamSizeRank(a) - teamSizeRank(b) || a.localeCompare(b));
}

// ── Giacenza e Netto: come la Distinta ordini ───────────────────────────────
// 1. Lordo = tutte le richieste non rifiutate (o quelle dello stato filtrato)
// 2. Giacenza = magazzino squadra, una cella per articolo/taglia, modificabile
// 3. Netto = da ordinare al fornitore: richieste ancora aperte (in attesa o
//    approvate; con un filtro di stato, quello) meno la giacenza.
// Le tre tabelle hanno le stesse colonne e righe, come nella Distinta.

// Le taglie del modulo squadra (calze, bambino, adulto) + UNICA per l'attrezzatura:
// sempre presenti in Giacenza per fare l'inventario. Una taglia diversa compare
// solo se c'e' in una richiesta o in magazzino.
const TEAM_DEFAULT_SIZES = ['23/26', '27/30', '31/34', '35/38', '39/42', '43/46',
    '8 ANNI', '10 ANNI', '14 ANNI', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'UNICA'];
// Netto come nella Distinta: di default solo i "Nuovo"
const TEAM_NET_DEFAULT = ['Nuovo'];

function teamStockKey(col, size) {
    return `${col}|${size}`;
}

function teamLayout(reqsLordo, reqsNet, catalog, inventory) {
    const lordo = teamAggregate(reqsLordo, catalog);
    const net = teamAggregate(reqsNet, catalog);
    const groupOf = {};
    (catalog || []).forEach(a => { groupOf[a.nome] = a.gruppo; });
    [...reqsLordo, ...reqsNet].forEach(r => r.righe.forEach(x => { groupOf[teamColumnName(x)] = x.gruppo; }));
    const stockCols = [], stockSizes = [];
    Object.keys(inventory || {}).forEach(k => {
        const i = k.lastIndexOf('|');
        if (i > 0) { stockCols.push(k.slice(0, i)); stockSizes.push(k.slice(i + 1)); }
    });
    const columns = teamSortColumns([...(catalog || []).map(a => a.nome), ...lordo.columns, ...net.columns, ...stockCols], groupOf, catalog);
    const sizes = teamSortSizes([...TEAM_DEFAULT_SIZES, ...lordo.sizes, ...net.sizes, ...stockSizes]);
    return { columns, sizes, lordo, net };
}

function teamStock(inventory, col, size) {
    return parseInt((inventory || {})[teamStockKey(col, size)]) || 0;
}

function teamNetToBuy(layout, inventory, col, size) {
    const v = layout.net.cells[col] && layout.net.cells[col][size];
    return v ? Math.max(0, v.qta - teamStock(inventory, col, size)) : 0;
}

function teamMatrixHtml(mode, layout, inventory) {
    const { columns, lordo, net } = layout;
    // Lordo e Netto: solo le taglie richieste; Giacenza: tutte, per l'inventario
    const sizes = mode === 'GROSS' ? lordo.sizes : mode === 'NET' ? net.sizes : layout.sizes;
    if (!sizes.length) return `<p class="text-xs text-gray-500 p-2">${mode === 'NET' ? 'Niente da ordinare.' : 'Nessun articolo richiesto.'}</p>`;
    const bgHead = mode === 'INV' ? 'bg-yellow-50' : (mode === 'GROSS' ? 'bg-blue-50' : 'bg-gray-100');
    const head = `<th class="px-0 py-0 ${bgHead} sticky-col border-r shadow text-center align-middle text-sm font-bold">TAGLIA</th>` +
        columns.map(c => `<th class="border-l align-bottom pb-2 ${c.includes('da scegliere') ? 'bg-yellow-100 text-yellow-900' : 'bg-gray-50'}"><div class="vertical-header">${teamEsc(c)}</div></th>`).join('');
    const nums = (v) => v && v.numeri.length ? `<div class="text-[9px] font-normal text-blue-800 leading-tight">n° ${v.numeri.map(teamEsc).join(', ')}</div>` : '';
    const totals = {};
    const body = sizes.map((size, rowIdx) => {
        const alt = rowIdx % 2 === 1 ? (mode === 'INV' ? ' inv-row-alt' : mode === 'NET' ? ' net-row-alt' : '') : '';
        const bgCol = mode === 'INV' ? 'bg-yellow-50' : 'bg-white';
        return `<tr><td class="px-4 py-0 font-bold ${bgCol} sticky-col border-r shadow border-b${alt}">${teamEsc(size)}</td>` +
        columns.map(c => {
            let val = 0, cell;
            if (mode === 'GROSS') {
                const v = lordo.cells[c] && lordo.cells[c][size];
                val = v ? v.qta : 0;
                cell = v ? `<td class="text-center border-b border-l py-0 bg-blue-50 font-bold">${v.qta}${nums(v)}</td>`
                    : '<td class="text-center border-b border-l py-0">-</td>';
            } else if (mode === 'INV') {
                const raw = (inventory || {})[teamStockKey(c, size)];
                val = parseInt(raw) || 0;
                const toBuy = (net.cells[c] && net.cells[c][size]) ? net.cells[c][size].qta : 0;
                // Giallo: c'e' richiesta aperta E merce in magazzino, come nella Distinta
                const hl = toBuy > 0 && val > 0;
                const disabled = c.includes('da scegliere') ? 'disabled title="Scegli prima il modello nelle richieste"' : '';
                cell = `<td class="text-center border-b border-l py-0 ${hl ? 'inv-cell-needed' : 'bg-white' + alt}" ${hl ? `title="Richiesti (aperti): ${toBuy}, in magazzino: ${val}"` : ''}>
                    <input type="number" min="0" step="1" value="${raw !== undefined ? teamEsc(raw) : ''}" data-col="${teamEsc(c)}" data-size="${teamEsc(size)}"
                        onchange="teamSetStockFromInput(this)" class="inv-input" placeholder="-" ${disabled}></td>`;
            } else {
                val = teamNetToBuy(layout, inventory, c, size);
                const v = net.cells[c] && net.cells[c][size];
                cell = `<td class="text-center border-b border-l bg-white py-0${alt}"><span class="net-val ${val > 0 ? 'buy-alert' : 'buy-ok'}">${val > 0 ? val : '-'}</span>${val > 0 ? nums(v) : ''}</td>`;
            }
            totals[c] = (totals[c] || 0) + val;
            return cell;
        }).join('') + '</tr>';
    }).join('');
    const total = `<tr class="total-row"><td class="px-4 py-2 font-bold sticky-col border-r shadow">TOTALE</td>${columns.map(c => `<td class="text-center border-l p-2">${totals[c] || 0}</td>`).join('')}</tr>`;
    // table-layout fixed: tutte le colonne articolo larghe uguali
    return `<div style="overflow-x:auto; -webkit-overflow-scrolling:touch;"><table class="team-matrix min-w-full divide-y divide-gray-200 text-xs border mb-0" style="min-width:${55 + columns.length * 56}px">
        <thead class="${bgHead} sticky-header"><tr>${head}</tr></thead>
        <tbody class="divide-y divide-gray-200">${body}${total}</tbody></table></div>`;
}

async function teamSetStockFromInput(input) {
    const col = input.dataset.col, size = input.dataset.size;
    const key = teamStockKey(col, size);
    const raw = String(input.value).trim();
    const n = Number(raw);
    if (raw !== '' && (!Number.isInteger(n) || n < 0)) {
        teamNotify('Quantita\' non valida: inserisci un numero intero da 0 in su', 'error');
        input.value = teamState.inventory[key] ?? '';
        return;
    }
    const prev = teamState.inventory[key];
    if (raw === '') delete teamState.inventory[key]; else teamState.inventory[key] = n;
    teamRerenderKeepFocus();
    try {
        const res = await fetch('/api/orders?scope=team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set-stock', key, value: raw === '' ? null : n })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
        // Il server rimanda tutto il magazzino: dentro ci sono anche le celle
        // scritte nel frattempo da un altro dispositivo
        if (json.inventory) teamState.inventory = json.inventory;
        teamRerenderKeepFocus();
    } catch (e) {
        if (prev === undefined) delete teamState.inventory[key]; else teamState.inventory[key] = prev;
        teamRerenderKeepFocus();
        teamNotify('Giacenza non salvata: ' + e.message, 'error');
    }
}

// Il ridisegno ricrea le caselle: senza questo, chi passa con Tab alla cella
// successiva perderebbe il cursore a ogni numero inserito
function teamRerenderKeepFocus() {
    setTimeout(() => {
        const a = document.activeElement;
        const keep = a && a.classList && a.classList.contains('inv-input') && a.closest('#teamRequestsList')
            ? { col: a.dataset.col, size: a.dataset.size } : null;
        const keepFilter = a && a.dataset && a.dataset.filter && a.closest('#teamRequestsList')
            ? { k: a.dataset.filter, pos: a.selectionStart } : null;
        const scroll = [...document.querySelectorAll('#teamRequestsList [style*="overflow-x"]')].map(d => d.scrollLeft);
        renderTeamTab();
        document.querySelectorAll('#teamRequestsList [style*="overflow-x"]').forEach((d, i) => { if (scroll[i]) d.scrollLeft = scroll[i]; });
        if (keep) {
            const el = [...document.querySelectorAll('#teamRequestsList .inv-input')]
                .find(x => x.dataset.col === keep.col && x.dataset.size === keep.size);
            if (el) { el.focus(); el.select && el.select(); }
        }
        if (keepFilter) {
            const el = document.querySelector(`#teamRequestsList [data-filter="${keepFilter.k}"]`);
            if (el) {
                el.focus();
                if (el.setSelectionRange && keepFilter.pos != null) el.setSelectionRange(keepFilter.pos, keepFilter.pos);
            }
        }
    }, 0);
}

// ── Elenco richieste in tabella: chiusa = una riga col riassunto; aperta =
// una riga per articolo, i dati della richiesta uniti sulle sue righe ──────

// Numeri di maglia in breve: 1,2,3,5,7,8 -> "1-3, 5, 7-8"
function teamCompactNumbers(nums) {
    const n = [...new Set(nums.map(v => parseInt(v, 10)).filter(Number.isFinite))].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < n.length; i++) {
        let j = i;
        while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
        out.push(j > i ? `${n[i]}-${n[j]}` : `${n[i]}`);
        i = j;
    }
    return out.join(', ');
}

// Una riga per articolo: "Maglia CASTOLO Red Chinese — M ×20, L ×2 · n° 1-22"
function teamRequestSummaryHtml(r) {
    const byArt = new Map();
    r.righe.forEach(x => {
        const col = teamColumnName(x);
        const a = byArt.get(col) || { sizes: new Map(), numeri: [], daScegliere: !!x.daScegliere };
        const size = teamSizeKey(x.taglia);
        a.sizes.set(size, (a.sizes.get(size) || 0) + (Number(x.qta) || 0));
        if (x.numero) a.numeri.push(x.numero);
        byArt.set(col, a);
    });
    return [...byArt.entries()].map(([col, a]) => {
        const sizes = [...a.sizes.entries()]
            .sort((p, q) => teamSizeRank(p[0]) - teamSizeRank(q[0]))
            .map(([sz, q]) => sz === 'UNICA' ? `×${q}` : `${teamEsc(sz)} ×${q}`).join(', ');
        const nums = a.numeri.length ? ` <span class="text-blue-800">· n° ${teamEsc(teamCompactNumbers(a.numeri))}</span>` : '';
        const name = a.daScegliere
            ? `<span class="text-yellow-800 font-bold"><i class="fas fa-exclamation-triangle mr-1"></i>${teamEsc(col)}</span>`
            : `<b>${teamEsc(col)}</b>`;
        return `<div>${name} <span class="text-gray-400">—</span> ${sizes}${nums}</div>`;
    }).join('');
}

function teamToggleRequest(id) {
    if (teamState.expanded.has(id)) teamState.expanded.delete(id); else teamState.expanded.add(id);
    teamRerenderKeepFocus();
}

function teamRequestsTableHtml(reqs, allReqs) {
    const options = (gruppo) => teamState.catalog
        .filter(a => a.gruppo === gruppo)
        .map(a => `<option value="${teamEsc(a.nome)}">${teamEsc(a.nome)}</option>`).join('');
    const td = 'border px-2 py-1';
    const rows = reqs.map((r, ri) => {
        const st = TEAM_STATUSES.find(s => s.value === r.status);
        const stOptions = (st ? '' : `<option value="${teamEsc(r.status)}" selected>${teamEsc(r.status)}</option>`) +
            TEAM_STATUSES.map(s => `<option value="${teamEsc(s.value)}" ${s.value === r.status ? 'selected' : ''}>${teamEsc(s.label)}</option>`).join('');
        const rich = r.richiedente || {};
        const id = teamEsc(r.id);
        // Annullata o trasferita: resta visibile ma grigia e barrata, come in Tabella
        const rowClass = teamIsVoid(r) ? 'team-row-void' : (ri % 2 ? 'bg-gray-50' : 'bg-white');
        const open = teamState.expanded.has(r.id);
        const collapsed = !open && r.righe.length > 0;
        const righe = r.righe.length && open ? r.righe : [null];
        const span = righe.length;
        const pezzi = r.righe.reduce((n, x) => n + (Number(x.qta) || 0), 0);
        const toggle = r.righe.length ? `<div><button onclick="teamToggleRequest('${id}')" class="mt-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 whitespace-nowrap">
            <i class="fas fa-chevron-${open ? 'up' : 'down'} mr-1"></i>${open ? 'Comprimi' : `Dettaglio (${r.righe.length})`}</button></div>` : '';
        return righe.map((x, i) => {
            const art = !x ? '<span class="italic text-gray-400">Nessun articolo</span>'
                : x.daScegliere
                    ? `<select class="border border-yellow-500 bg-yellow-50 rounded px-1 py-0.5 text-xs max-w-full" onchange="teamChooseModel('${id}', ${i}, this.value)">
                         <option value="">${teamEsc(TEAM_GROUPS[x.gruppo] || x.gruppo)}: scegli modello...</option>${options(x.gruppo)}</select>`
                    : teamEsc(x.articolo);
            const first = i === 0 ? `
                <td class="${td} text-center whitespace-nowrap align-top" rowspan="${span}">${teamFormatDate(r.createdAt)}${toggle}</td>
                <td class="${td} text-left align-top" rowspan="${span}"><b>${teamEsc(rich.nome)} ${teamEsc(rich.cognome)}</b>
                    <div class="text-[10px] text-gray-500 break-all">${teamEsc(rich.email)}${rich.telefono ? '<br>' + teamEsc(rich.telefono) : ''}</div></td>
                <td class="${td} align-top" rowspan="${span}"><input class="border rounded px-1 py-0.5 w-28" value="${teamEsc(r.squadra)}" onchange="teamUpdateField('${id}', 'squadra', this.value.trim())">${r.sport ? `<div class="text-[10px] text-gray-500 mt-0.5">${teamEsc(r.sport)}</div>` : ''}</td>
                <td class="${td} align-top" rowspan="${span}"><select class="status-select border rounded p-1 text-xs ${st ? st.color : ''}" onchange="teamChangeStatus('${id}', this.value)">${stOptions}</select>${teamStatusNoteHtml(r, id)}</td>
                <td class="${td} align-top" rowspan="${span}"><select class="border rounded px-1 py-0.5" onchange="teamUpdateField('${id}', 'ruolo', this.value)">
                    ${teamRoleOptions(rich.ruolo).map(v => `<option value="${teamEsc(v)}" ${v === (rich.ruolo || '') ? 'selected' : ''}>${teamEsc(v) || '—'}</option>`).join('')}</select></td>` : '';
            const last = i === 0 ? `
                <td class="${td} text-left align-top text-[10px]" rowspan="${span}" style="max-width:160px">${teamEsc(r.note || '').replace(/\n/g, '<br>')}</td>
                <td class="${td} text-center align-top" rowspan="${span}">
                    <label class="team-switch" title="${r.archived ? 'In archivio: togli la spunta per riportarla tra le attive' : 'Sposta in archivio'}">
                        <input type="checkbox" ${r.archived ? 'checked' : ''} onchange="teamSetArchived('${id}', this.checked)"><span></span></label></td>
                <td class="${td} text-center align-top" rowspan="${span}"><button onclick="teamDeleteRequest('${id}')" class="text-red-600 hover:text-red-800" title="Elimina richiesta"><i class="fas fa-trash"></i></button></td>` : '';
            if (collapsed) {
                return `<tr class="${rowClass} team-req-first">${first}
                <td class="${td} text-left cursor-pointer hover:bg-blue-50" colspan="3" onclick="teamToggleRequest('${id}')" title="Clic per il dettaglio">${teamRequestSummaryHtml(r)}</td>
                <td class="${td} text-center font-bold">${pezzi}</td>${last}</tr>`;
            }
            return `<tr class="${rowClass}${i === 0 ? ' team-req-first' : ''}">${first}
                <td class="${td} text-left">${art}</td>
                <td class="${td} text-center">${x ? teamEsc(x.taglia || '-') : ''}</td>
                <td class="${td} text-center">${x && x.numero ? teamEsc(x.numero) : ''}</td>
                <td class="${td} text-center font-bold">${x ? teamEsc(x.qta) : ''}</td>${last}</tr>`;
        }).join('');
    }).join('');
    const th = 'border px-2 py-1 bg-gray-200 text-black font-bold';
    const empty = `<tr><td colspan="12" class="border p-4 text-center text-gray-500">Nessuna richiesta corrisponde ai filtri.</td></tr>`;
    return `<div style="overflow-x:auto; -webkit-overflow-scrolling:touch;"><table class="min-w-full text-xs border team-requests-table">
        <thead><tr><th class="${th}">Data</th><th class="${th}">Richiedente</th><th class="${th}">Squadra</th><th class="${th}">Stato</th><th class="${th}">Ruolo</th>
            <th class="${th}">Articolo</th><th class="${th}">Taglia</th><th class="${th}">N°</th><th class="${th}">Q.tà</th><th class="${th}">Note</th><th class="${th}">Archivio</th><th class="${th}"></th></tr>
            ${teamFilterRowHtml(allReqs || reqs)}</thead>
        <tbody>${rows || empty}</tbody></table></div>`;
}

// ── Filtri per colonna di Richieste ─────────────────────────────────────────

const TEAM_FILTER_FIELDS = ['data', 'richiedente', 'squadra', 'stato', 'ruolo', 'articolo', 'taglia', 'numero', 'note'];

function teamRoleOptions(current) {
    const base = ['', 'Dirigente', 'Allenatore', 'Magazziniere'];
    return current && !base.includes(current) ? [...base, current] : base;
}

// Una richiesta passa se soddisfa TUTTI i filtri compilati. Articolo, taglia e
// numero bastano su una riga qualsiasi dell'ordine.
function teamMatchFilters(r, f) {
    const has = (v, q) => teamNorm(v).includes(teamNorm(q));
    const rich = r.richiedente || {};
    const righe = r.righe || [];
    if (f.data && !has(teamFormatDate(r.createdAt), f.data)) return false;
    if (f.richiedente && !has([rich.nome, rich.cognome, rich.email, rich.telefono].join(' '), f.richiedente)) return false;
    if (f.squadra && !has([r.squadra, r.sport].join(' '), f.squadra)) return false;
    if (f.stato && r.status !== f.stato) return false;
    if (f.ruolo && (f.ruolo === '-' ? !!rich.ruolo : (rich.ruolo || '') !== f.ruolo)) return false;
    if (f.articolo && !righe.some(x => has(teamColumnName(x), f.articolo))) return false;
    if (f.taglia && !righe.some(x => teamNorm(teamSizeKey(x.taglia)) === teamNorm(f.taglia) || has(x.taglia, f.taglia))) return false;
    if (f.numero && !righe.some(x => x.numero && String(x.numero) === String(f.numero).trim())) return false;
    if (f.note && !has(r.note, f.note)) return false;
    return true;
}

function teamFilterRowHtml(reqs) {
    const f = teamState.colFilters;
    const cell = 'border px-1 py-1 bg-gray-100';
    const inp = (k, ph, w) => `<input data-filter="${k}" class="team-col-filter border rounded px-1 py-0.5 w-full font-normal" style="min-width:${w}px"
        placeholder="${ph}" value="${teamEsc(f[k] || '')}" oninput="teamSetColFilter('${k}', this.value)">`;
    const ruoli = [...new Set(reqs.map(r => (r.richiedente || {}).ruolo).filter(Boolean))].sort();
    const sel = (k, opts) => `<select data-filter="${k}" class="team-col-filter border rounded px-1 py-0.5 w-full font-normal" onchange="teamSetColFilter('${k}', this.value)">
        <option value="">Tutti</option>${opts.map(([v, l]) => `<option value="${teamEsc(v)}" ${v === (f[k] || '') ? 'selected' : ''}>${teamEsc(l)}</option>`).join('')}</select>`;
    const any = TEAM_FILTER_FIELDS.some(k => f[k]);
    return `<tr class="team-filter-row">
        <th class="${cell}">${inp('data', 'gg/mm', 70)}</th>
        <th class="${cell}">${inp('richiedente', 'nome...', 90)}</th>
        <th class="${cell}">${inp('squadra', 'squadra/sport', 90)}</th>
        <th class="${cell}">${sel('stato', TEAM_STATUSES.map(s => [s.value, s.label]))}</th>
        <th class="${cell}">${sel('ruolo', [...ruoli.map(v => [v, v]), ['-', 'Non indicato']])}</th>
        <th class="${cell}">${inp('articolo', 'articolo...', 90)}</th>
        <th class="${cell}">${inp('taglia', 'M', 40)}</th>
        <th class="${cell}">${inp('numero', 'n°', 30)}</th>
        <th class="${cell}"></th>
        <th class="${cell}">${inp('note', 'note...', 60)}</th>
        <th class="${cell}" colspan="2">${any ? `<button onclick="teamClearColFilters()" class="text-[10px] text-red-700 font-bold whitespace-nowrap" title="Togli tutti i filtri"><i class="fas fa-times mr-1"></i>Filtri</button>` : ''}</th>
    </tr>`;
}

function teamSetColFilter(k, v) {
    if (v) teamState.colFilters[k] = v; else delete teamState.colFilters[k];
    teamRerenderKeepFocus();
}

function teamClearColFilters() {
    teamState.colFilters = {};
    renderTeamTab();
}

// ── Archivio ────────────────────────────────────────────────────────────────

function setTeamView(v) {
    teamState.view = v === 'archivio' ? 'archivio' : 'attive';
    renderTeamTab();
}

async function teamSetArchived(id, on) {
    const r = teamFind(id);
    if (!r) return;
    r.archived = !!on;
    r.archivedAt = on ? new Date().toISOString() : null;
    await teamSaveAndRender();
    teamNotify(on ? 'Richiesta spostata in archivio' : 'Richiesta riportata tra le attive');
}

// ── Nota sullo stato, come in Gestione ordini ───────────────────────────────

// In Gestione chiedono la nota "Manca qualcosa?" questi tre stati
const TEAM_NOTE_STATUSES = ['In Lavorazione', 'Pronto', 'Consegna Parziale'];
let teamStatusNoteCtx = null;

function teamStatusNoteHtml(r, id) {
    if (!r.statusNote || !TEAM_NOTE_STATUSES.includes(r.status)) return '';
    return `<div class="team-status-note mt-1 bg-amber-50 border border-amber-300 rounded p-1 cursor-pointer hover:bg-amber-100 text-left"
            onclick="teamOpenStatusNote('${id}', '${teamEsc(r.status)}')" title="Clicca per modificare">
        <div class="text-[10px] font-bold text-amber-800"><i class="fas fa-box-open mr-1"></i>Manca:</div>
        <div class="text-[10px] text-amber-700 whitespace-pre-line" style="max-width:150px">${teamEsc(r.statusNote)}</div></div>`;
}

async function teamChangeStatus(id, value) {
    const r = teamFind(id);
    if (!r) return;
    if (TEAM_NOTE_STATUSES.includes(value)) { teamOpenStatusNote(id, value); return; }
    r.status = value;
    await teamSaveAndRender();
}

function teamOpenStatusNote(id, status) {
    const r = teamFind(id);
    const modal = document.getElementById('teamStatusNotePopup');
    if (!r || !modal) return;
    teamStatusNoteCtx = { id, status };
    document.getElementById('teamStatusNoteTitle').textContent = `${status} - Manca Qualcosa?`;
    document.getElementById('teamStatusNoteText').value = r.statusNote || '';
    modal.classList.add('active');
    setTimeout(() => document.getElementById('teamStatusNoteText').focus(), 50);
}

// Annulla: lo stato resta quello di prima (il ridisegno rimette la tendina)
function teamCloseStatusNote() {
    const modal = document.getElementById('teamStatusNotePopup');
    if (modal) modal.classList.remove('active');
    teamStatusNoteCtx = null;
    renderTeamTab();
}

async function teamSaveStatusNote() {
    const c = teamStatusNoteCtx;
    const r = c && teamFind(c.id);
    if (!r) { teamCloseStatusNote(); return; }
    const note = document.getElementById('teamStatusNoteText').value.trim();
    if (c.status === 'Consegna Parziale' && !note && !confirm('Nessuna nota inserita. Vuoi confermare comunque?')) return;
    r.status = c.status;
    r.statusNote = note || null;
    document.getElementById('teamStatusNotePopup').classList.remove('active');
    teamStatusNoteCtx = null;
    await teamSaveAndRender();
    teamNotify(`Stato "${c.status}" salvato`);
}

function teamPreviewHtml() {
    const p = teamState.preview;
    if (!p) return '';
    const elenco = p.nuove.map(r => {
        const pezzi = r.righe.reduce((s, x) => s + x.qta, 0);
        return `<li>${teamEsc(r.richiedente.nome)} ${teamEsc(r.richiedente.cognome)} — ${teamEsc(r.squadra || 'senza squadra')} — ${pezzi} pezzi${r.avvisi.length ? ' <span class="text-yellow-700">(da controllare)</span>' : ''}</li>`;
    }).join('');
    return `<div class="bg-purple-50 border border-purple-300 rounded p-3 mb-3 text-sm">
        <div class="font-bold text-purple-900 mb-1">Anteprima importazione</div>
        <div>${p.nuove.length} nuove richieste · ${p.giaPresenti} gia' importate o eliminate${p.senzaData ? ` · ${p.senzaData} righe senza data` : ''}</div>
        ${p.completate ? `<div class="text-xs text-blue-800">${p.completate} richieste gia' importate verranno completate con ruolo e sport dal foglio</div>` : ''}
        ${elenco ? `<ul class="list-disc ml-5 my-2 text-xs">${elenco}</ul>` : ''}
        ${p.colonneIgnote.length ? `<div class="text-xs text-red-700 my-1"><b>Colonne del foglio non riconosciute</b> (non importate): ${p.colonneIgnote.map(teamEsc).join(', ')}</div>` : ''}
        <div class="flex gap-2 mt-2">
            ${p.nuove.length || p.completate ? `<button onclick="confirmTeamImport()" class="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded font-bold text-xs">Conferma importazione</button>` : ''}
            <button onclick="cancelTeamImport()" class="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-xs">${p.nuove.length || p.completate ? 'Annulla' : 'Chiudi'}</button>
        </div></div>`;
}

function teamCatalogHtml() {
    if (!teamState.showCatalog) return '';
    const rows = teamState.catalog.map((a, i) => `<tr data-i="${i}" class="border-t align-top">
        <td class="p-1"><input data-f="nome" class="border rounded px-1 py-0.5 w-full" value="${teamEsc(a.nome)}"></td>
        <td class="p-1"><select data-f="gruppo" class="border rounded px-1 py-0.5">
            ${Object.entries(TEAM_GROUPS).map(([k, v]) => `<option value="${k}" ${k === a.gruppo ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td class="p-1"><select data-f="sport" class="border rounded px-1 py-0.5">
            ${TEAM_SPORTS.map(s => `<option value="${s}" ${s === (a.sport || '') ? 'selected' : ''}>${s || 'Calcio / tutti'}</option>`).join('')}</select></td>
        <td class="p-1"><textarea data-f="alias" rows="1" class="border rounded px-1 py-0.5 w-full">${teamEsc((a.alias || []).join('\n'))}</textarea></td>
        <td class="p-1 text-center"><button onclick="teamCatalogRemove(${i})" class="text-red-600" title="Rimuovi"><i class="fas fa-times"></i></button></td>
    </tr>`).join('');
    return `<div class="bg-white rounded shadow p-3 mb-3">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-2">
            <div><div class="font-bold text-blue-900">Catalogo squadra</div>
            <div class="text-xs text-gray-500">Testo nel modulo = come compare l'articolo nel modulo Google (uno per riga). Serve all'import per riconoscerlo.</div></div>
            <div class="flex gap-2">
                <button onclick="teamCatalogAdd()" class="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-xs"><i class="fas fa-plus mr-1"></i>Articolo</button>
                <button onclick="saveTeamCatalog()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-bold"><i class="fas fa-save mr-1"></i>Salva catalogo</button>
            </div></div>
        <div class="overflow-x-auto"><table class="w-full text-xs">
            <thead class="bg-gray-100"><tr><th class="p-1 text-left">Articolo</th><th class="p-1">Gruppo</th><th class="p-1">Sport</th><th class="p-1 text-left">Testo nel modulo</th><th></th></tr></thead>
            <tbody id="teamCatalogBody">${rows}</tbody></table></div></div>`;
}

function renderTeamTab() {
    const list = document.getElementById('teamRequestsList');
    if (!list) return;
    document.getElementById('teamPreview').innerHTML = teamPreviewHtml();
    document.getElementById('teamCatalog').innerHTML = teamCatalogHtml();

    const sel = document.getElementById('teamFilterStatus');
    if (sel) {
        if (sel.options.length < 2) {
            sel.innerHTML = '<option value="tutte">Tutte</option>' +
                TEAM_STATUSES.map(s => `<option value="${teamEsc(s.value)}">${teamEsc(s.label)}</option>`).join('');
        }
        if (TEAM_LEGACY_STATUS[teamState.filter]) teamState.filter = TEAM_LEGACY_STATUS[teamState.filter];
        sel.value = teamState.filter;
    }
    // Archivio: le richieste archiviate escono dalle attive (e dai totali) ma
    // restano consultabili nella vista Archivio, con i loro riepiloghi
    const inView = teamState.requests.filter(r => !!r.archived === (teamState.view === 'archivio'));
    const byStatus = inView
        .filter(r => teamState.filter === 'tutte' || r.status === teamState.filter)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const reqs = byStatus.filter(r => teamMatchFilters(r, teamState.colFilters));
    const nArch = teamState.requests.filter(r => r.archived).length;
    const counter = document.getElementById('teamCounter');
    if (counter) {
        const nuove = teamState.requests.filter(r => !r.archived && r.status === 'Nuovo').length;
        counter.textContent = `${teamState.requests.length - nArch} richieste attive · ${nuove} nuove · ${nArch} in archivio`;
    }
    const viewBtn = (v, label, n) => `<button onclick="setTeamView('${v}')" class="px-3 py-1 text-xs font-bold ${teamState.view === v ? 'bg-blue-700 text-white' : 'bg-white text-blue-800 hover:bg-blue-50'}">${label} (${n})</button>`;
    const viewSwitch = `<div class="inline-flex border border-blue-700 rounded overflow-hidden">${viewBtn('attive', 'Attive', teamState.requests.length - nArch)}${viewBtn('archivio', 'Archivio', nArch)}</div>`;
    // Netto: con "tutte" contano le richieste ancora aperte, altrimenti lo stato scelto
    const lordoReqs = reqs.filter(r => !teamIsVoid(r));
    const netReqs = teamState.filter === 'tutte'
        ? reqs.filter(r => TEAM_NET_DEFAULT.includes(r.status))
        : lordoReqs;
    const layout = teamLayout(lordoReqs, netReqs, teamState.catalog, teamState.inventory);
    const box = (title, icon, color, html) => `
        <div class="bg-white rounded shadow px-2 pt-2 pb-0 mb-3">
            <div class="section-title ${color} mb-2"><span><i class="fas ${icon} mr-2"></i> ${title}</span></div>
            ${html}
        </div>`;
    const netLabel = teamState.filter === 'tutte' ? 'richieste Nuovo' : 'stato filtrato';
    list.innerHTML =
        `<div class="bg-white rounded shadow px-2 pt-2 pb-2 mb-3">
            <div class="section-title text-blue-900 mb-2 flex flex-wrap items-center justify-between gap-2"><span><i class="fas fa-clipboard-list mr-2"></i> 1. Richieste${teamState.view === 'archivio' ? ' in archivio' : ''}</span>${viewSwitch}</div>
            ${byStatus.length ? teamRequestsTableHtml(reqs, byStatus)
                : `<p class="text-sm text-gray-500 p-4 text-center">${teamState.view === 'archivio' ? 'Nessuna richiesta in archivio.' : 'Nessuna richiesta. Usa "Importa materiale squadra" per leggere il modulo Google.'}</p>`}
        </div>` +
        box('2. Riepilogo Richieste (Lordo)', 'fa-list-alt', 'text-blue-900', teamMatrixHtml('GROSS', layout, teamState.inventory)) +
        box('3. Giacenza Magazzino Squadre', 'fa-warehouse', 'text-yellow-800', teamMatrixHtml('INV', layout, teamState.inventory)) +
        box(`4. Da ordinare (Netto: ${netLabel} meno giacenza)`, 'fa-truck', 'text-red-800', teamMatrixHtml('NET', layout, teamState.inventory)) +
        '<div class="mb-6"></div>';
}

function setTeamFilter(v) {
    teamState.filter = v;
    renderTeamTab();
}

function openTeamTab() {
    if (!teamState.loaded) loadTeamData();
    else renderTeamTab();
}
