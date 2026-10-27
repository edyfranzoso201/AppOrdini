// ─────────────────────────────────────────────────────────────────────────────
// Catalogo Squadra: come il Catalogo dell'abbigliamento (QR/link al modulo,
// titolo, logo, nota d'ordine, kit con prezzi, articoli) ma per il materiale
// di squadra. Salvato a parte (/api/config?scope=team, POST solo admin) e
// pubblicato su /catalogo.html?tipo=squadra.
// ─────────────────────────────────────────────────────────────────────────────

const TC_KITS = [
    { key: 'kit_completo_campo', name: 'Kit Completo Giocatore da Campo', icon: 'fa-running', color: 'blue' },
    { key: 'kit_completo_portiere', name: 'Kit Completo Portiere', icon: 'fa-hands', color: 'green' },
    { key: 'mini_kit_campo', name: 'Mini Kit Giocatore da Campo', icon: 'fa-tshirt', color: 'purple' },
    { key: 'mini_kit_portiere', name: 'Mini Kit Portiere', icon: 'fa-save', color: 'yellow' },
    { key: 'kit_generico', name: 'Kit Generico', icon: 'fa-box', color: 'gray' }
];
// Classi scritte per intero: Tailwind CDN non vede quelle composte a runtime
const TC_KIT_CLASS = {
    blue: ['bg-blue-50 hover:bg-blue-100', 'text-blue-900', 'bg-blue-50 border-blue-200'],
    green: ['bg-green-50 hover:bg-green-100', 'text-green-900', 'bg-green-50 border-green-200'],
    purple: ['bg-purple-50 hover:bg-purple-100', 'text-purple-900', 'bg-purple-50 border-purple-200'],
    yellow: ['bg-yellow-50 hover:bg-yellow-100', 'text-yellow-900', 'bg-yellow-50 border-yellow-200'],
    gray: ['bg-gray-50 hover:bg-gray-100', 'text-gray-900', 'bg-gray-50 border-gray-200']
};

const tcState = {
    data: null,
    loaded: false,
    openKits: {}
};

function tcEsc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tcImg(url) {
    return typeof proxyImageUrl === 'function' ? proxyImageUrl(url) : url;
}

function tcNotify(msg, type) {
    if (typeof showQuickNotification === 'function') showQuickNotification(msg, type || 'success');
    else alert(msg);
}

function tcNormalize(c) {
    const d = { title: 'Catalogo Squadra', logo: '', qrUrl: '', fullCatalogUrl: '', orderNote: '', items: [], kits: {}, ...(c || {}) };
    if (!Array.isArray(d.items)) d.items = [];
    if (!d.kits || typeof d.kits !== 'object') d.kits = {};
    TC_KITS.forEach(k => {
        const kit = d.kits[k.key] || {};
        d.kits[k.key] = { name: kit.name || k.name, description: kit.description || '', discountedPrice: kit.discountedPrice ?? null, items: Array.isArray(kit.items) ? kit.items : [] };
    });
    return d;
}

async function openTeamCatalogTab() {
    if (tcState.loaded) return tcRender();
    const box = document.getElementById('tab-squadre-catalogo');
    if (box) box.innerHTML = '<div class="bg-white p-4 rounded shadow text-sm text-gray-500">Caricamento Catalogo Squadra...</div>';
    try {
        const res = await fetch('/api/config?scope=team');
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
        tcState.data = tcNormalize(json.data && json.data.catalog);
        tcState.loaded = true;
        tcRender();
    } catch (e) {
        if (box) box.innerHTML = `<div class="bg-white p-4 rounded shadow text-sm text-red-600">Errore nel caricamento del Catalogo Squadra: ${tcEsc(e.message)}
            <button onclick="openTeamCatalogTab()" class="ml-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">Riprova</button></div>`;
    }
}

// opts.clearItems: l'admin ha tolto l'ultimo articolo di proposito (il server
// altrimenti conserva gli articoli salvati davanti a una lista vuota)
async function tcSave(opts) {
    const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-team-catalog', catalog: { ...tcState.data, clearItems: !!(opts && opts.clearItems) } })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
}

async function tcSaveQuiet(opts) {
    try {
        await tcSave(opts);
    } catch (e) {
        alert('Salvataggio Catalogo Squadra non riuscito: ' + e.message);
    }
}

