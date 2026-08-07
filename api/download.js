const APPS = {
  ekippp:        { repo: 'ViniDevvv/EKIPPP',             asset: 'EKIPPP.exe' },
  optimizer:     { repo: 'ViniDevvv/EKIPPP-OPTIMIZER',    asset: 'EKIPPP-OPTIMIZER.exe' },
  straff:        { repo: 'ViniDevvv/EKIPPP-STRAFF',       asset: 'Ekippp.Straff.exe' },
  antifk:        { repo: 'ViniDevvv/EKIPPP-ANTIFK',       asset: 'Ekippp.Anti-AFK.exe' },
  montage:       { repo: 'ViniDevvv/EkipppClipMontage',   asset: 'EkipppMontage.exe' },
  convertisseur: { repo: 'ViniDevvv/EkipppConvertisseur', asset: 'EkipppConvertisseur.exe' },
  downloader:    { repo: 'ViniDevvv/EkipppDownloader',    asset: 'EkipppDownloader.exe' },
  macrostraff:   { repo: 'ViniDevvv/EkipppMacroStraff',   asset: 'EkipppMacroStraff.exe' },
};

// Proxy de telechargement : cache le depot/organisation GitHub au visiteur.
// Le navigateur ne voit jamais github.com/ViniDevvv/... — seulement /api/download?app=...
// puis une redirection vers une URL de stockage signee, generique et temporaire.
export default async function handler(req, res) {
  const entry = APPS[req.query.app];
  if (!entry) {
    res.status(404).send('App inconnue.');
    return;
  }

  const headers = {
    'User-Agent': 'ekippp-site-download-proxy',
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  try {
    const relRes = await fetch(`https://api.github.com/repos/${entry.repo}/releases/latest`, { headers });
    if (!relRes.ok) throw new Error(`releases/latest ${relRes.status}`);
    const release = await relRes.json();

    const asset = release.assets.find(a => a.name === entry.asset);
    if (!asset) throw new Error('asset introuvable');

    // Demander le binaire (pas le JSON de metadonnees) renvoie une redirection
    // vers l'URL de stockage signee finale.
    const assetRes = await fetch(asset.url, {
      headers: { ...headers, Accept: 'application/octet-stream' },
      redirect: 'manual',
    });
    const location = assetRes.headers.get('location');
    if (!location) throw new Error('pas de redirection recue');

    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(302, { Location: location });
    res.end();
  } catch (err) {
    res.status(502).send('Telechargement indisponible pour le moment, reessaie dans quelques instants.');
  }
}
