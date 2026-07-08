const COUNTRIES = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'in', name: 'India' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'ae', name: 'UAE' },
  { code: 'sg', name: 'Singapore' },
  { code: 'jp', name: 'Japan' },
];

async function reverseGeocode(lat, lon) {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
  );
  if (!res.ok) throw new Error('reverse geocode failed');
  const data = await res.json();
  if (!data.countryCode) throw new Error('no country in reverse geocode response');
  return { countryCode: data.countryCode.toLowerCase(), countryName: data.countryName, source: 'gps' };
}

async function ipLocate() {
  const res = await fetch('https://ipwho.is/');
  if (!res.ok) throw new Error('ip lookup failed');
  const data = await res.json();
  if (!data.success || !data.country_code) throw new Error('ip lookup returned no country');
  return { countryCode: data.country_code.toLowerCase(), countryName: data.country, source: 'ip' };
}

function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { timeout: 5000 }
    );
  });
}

export async function detectLocation() {
  try {
    const coords = await getBrowserPosition();
    return await reverseGeocode(coords.latitude, coords.longitude);
  } catch {
    try {
      return await ipLocate();
    } catch {
      return { countryCode: 'us', countryName: 'United States', source: 'default' };
    }
  }
}

export { COUNTRIES };