function tcSetField(field, value) {
    tcState.data[field] = String(value || '').trim();
}

async function tcSaveConfig() {
    try {
        await tcSave();
        tcNotify('Catalogo Squadra salvato');
    } catch (e) {
        alert('Salvataggio Catalogo Squadra non riuscito: ' + e.message);
    }
}

function tcPublicUrl() {
    return window.location.origin + '/catalogo.html?tipo=squadra';
}

async function tcOpenPreview() {
    // La finestra si apre subito: Safari blocca window.open dopo un await
    const win = window.open('about:blank', '_blank');
    try {
        await tcSave();
        if (win) win.location.href = tcPublicUrl();
        else window.open(tcPublicUrl(), '_blank');
    } catch (e) {
        if (win) win.close();
        alert('Salvataggio Catalogo Squadra non riuscito: ' + e.message);
    }
}

function tcCopyLink() {
    const url = tcPublicUrl();
    navigator.clipboard.writeText(url).then(() => tcNotify('Link copiato negli appunti!'))
        .catch(() => prompt('Copia questo link:', url));
}

// ── Kit ─────────────────────────────────────────────────────────────────────

function tcToggleKit(key) {
    tcState.openKits[key] = !tcState.openKits[key];
    tcRender();
}

function tcKitName(key, value) {
    const v = String(value || '').trim();
    if (!v) return; // un titolo vuoto non finisce nel catalogo pubblico
    tcState.data.kits[key].name = v;
    const h = document.getElementById('tc-header-' + key);
    if (h) h.textContent = v;
}

function tcKitPrice(key, value) {
    const p = parseFloat(value);
    tcState.data.kits[key].discountedPrice = isNaN(p) ? null : p;
}

function tcKitSnapshot(item) {
    return { name: item.name, image: (item.images || [])[0] || '', images: item.images || [], description: item.description || '', price: item.price };
}

function tcKitToggleItem(key, idx, checked) {
    const item = tcState.data.items[idx];
    if (!item) return;
    const kit = tcState.data.kits[key];
    kit.items = kit.items.filter(i => i.name !== item.name);
    if (checked) kit.items.push(tcKitSnapshot(item));
    tcRender();
}

// ── Articoli ────────────────────────────────────────────────────────────────

// I kit tengono una copia dell'articolo: si aggiorna insieme all'originale
function tcSyncKits(oldName, item) {
    Object.values(tcState.data.kits).forEach(kit => {
        kit.items = kit.items.map(i => i.name === oldName ? tcKitSnapshot(item) : i);
    });
}

async function tcUpdateItem(idx, field, value) {
    const item = tcState.data.items[idx];
    if (!item) return;
    const oldName = item.name;
    item[field] = field === 'price' ? (parseFloat(value) || 0) : String(value || '').trim();
    tcSyncKits(oldName, item);
    tcRender();
    await tcSaveQuiet();
}

async function tcAddItem() {
    tcState.data.items.push({ name: 'Nuovo Articolo', description: '', price: 0, images: [] });
    tcRender();
    await tcSaveQuiet();
}

async function tcRemoveItem(idx) {
    const item = tcState.data.items[idx];
    if (!item || !confirm(`Rimuovere "${item.name}" dal Catalogo Squadra?`)) return;
    tcState.data.items.splice(idx, 1);
    Object.values(tcState.data.kits).forEach(kit => { kit.items = kit.items.filter(i => i.name !== item.name); });
    tcRender();
    await tcSaveQuiet({ clearItems: tcState.data.items.length === 0 });
}

function tcEditImages(idx) {
    const item = tcState.data.items[idx];
    if (!item) return;
    tcCloseImages();
    const wrap = document.createElement('div');
    wrap.id = 'tcImagesModal';
    // items-start + my-auto: con zoom alto la cima del box resta raggiungibile
    wrap.className = 'fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-start justify-center overflow-y-auto p-4';
    wrap.innerHTML = `<div class="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full my-auto">
        <h3 class="text-xl font-bold mb-4 text-gray-900"><i class="fas fa-images text-blue-600 mr-2"></i>Immagini: ${tcEsc(item.name)}</h3>
        <p class="text-sm text-gray-600 mb-3">Inserisci gli URL delle immagini (uno per riga, max 3):</p>
        <textarea id="tcImagesTextarea" rows="6" class="w-full border rounded p-3 font-mono text-sm">${tcEsc((item.images || []).join('\n'))}</textarea>
        <div class="flex justify-end gap-2 mt-4">
            <button onclick="tcCloseImages()" class="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold">Annulla</button>
            <button onclick="tcSaveImages(${idx})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"><i class="fas fa-save mr-2"></i>Salva</button>
        </div></div>`;
    document.body.appendChild(wrap);
    document.getElementById('tcImagesTextarea').focus();
}

