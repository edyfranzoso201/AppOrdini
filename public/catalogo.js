        // Carica i dati del catalogo da Redis
        async function loadCatalog() {
            try {
                const response = await fetch('/api/config');
                if (!response.ok) {
                    throw new Error(`Errore HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                if (!data.success || !data.data) {
                    throw new Error('Risposta API non valida');
                }
                
                const catalog = data.data.catalog || {};
                
                // Nascondi placeholder
                document.getElementById('catalogPlaceholder').style.display = 'none';
                
                // ═══════ RENDERIZZA PACCHETTI KIT ═══════
                if (catalog.kits) {
                    renderKits(catalog.kits, catalog.qrUrl);
                }
                
                // Aggiorna titolo e sottotitolo
                if (catalog.title) {
                    document.getElementById('catalogTitle').textContent = catalog.title;
                }
                
                // Mostra logo (se presente)
                if (catalog.logo && catalog.logo.trim() !== '') {
                    const logoImg = document.getElementById('catalogLogo');
                    logoImg.src = catalog.logo;
                    logoImg.style.display = 'block';
                }
                
                // Mostra link catalogo completo (se presente)
                if (catalog.fullCatalogUrl && catalog.fullCatalogUrl.trim() !== '') {
                    const linkSection = document.getElementById('fullCatalogLink');
                    const link = linkSection.querySelector('a');
                    link.href = catalog.fullCatalogUrl;
                    linkSection.style.display = 'block';
                }
                
                // Mostra QR Code E link cliccabile (se presente)
                if (catalog.qrUrl && catalog.qrUrl.trim() !== '') {
                    const qrSection = document.getElementById('qrCodeSection');
                    const qrImg = document.getElementById('qrCodeImage');
                    const orderLink = document.getElementById('orderFormLink');
                    
                    qrImg.src = catalog.qrUrl;
                    
                    // Estrai l'URL del Google Form dall'immagine QR Code generata da QuickChart
                    const urlMatch = catalog.qrUrl.match(/text=([^&]+)/);
                    if (urlMatch) {
                        const formUrl = decodeURIComponent(urlMatch[1]);
                        orderLink.href = formUrl;
                        console.log('✅ Link ordini estratto:', formUrl);
                    }
                    
                    qrSection.style.display = 'block';
                }
                
                // Mostra nota informativa (se presente)
                if (catalog.orderNote && catalog.orderNote.trim() !== '') {
                    const noteSection = document.getElementById('orderNoteSection');
                    const noteText = document.getElementById('orderNote');
                    noteText.textContent = catalog.orderNote;
                    noteSection.style.display = 'block';
                }
                
                // Renderizza articoli
                const container = document.getElementById('catalogItems');
                const noItemsMsg = document.getElementById('noItemsMessage');
                
                if (catalog.items && catalog.items.length > 0) {
                    container.style.display = 'grid';
                    container.innerHTML = '';
                    
                    catalog.items.forEach(item => {
                        const card = document.createElement('div');
                        card.className = 'bg-blue-900 rounded-lg shadow-2xl hover:shadow-3xl transition transform hover:-translate-y-2 overflow-hidden border-4 border-white';
                        
                        card.innerHTML = `
                            <div class="aspect-square bg-gradient-to-br from-blue-700 to-blue-800 flex items-center justify-center p-8">
                                ${item.images && item.images.length > 0 ? 
                                    `<img src="${item.images[0]}" alt="${item.name}" class="w-full h-full object-contain" onerror="this.parentElement.innerHTML='<svg class=\\'w-20 h-20 text-white\\' fill=\\'currentColor\\' viewBox=\\'0 0 20 20\\'><path d=\\'M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z\\'/></svg>';">` :
                                    `<svg class="w-20 h-20 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                                    </svg>`
                                }
                            </div>
                            <div class="p-4 bg-blue-900">
                                <h3 class="font-bold text-red-600 text-xl mb-2 line-clamp-2">${escapeHtml(item.name)}</h3>
                                ${item.description ? 
                                    `<p class="text-sm text-white mb-3 line-clamp-3">${escapeHtml(item.description)}</p>` : 
                                    ''
                                }
                                <div class="flex items-center justify-between">
                                    ${item.price ? 
                                        `<p class="text-2xl font-bold text-white">€ ${item.price}</p>` : 
                                        '<span></span>'
                                    }
                                    ${item.images && item.images.length > 1 ? 
                                        `<button onclick='showGallery(${JSON.stringify(item.images)}, "${escapeHtml(item.name)}")' 
                                                class="text-blue-300 hover:text-blue-100 text-sm transition">
                                            <i class="fas fa-images"></i> Vedi ${item.images.length} foto
                                        </button>` : 
                                        ''
                                    }
                                </div>
                            </div>
                        `;
                        
                        container.appendChild(card);
                    });
                } else {
                    // Nessun articolo
                    noItemsMsg.style.display = 'block';
                }
                
            } catch (error) {
                console.error('❌ Errore caricamento catalogo:', error);
                document.getElementById('catalogPlaceholder').innerHTML = `
                    <div class="text-center py-12">
                        <div class="text-red-500 mb-4">
                            <i class="fas fa-exclamation-triangle text-6xl"></i>
                        </div>
                        <p class="text-white font-bold text-lg mb-2">Errore nel caricamento del catalogo</p>
                        <p class="text-gray-300 text-sm">${error.message}</p>
                        <button onclick="loadCatalog()" class="mt-4 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold transition shadow-lg">
                            <i class="fas fa-redo mr-2"></i>Riprova
                        </button>
                    </div>
                `;
            }
        }
        
        // ═══════════════════════════════════════════════════════════
        // RENDERIZZA PACCHETTI KIT
        // ═══════════════════════════════════════════════════════════
        function renderKits(kitsData, orderUrl) {
            const kitsSection = document.getElementById('kitsSection');
            const kitsGrid = document.getElementById('kitsGrid');
            
            // Filtra solo i kit con almeno un articolo
            const kitsWithItems = Object.entries(kitsData || {}).filter(([key, kit]) => kit.items && kit.items.length > 0);
            
            if (kitsWithItems.length === 0) {
                return; // Non mostrare la sezione se non ci sono kit
            }
            
            const kitColors = {
                kit_completo_campo: { 
                    bg: 'from-blue-600 to-blue-800', 
                    border: 'border-blue-300',
                    badge: 'bg-blue-500',
                    icon: 'fa-running',
                    text: 'text-blue-100'
                },
                kit_completo_portiere: { 
                    bg: 'from-green-600 to-green-800', 
                    border: 'border-green-300',
                    badge: 'bg-green-500',
                    icon: 'fa-hands',
                    text: 'text-green-100'
                },
                mini_kit_campo: { 
                    bg: 'from-purple-600 to-purple-800', 
                    border: 'border-purple-300',
                    badge: 'bg-purple-500',
                    icon: 'fa-tshirt',
                    text: 'text-purple-100'
                },
                mini_kit_portiere: { 
                    bg: 'from-yellow-600 to-yellow-800', 
                    border: 'border-yellow-300',
                    badge: 'bg-yellow-500',
                    icon: 'fa-save',
                    text: 'text-yellow-100'
                },
                kit_generico: { 
                    bg: 'from-gray-600 to-gray-800', 
                    border: 'border-gray-300',
                    badge: 'bg-gray-500',
                    icon: 'fa-box',
                    text: 'text-gray-100'
                }
            };
            
            const html = kitsWithItems.map(([key, kit]) => {
                const colors = kitColors[key] || kitColors.kit_generico;
                const totalPrice = kit.items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
                
                return `
                    <div class="bg-gradient-to-br ${colors.bg} rounded-xl shadow-2xl hover:shadow-3xl transition transform hover:-translate-y-2 overflow-hidden border-4 ${colors.border}">
                        <!-- Header Kit -->
                        <div class="p-6 border-b-4 ${colors.border}">
                            <div class="flex items-center gap-3 mb-3">
                                <div class="${colors.badge} rounded-full p-3">
                                    <i class="fas ${colors.icon} text-white text-2xl"></i>
                                </div>
                                <h3 class="text-2xl font-bold text-white flex-1">${escapeHtml(kit.name)}</h3>
                            </div>
                            ${kit.description ? `
                                <p class="${colors.text} text-sm leading-relaxed">${escapeHtml(kit.description)}</p>
                            ` : ''}
                        </div>
                        
                        <!-- Articoli inclusi -->
                        <div class="p-6 space-y-3">
                            <h4 class="text-white font-bold text-sm uppercase tracking-wide mb-3">
                                <i class="fas fa-check-circle mr-1"></i>Articoli inclusi:
                            </h4>
                            ${kit.items.map(item => `
                                <div class="flex items-start gap-3 bg-white bg-opacity-10 backdrop-blur-sm p-3 rounded-lg border border-white border-opacity-20">
                                    ${item.image 
                                        ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" class="w-20 h-20 object-cover rounded border-2 border-white flex-shrink-0">`
                                        : `<div class="w-20 h-20 bg-white bg-opacity-20 rounded flex items-center justify-center border-2 border-white border-opacity-30 flex-shrink-0">
                                            <i class="fas fa-tshirt text-white text-2xl"></i>
                                           </div>`
                                    }
                                    <div class="flex-1 min-w-0">
                                        <p class="font-bold text-white text-sm mb-1">${escapeHtml(item.name)}</p>
                                        ${item.description ? `<p class="text-xs ${colors.text} leading-relaxed mb-1">${escapeHtml(item.description)}</p>` : ''}
                                        <!-- prezzo singolo articolo nascosto nel kit -->
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <!-- Footer con prezzo e bottone -->
                        <div class="p-6 bg-black bg-opacity-20 border-t-4 ${colors.border}">
                            ${kit.discountedPrice ? `
                                <div class="flex items-center justify-between mb-4 bg-white bg-opacity-15 rounded-lg px-3 py-2">
                                    <span class="text-white font-bold">Prezzo kit:</span>
                                    <span class="text-3xl font-bold text-yellow-300 drop-shadow">€${parseFloat(kit.discountedPrice).toFixed(2)}</span>
                                </div>
                            ` : ''}
                            <a href="${orderUrl || '#'}" 
                               target="_blank"
                               class="block w-full text-center bg-white hover:bg-opacity-90 text-blue-900 font-bold py-4 px-6 rounded-lg transition shadow-lg">
                                <i class="fas fa-shopping-cart mr-2"></i>Ordina questo kit
                            </a>
                        </div>
                    </div>
                `;
            }).join('');
            
            kitsGrid.innerHTML = html;
            kitsSection.style.display = 'block';
        }
        
        // Funzione helper per escape HTML (prevenzione XSS)
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Mostra galleria immagini in popup
        function showGallery(images, itemName) {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4';
            modal.onclick = () => modal.remove();
            
            let imageHTML = '';
            images.forEach((img, index) => {
                imageHTML += `
                    <div class="w-full max-w-2xl mb-4">
                        <img src="${img}" alt="${itemName} - Foto ${index + 1}" 
                             class="w-full rounded-lg shadow-2xl">
                    </div>
                `;
            });
            
            modal.innerHTML = `
                <div class="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl p-6" 
                     onclick="event.stopPropagation()">
                    <div class="flex justify-between items-center mb-4 sticky top-0 bg-white pb-4 border-b">
                        <h3 class="text-2xl font-bold text-gray-900">${itemName}</h3>
                        <button onclick="this.closest('.fixed').remove()" 
                                class="text-gray-500 hover:text-gray-700 text-3xl">
                            ✕
                        </button>
                    </div>
                    <div class="space-y-4">
                        ${imageHTML}
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
        
        // Carica il catalogo all'avvio
        window.addEventListener('DOMContentLoaded', loadCatalog);
