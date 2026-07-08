import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = 'johnvc~google-shopping-api-google-shopping-products-prices-deals';

function computeMedian(numbers) {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// The Apify actor only returns a Google Shopping redirect link, not the merchant's
// own page. For well-known retailers we can send the user straight to that store's
// own search results for the product instead of via Google — free, no extra API calls.
const STORE_SEARCH_URLS = [
  { match: /amazon/i, url: (q) => `https://www.amazon.com/s?k=${q}` },
  { match: /walmart/i, url: (q) => `https://www.walmart.com/search?q=${q}` },
  { match: /\btarget\b/i, url: (q) => `https://www.target.com/s?searchTerm=${q}` },
  { match: /best ?buy/i, url: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${q}` },
  { match: /\bebay\b/i, url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}` },
  { match: /costco/i, url: (q) => `https://www.costco.com/CatalogSearch?keyword=${q}` },
  { match: /home ?depot/i, url: (q) => `https://www.homedepot.com/s/${q}` },
  { match: /lowe'?s/i, url: (q) => `https://www.lowes.com/search?searchTerm=${q}` },
  { match: /macy'?s/i, url: (q) => `https://www.macys.com/shop/search?keyword=${q}` },
  { match: /kohl'?s/i, url: (q) => `https://www.kohls.com/search.jsp?search=${q}` },
  { match: /newegg/i, url: (q) => `https://www.newegg.com/p/pl?d=${q}` },
  { match: /\betsy\b/i, url: (q) => `https://www.etsy.com/search?q=${q}` },
  { match: /sam'?s club/i, url: (q) => `https://www.samsclub.com/s/${q}` },
  { match: /wayfair/i, url: (q) => `https://www.wayfair.com/keyword.php?keyword=${q}` },
  { match: /\bibq\b|ikea/i, url: (q) => `https://www.ikea.com/us/en/search/?q=${q}` },
];

function resolveLink(storeName, title, fallbackLink) {
  const rule = STORE_SEARCH_URLS.find((r) => r.match.test(storeName));
  if (!rule) return { link: fallbackLink, linkType: 'google' };
  return { link: rule.url(encodeURIComponent(title)), linkType: 'store' };
}

// Cache identical (query, country) searches briefly so repeat lookups skip the
// ~20-30s Apify run entirely instead of paying that latency and cost again.
const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

app.post('/api/compare', async (req, res) => {
  const { query, country = 'us', language = 'en' } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: 'Server is missing APIFY_TOKEN. Add it to backend/.env' });
  }

  const cacheKey = `${query.trim().toLowerCase()}|${country}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ ...cached, cached: true });
  }

  try {
    const apifyUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
    const apifyRes = await fetch(apifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: country, hl: language }),
    });

    if (!apifyRes.ok) {
      const text = await apifyRes.text();
      return res.status(502).json({ error: 'Price lookup failed', detail: text.slice(0, 500) });
    }

    const items = await apifyRes.json();
    const raw = items[0]?.shopping_results ?? [];

    const parsed = raw
      .filter((r) => typeof r.extracted_price === 'number' && r.extracted_price > 0 && r.source && r.title)
      .map((r) => {
        const { link, linkType } = resolveLink(r.source, r.title, r.product_link);
        return {
          title: r.title,
          store: r.source,
          price: r.extracted_price,
          displayPrice: r.price,
          oldPrice: r.extracted_old_price ?? null,
          rating: r.rating ?? null,
          reviews: r.reviews ?? null,
          delivery: r.delivery ?? null,
          link,
          linkType,
          thumbnail: r.thumbnail ?? null,
        };
      });

    // Google Shopping mixes in mismatched/junk listings (e.g. a $20 "offer" for a
    // $250 product from an obscure domain). Those aren't real deals, so drop prices
    // far below the median before ranking — a genuine best deal stays within a
    // plausible range of the pack, it doesn't undercut it by 5-10x.
    const median = computeMedian(parsed.map((r) => r.price));
    const results = (median ? parsed.filter((r) => r.price >= median * 0.5) : parsed).sort(
      (a, b) => a.price - b.price
    );

    const bestDeal = results[0] ?? null;
    const payload = { query, country, resultCount: results.length, bestDeal, results };

    cache.set(cacheKey, { data: payload, time: Date.now() });
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error', detail: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