function tcCloseImages() {
    const el = document.getElementById('tcImagesModal');
    if (el) el.remove();
}

async function tcSaveImages(idx) {
    const item = tcState.data.items[idx];
    const ta = document.getElementById('tcImagesTextarea');
    if (!item || !ta) return;
    item.images = ta.value.split('\n').map(u => u.trim()).filter(Boolean).slice(0, 3);
    tcSyncKits(item.name, item);
    tcCloseImages();
    tcRender();
    await tcSaveQuiet();
}

// Importa gli articoli del DB squadra (pulsante DB della Distinta Squadre)
async function tcImportFromDB() {
    if (!confirm('Importare gli articoli dal DB squadra? Gli articoli gia presenti restano.')) return;
    if (typeof teamState === 'undefined') return alert('DB squadra non disponibile');
    if (!teamState.loaded && typeof loadTeamData === 'function') await loadTeamData();
    let added = 0;
    (teamState.catalog || []).forEach(a => {
        const name = String(a.nome || '').trim();
        if (!name || tcState.data.items.some(i => i.name === name)) return;
        tcState.data.items.push({ name, description: '', price: 0, images: [] });
        added++;
    });
    tcRender();
    if (added) await tcSaveQuiet();
    tcNotify(added ? `Importati ${added} articoli dal DB squadra` : 'Nessun articolo nuovo da importare');
}

// ── Render ──────────────────────────────────────────────────────────────────

function tcKitHtml(k, n) {
    const d = tcState.data;
    const kit = d.kits[k.key];
    const [btnCls, txtCls, boxCls] = TC_KIT_CLASS[k.color];
    const open = !!tcState.openKits[k.key];
    const selected = kit.items;
    const preview = selected.length ? `<div class="mb-4 p-3 rounded border ${boxCls}">
            <p class="text-xs font-bold ${txtCls} mb-2 uppercase">Articoli selezionati per questo kit:</p>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-2">${selected.map(i => `
                <div class="bg-white rounded-lg p-2 shadow-sm border">
                    ${i.image ? `<img src="${tcEsc(tcImg(i.image))}" class="w-full h-24 object-cover rounded mb-1">`
                        : '<div class="w-full h-24 bg-gray-200 rounded mb-1 flex items-center justify-center"><i class="fas fa-tshirt text-gray-400 text-2xl"></i></div>'}
                    <p class="text-xs font-semibold text-gray-900 truncate" title="${tcEsc(i.name)}">${tcEsc(i.name)}</p>
                    ${i.price ? `<p class="text-xs font-bold text-blue-600 mt-1">${tcEsc(i.price)}€</p>` : ''}
                </div>`).join('')}</div></div>` : '';
    const list = d.items.length ? d.items.map((item, idx) => {
        const img = (item.images || [])[0];
        const checked = selected.some(i => i.name === item.name);
        return `<label class="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer transition">
            <input type="checkbox" ${checked ? 'checked' : ''} onchange="tcKitToggleItem('${k.key}', ${idx}, this.checked)" class="w-5 h-5 flex-shrink-0">
            ${img ? `<img src="${tcEsc(tcImg(img))}" class="w-16 h-16 object-cover rounded flex-shrink-0">`
                : '<div class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0"><i class="fas fa-tshirt text-gray-400"></i></div>'}
            <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900">${tcEsc(item.name)}</p>
                ${item.description ? `<p class="text-xs text-gray-500 truncate">${tcEsc(item.description)}</p>` : ''}
                ${item.price ? `<p class="text-xs font-bold text-blue-600 mt-1">${tcEsc(item.price)}€</p>` : ''}
            </div></label>`;
    }).join('') : `<div class="text-center py-8 text-gray-500"><i class="fas fa-box-open text-4xl mb-2"></i>
            <p class="text-sm">Nessun articolo nel Catalogo Squadra.</p><p class="text-xs">Aggiungi articoli nella sezione qui sotto.</p></div>`;
    return `<div class="border rounded mb-3">
        <button onclick="tcToggleKit('${k.key}')" class="w-full px-4 py-3 ${btnCls} flex items-center justify-between transition">
            <span class="font-bold ${txtCls}"><i class="fas ${k.icon} mr-2"></i>${n}. <span id="tc-header-${k.key}">${tcEsc(kit.name)}</span>${selected.length ? ` <span class="text-xs font-normal">(${selected.length} articoli)</span>` : ''}</span>
            <i class="fas ${open ? 'fa-chevron-up' : 'fa-chevron-down'} ${txtCls}"></i>
        </button>
        ${open ? `<div class="p-4">
            <div class="mb-4">
                <label class="block text-sm font-bold text-gray-700 mb-2">Nome kit (mostrato nel catalogo pubblico)</label>
                <input type="text" value="${tcEsc(kit.name)}" onchange="tcKitName('${k.key}', this.value)" class="border rounded p-2 w-full md:w-96">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-bold text-gray-700 mb-2">Prezzo kit (€)</label>
                <input type="number" min="0" step="0.01" value="${kit.discountedPrice ?? ''}" onchange="tcKitPrice('${k.key}', this.value)" class="border rounded p-2 w-full md:w-48">
            </div>
            ${preview}
            <label class="block text-sm font-bold text-gray-700 mb-2">Seleziona articoli da includere</label>
            <div class="space-y-2 max-h-96 overflow-y-auto">${list}</div>
        </div>` : ''}
    </div>`;
}

