export function getSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

// Known high-quality female voices across Chrome/macOS/Windows/Android, in preference order.
const PREFERRED_FEMALE_VOICES = [
  'Google US English Female',
  'Google UK English Female',
  'Samantha',
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Zira Desktop - English (United States)',
  'Microsoft Zira',
  'Victoria',
  'Karen',
  'Moira',
  'Tessa',
  'Google US English',
];

function getVoices() {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function pickFemaleVoice(voices, lang) {
  for (const name of PREFERRED_FEMALE_VOICES) {
    const match = voices.find((v) => v.name === name);
    if (match) return match;
  }
  const byKeyword = voices.find(
    (v) => v.lang?.startsWith(lang.slice(0, 2)) && /female/i.test(v.name)
  );
  if (byKeyword) return byKeyword;
  return voices.find((v) => v.lang?.startsWith(lang.slice(0, 2))) ?? null;
}

export async function speak(text, lang = 'en-US') {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.pitch = 1.05;
  utterance.rate = 1;

  const voices = await getVoices();
  const voice = pickFemaleVoice(voices, lang);
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

export function describeBestDeal(bestDeal, resultCount) {
  if (!bestDeal) return "I couldn't find any prices for that product.";
  const priceText = bestDeal.displayPrice || `$${bestDeal.price}`;
  return `I compared ${resultCount} offers. The best deal is at ${bestDeal.store} for ${priceText}.`;
}
