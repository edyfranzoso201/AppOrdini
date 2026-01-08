export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Ritorna configurazione vuota per evitare errori
  return res.status(200).json({
    success: true,
    data: {
      globalItems: [],
      globalKitTypes: {}
    }
  });
}