function tcItemsHtml() {
    const items = tcState.data.items;
    if (!items.length) {
        return `<div class="text-center text-gray-400 py-8 col-span-full"><i class="fas fa-box-open text-4xl mb-2"></i>
            <p>Nessun articolo. Clicca "Aggiungi Articolo" o "Importa da DB".</p></div>`;
    }
    return items.map((item, idx) => {
        const imgs = (item.images || []).length
            ? item.images.map(u => `<img src="${tcEsc(tcImg(u))}" alt="${tcEsc(item.name)}" onclick="openImageLightbox(this.dataset.url)" data-url="${tcEsc(u)}">`).join('')
            : `<div class="catalog-item-placeholder"><i class="fas fa-tshirt text-3xl mb-2"></i><br>${tcEsc(item.name)}</div>`;
        return `<div class="catalog-item-card">
            <div class="catalog-item-images">${imgs}</div>
            <div class="p-3">
                <input type="text" value="${tcEsc(item.name)}" placeholder="Nome articolo"
                    class="w-full font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none mb-2"
                    onchange="tcUpdateItem(${idx}, 'name', this.value)">
                <textarea placeholder="Descrizione o link..." rows="2" class="w-full text-xs text-gray-600 border rounded p-1 resize-none mb-2"
                    onchange="tcUpdateItem(${idx}, 'description', this.value)">${tcEsc(item.description)}</textarea>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-500">€</span>
                        <input type="number" value="${tcEsc(item.price || 0)}" class="w-16 text-lg font-bold text-green-600 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none"
                            onchange="tcUpdateItem(${idx}, 'price', this.value)">
                    </div>
                    <div class="flex gap-1">
                        <button onclick="tcEditImages(${idx})" class="text-blue-500 hover:text-blue-700 px-2 py-1" title="Gestisci immagini"><i class="fas fa-images"></i></button>
                        <button onclick="tcRemoveItem(${idx})" class="text-red-500 hover:text-red-700 px-2 py-1" title="Rimuovi"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div></div>`;
    }).join('');
}

