// Proxy immagini: alcuni CDN (es. kappa.com) bloccano il caricamento diretto nel browser
// (ERR_BLOCKED_BY_ORB / referrer check), ma permettono richieste server-to-server.
// Whitelist di host consentiti per evitare che l'endpoint diventi un proxy aperto.
const ALLOWED_HOSTS = [
  'www.kappa.com',
  'kappa.com',
  'cdn.shopify.com',
  'cdn.blazimg.com',
  'www.kappateamsports.com',
  'kappateamsports.com',
  'game-prod.fr'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: 'Parametro url mancante' });
  }

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: 'URL non valido' });
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.includes(target.hostname)) {
    return res.status(403).json({ success: false, error: 'Host non consentito' });
  }

  try {
    const upstream = await fetch(target.href, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrderFlowImageProxy/1.0)' }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ success: false, error: 'Immagine non disponibile' });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Image proxy error:', error);
    return res.status(502).json({ success: false, error: 'Errore nel recupero immagine' });
  }
}
