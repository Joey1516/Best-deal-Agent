import { useEffect, useRef, useState } from 'react';
import { detectLocation, COUNTRIES } from './lib/geo';
import { compareProduct } from './lib/api';
import { getSpeechRecognition, speak, describeBestDeal } from './lib/voice';
import './App.css';

export default function App() {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('us');
  const [locationLabel, setLocationLabel] = useState('Detecting location…');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [bestDeal, setBestDeal] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    detectLocation().then((loc) => {
      setCountry(loc.countryCode);
      setLocationLabel(
        loc.source === 'default'
          ? 'Could not detect location — defaulted to United States'
          : `Detected: ${loc.countryName}`
      );
    });
  }, []);

  useEffect(() => {
    recognitionRef.current = getSpeechRecognition();
  }, []);

  async function runSearch(searchQuery) {
    const q = (searchQuery ?? query).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setBestDeal(null);
    try {
      const data = await compareProduct(q, country);
      setResults(data.results);
      setBestDeal(data.bestDeal);
      setFromCache(!!data.cached);
      speak(describeBestDeal(data.bestDeal, data.resultCount));
    } catch (err) {
      setError(err.message);
      speak('Sorry, something went wrong while comparing prices.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    runSearch();
  }

  function handleVoiceSearch() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('Voice search is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    setListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      runSearch(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  return (
    <div className="app">
      <header>
        <h1>Looking for best deals?</h1>
        <h3 className= "tagline">Let me do that for you...</h3>
        <p className="tagline">Compare a product's price across stores and find the best deal — by text or voice.</p>
      </header>

      <form className="search-row" onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Sony WH-1000XM5 headphones"
          aria-label="Product search"
        />
        <button type="button" className={`mic-btn ${listening ? 'listening' : ''}`} onClick={handleVoiceSearch} title="Search by voice">
          {listening ? '● Listening…' : '🎤'}
        </button>
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Compare Prices'}
        </button>
      </form>

      {loading && <p className="loading-hint">Checking stores… first search for a product can take up to 30s.</p>}

      <div className="location-row">
        <span>{locationLabel}</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="error">{error}</div>}

      {bestDeal && (
        <div className="best-deal-card">
          <div className="badge">{fromCache ? 'Best Deal ⚡ cached' : 'Best Deal'}</div>
          <h2>{bestDeal.title}</h2>
          <p className="price">{bestDeal.displayPrice}</p>
          <p className="store">at {bestDeal.store}</p>
          {bestDeal.rating && (
            <p className="rating">
              ⭐ {bestDeal.rating} ({bestDeal.reviews ?? 0} reviews)
            </p>
          )}
          {bestDeal.delivery && <p className="delivery">{bestDeal.delivery}</p>}
          <a href={bestDeal.link} target="_blank" rel="noreferrer">
            {bestDeal.linkType === 'store' ? `Buy at ${bestDeal.store} →` : 'View on Google Shopping →'}
          </a>
        </div>
      )}

      {results.length > 1 && (
        <div className="results-list">
          <h3>All offers ({results.length})</h3>
          {results.slice(1).map((r, i) => (
            <div className="result-row" key={i}>
              <div className="result-title">{r.title}</div>
              <div className="result-store">{r.store}</div>
              <div className="result-price">{r.displayPrice}</div>
              <a href={r.link} target="_blank" rel="noreferrer">
                {r.linkType === 'store' ? 'Buy →' : 'Google →'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