function tcRender() {
    const box = document.getElementById('tab-squadre-catalogo');
    if (!box || !tcState.data) return;
    const d = tcState.data;
    // Il render ricrea gli input: si conserva lo scroll della pagina
    const y = window.scrollY;
    box.innerHTML = `
    <div class="bg-white p-4 rounded shadow mb-4">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
                <h2 class="font-bold text-xl text-emerald-800"><i class="fas fa-book-open mr-2"></i>Catalogo Squadra</h2>
                <p class="text-xs text-gray-500">Catalogo pubblico del materiale squadra, separato dal catalogo abbigliamento</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <button onclick="tcOpenPreview()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold transition"><i class="fas fa-eye mr-2"></i>Anteprima Catalogo</button>
                <button onclick="tcCopyLink()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold transition"><i class="fas fa-link mr-2"></i>Copia Link</button>
                <button onclick="tcSaveConfig()" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-bold transition"><i class="fas fa-save mr-2"></i>Salva Catalogo</button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded border">
            <div>
                <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fas fa-qrcode mr-1"></i>Link al modulo ordini (QR)</label>
                <input type="text" id="tcQrUrlInput" value="${tcEsc(d.qrUrl)}" placeholder="https://forms.gle/..." onchange="tcSetField('qrUrl', this.value)" class="w-full border rounded px-3 py-2 text-sm">
                <p class="text-xs text-gray-500 mt-1">Link al modulo (il QR si genera da solo) o URL di un'immagine QR (es. quickchart.io/qr?text=...)</p>
            </div>
            <div>
                <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fas fa-external-link-alt mr-1"></i>Link Catalogo Completo (opzionale)</label>
                <input type="text" id="tcFullUrlInput" value="${tcEsc(d.fullCatalogUrl)}" placeholder="https://..." onchange="tcSetField('fullCatalogUrl', this.value)" class="w-full border rounded px-3 py-2 text-sm">
                <p class="text-xs text-gray-500 mt-1">Link a un catalogo PDF o sito esterno</p>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-emerald-50 rounded border border-emerald-200">
            <div>
                <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fas fa-heading mr-1"></i>Titolo Catalogo</label>
                <input type="text" id="tcTitleInput" value="${tcEsc(d.title)}" placeholder="Catalogo Materiale Squadra" onchange="tcSetField('title', this.value)" class="w-full border rounded px-3 py-2 text-sm">
            </div>
            <div>
                <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fas fa-image mr-1"></i>Logo/Immagine Header (URL)</label>
                <input type="text" id="tcLogoInput" value="${tcEsc(d.logo)}" placeholder="https://..." onchange="tcSetField('logo', this.value)" class="w-full border rounded px-3 py-2 text-sm">
            </div>
        </div>
        <div class="p-4 bg-yellow-50 rounded border border-yellow-200">
            <label class="block text-sm font-bold text-gray-700 mb-2"><i class="fas fa-info-circle mr-1"></i>Nota Informativa Ordini (opzionale)</label>
            <textarea id="tcNoteInput" maxlength="300" onchange="tcSetField('orderNote', this.value)" placeholder="Es: Le richieste di materiale vengono evase a fine mese." class="w-full border rounded px-3 py-2 text-sm h-20">${tcEsc(d.orderNote)}</textarea>
            <p class="text-xs text-gray-500 mt-1">Appare sotto il pulsante "Clicca qui per Ordinare" nel catalogo pubblico. Max 300 caratteri.</p>
        </div>
    </div>
    <div class="bg-white p-4 rounded shadow mb-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
                <h3 class="font-bold text-lg text-gray-800"><i class="fas fa-box-open mr-2"></i>Configurazione Pacchetti Kit</h3>
                <p class="text-xs text-gray-500">Articoli e prezzo di ogni kit; visibili nella pagina pubblica dopo "Salva Catalogo".</p>
            </div>
        </div>
        ${TC_KITS.map((k, i) => tcKitHtml(k, i + 1)).join('')}
    </div>
    <div class="bg-white p-4 rounded shadow mb-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 class="font-bold text-lg text-gray-800"><i class="fas fa-th-large mr-2"></i>Articoli nel Catalogo Squadra (${d.items.length})</h3>
            <div class="flex gap-2">
                <button onclick="tcAddItem()" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold"><i class="fas fa-plus mr-1"></i>Aggiungi Articolo</button>
                <button onclick="tcImportFromDB()" class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1.5 rounded text-sm font-bold"><i class="fas fa-database mr-1"></i>Importa da DB</button>
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">${tcItemsHtml()}</div>
    </div>`;
    window.scrollTo(0, y);
}
