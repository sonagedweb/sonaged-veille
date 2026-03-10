// api/news.js — Vercel Serverless Function
// Agrège Google News RSS + NewsAPI + Reddit pour SONAGED S.A

const KEYWORDS = [
  'SONAGED', 'SONAGED Sénégal', 'gestion déchets Dakar',
  'déchets Sénégal', 'collecte ordures Dakar', 'Mbeubeuss'
];

// ─── CORS HEADERS ──────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 's-maxage=900, stale-while-revalidate' // Cache 15 min Vercel Edge
};

// ─── SENTIMENT ANALYSIS (simple keyword-based) ─────────
const POSITIVE_WORDS = ['succès','bravo','félicitations','amélioration','progrès','propre','efficace','innovation','réussi','excellent','bien','positif','développement','modernisation','performance'];
const NEGATIVE_WORDS = ['scandale','problème','crise','échec','dysfonctionnement','sale','ordures','plainte','critique','mauvais','insuffisant','grève','retard','dégradation','défaillance'];

function analyzeSentiment(text) {
  const t = text.toLowerCase();
  const pos = POSITIVE_WORDS.filter(w => t.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter(w => t.includes(w)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

function detectCategory(text) {
  const t = text.toLowerCase();
  if (t.includes('loi') || t.includes('décret') || t.includes('réglementation') || t.includes('ministère') || t.includes('arrêté') || t.includes('journal officiel')) return 'legal';
  if (t.includes('onas') || t.includes('veolia') || t.includes('suez') || t.includes('concurrent') || t.includes('appel d\'offre')) return 'competitor';
  return 'press';
}

// ─── SOURCE 1: GOOGLE NEWS RSS ─────────────────────────
async function fetchGoogleNews(keyword) {
  try {
    const encoded = encodeURIComponent(keyword);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=fr&gl=SN&ceid=SN:fr`;
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SONAGED-Veille/1.0)' },
      signal: AbortSignal.timeout(8000)
    });
    const xml = await res.text();
    
    const items = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    
    for (const match of itemMatches) {
      const item = match[1];
      const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1] || '';
      const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
      const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
      const source = (item.match(/<source[^>]*>(.*?)<\/source>/) || item.match(/- (.*?)$/))?.[1] || 'Google News';
      const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1] || '';
      
      if (title && title.length > 5) {
        const cleanTitle = title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').split(' - ')[0].trim();
        const cleanDesc = description.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').substring(0,200);
        
        items.push({
          id: `gnews-${Date.now()}-${Math.random().toString(36).substr(2,6)}`,
          title: cleanTitle,
          description: cleanDesc,
          url: link,
          source: source.replace(/&amp;/g,'&').trim(),
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          type: detectCategory(cleanTitle + ' ' + cleanDesc),
          sentiment: analyzeSentiment(cleanTitle + ' ' + cleanDesc),
          origin: 'Google News',
          keyword
        });
      }
    }
    return items.slice(0, 8);
  } catch (e) {
    console.error('Google News error:', e.message);
    return [];
  }
}

// ─── SOURCE 2: NEWSAPI ──────────────────────────────────
async function fetchNewsAPI(keyword) {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) return [];
  
  try {
    const encoded = encodeURIComponent(keyword);
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const url = `https://newsapi.org/v2/everything?q=${encoded}&from=${from}&sortBy=publishedAt&language=fr&apiKey=${apiKey}&pageSize=10`;
    
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    
    if (!data.articles) return [];
    
    return data.articles.map(a => ({
      id: `newsapi-${Date.now()}-${Math.random().toString(36).substr(2,6)}`,
      title: a.title || '',
      description: (a.description || '').substring(0, 200),
      url: a.url,
      source: a.source?.name || 'NewsAPI',
      publishedAt: a.publishedAt,
      type: detectCategory((a.title || '') + ' ' + (a.description || '')),
      sentiment: analyzeSentiment((a.title || '') + ' ' + (a.description || '')),
      origin: 'NewsAPI',
      keyword
    })).filter(a => a.title && a.title !== '[Removed]');
  } catch (e) {
    console.error('NewsAPI error:', e.message);
    return [];
  }
}

// ─── SOURCE 3: REDDIT ───────────────────────────────────
async function fetchReddit(keyword) {
  try {
    const encoded = encodeURIComponent(keyword);
    const url = `https://www.reddit.com/search.json?q=${encoded}&sort=new&limit=10&t=month`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SONAGED-Veille/1.0' },
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    
    if (!data.data?.children) return [];
    
    return data.data.children
      .filter(p => p.data.title)
      .map(p => ({
        id: `reddit-${p.data.id}`,
        title: p.data.title,
        description: (p.data.selftext || '').substring(0, 200),
        url: `https://reddit.com${p.data.permalink}`,
        source: `r/${p.data.subreddit}`,
        publishedAt: new Date(p.data.created_utc * 1000).toISOString(),
        type: 'social',
        sentiment: analyzeSentiment(p.data.title + ' ' + (p.data.selftext || '')),
        origin: 'Reddit',
        score: p.data.score,
        keyword
      }));
  } catch (e) {
    console.error('Reddit error:', e.message);
    return [];
  }
}

// ─── SOURCE 4: GDELT ────────────────────────────────────
async function fetchGDELT(keyword) {
  try {
    const encoded = encodeURIComponent(`"${keyword}"`);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encoded}&mode=artlist&maxrecords=10&format=json&sourcelang=french`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    
    if (!data.articles) return [];
    
    return data.articles.map(a => ({
      id: `gdelt-${Date.now()}-${Math.random().toString(36).substr(2,6)}`,
      title: a.title || '',
      description: '',
      url: a.url,
      source: a.domain || 'GDELT',
      publishedAt: a.seendate ? 
        new Date(a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')).toISOString() 
        : new Date().toISOString(),
      type: detectCategory(a.title || ''),
      sentiment: analyzeSentiment(a.title || ''),
      origin: 'GDELT',
      keyword
    })).filter(a => a.title);
  } catch (e) {
    console.error('GDELT error:', e.message);
    return [];
  }
}

// ─── DEDUPLICATION ──────────────────────────────────────
function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.toLowerCase().substring(0, 60).replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── COMPUTE STATS ──────────────────────────────────────
function computeStats(articles) {
  const total = articles.length;
  const positive = articles.filter(a => a.sentiment === 'positive').length;
  const negative = articles.filter(a => a.sentiment === 'negative').length;
  const neutral = articles.filter(a => a.sentiment === 'neutral').length;
  
  const byType = {
    press: articles.filter(a => a.type === 'press').length,
    social: articles.filter(a => a.type === 'social').length,
    legal: articles.filter(a => a.type === 'legal').length,
    competitor: articles.filter(a => a.type === 'competitor').length,
  };
  
  const bySource = {};
  articles.forEach(a => {
    bySource[a.origin] = (bySource[a.origin] || 0) + 1;
  });

  const score = total === 0 ? 50 : Math.round(
    50 + (positive - negative) / total * 50
  );
  
  return { total, positive, negative, neutral, byType, bySource, reputationScore: Math.max(0, Math.min(100, score)) };
}

// ─── MAIN HANDLER ───────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS).end();
  }
  
  Object.entries(CORS).forEach(([k,v]) => res.setHeader(k, v));
  
  try {
    // Fetch from all sources in parallel
    const allPromises = KEYWORDS.flatMap(kw => [
      fetchGoogleNews(kw),
      fetchGDELT(kw),
      fetchReddit(kw),
      ...(process.env.NEWSAPI_KEY ? [fetchNewsAPI(kw)] : []),
    ]);
    
    const results = await Promise.allSettled(allPromises);
    const allArticles = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
    
    // Sort by date, deduplicate
    const sorted = deduplicateArticles(
      allArticles
        .filter(a => a.title && a.title.length > 10)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    );
    
    const stats = computeStats(sorted);
    
    return res.status(200).json({
      success: true,
      fetchedAt: new Date().toISOString(),
      stats,
      articles: sorted.slice(0, 60),
      sources: {
        googleNews: sorted.filter(a => a.origin === 'Google News').length,
        gdelt: sorted.filter(a => a.origin === 'GDELT').length,
        reddit: sorted.filter(a => a.origin === 'Reddit').length,
        newsapi: sorted.filter(a => a.origin === 'NewsAPI').length,
      }
    });
    
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
