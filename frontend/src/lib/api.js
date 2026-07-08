const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export async function compareProduct(query, country) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, country }),
    });
  } catch {
    throw new Error(`Can't reach the backend at ${API_BASE}. Is the backend server running?`);
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}
