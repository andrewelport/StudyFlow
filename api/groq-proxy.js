// Legacy filename — internally calls Google Gemini, not Groq.
// Kept as "groq-proxy" so the 8 callers in app_v58.js (callAI → /api/groq-proxy)
// continue to work without touching client code.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    // 503 maps cleanly to callAI's "service unavailable" branch in app_v58.js
    return res.status(503).json({ error: 'GEMINI_API_KEY is not set on server' });
  }

  try {
    const { messages, temperature, json, maxTokens, responseSchema } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const geminiBody = buildGeminiBody({ messages, temperature, json, maxTokens, responseSchema });

    const geminiRes = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiBody),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const msg = data?.error?.message || `Gemini error (${geminiRes.status})`;
      return res.status(geminiRes.status).json({ error: msg });
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('');

    // Shape the response to match what callAI() expects (Groq/OpenAI format)
    return res.status(200).json({ choices: [{ message: { content: text } }] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

function buildGeminiBody({ messages, temperature, json, maxTokens, responseSchema }) {
  // Gemini has no native "system" role — concatenate any system messages and
  // prepend them to the first user message.
  const systems = [];
  const rest = [];
  for (const m of messages) {
    if (m.role === 'system') systems.push(m.content || '');
    else rest.push(m);
  }
  const systemPrefix = systems.length ? systems.join('\n\n') + '\n\n' : '';

  const contents = [];
  let firstUserPrefixed = false;
  for (const m of rest) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    let text = m.content || '';
    if (role === 'user' && !firstUserPrefixed) {
      text = systemPrefix + text;
      firstUserPrefixed = true;
    }
    // Gemini requires alternating roles — merge consecutive same-role messages
    if (contents.length && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += '\n\n' + text;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  // System-only payloads: send the system text as a user turn
  if (!contents.length && systemPrefix) {
    contents.push({ role: 'user', parts: [{ text: systemPrefix.trim() }] });
  }
  // Gemini requires the first turn to be 'user'
  if (contents.length && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: '' }] });
  }

  const generationConfig = {
    temperature: temperature ?? 0.7,
    maxOutputTokens: maxTokens || 4096,
  };
  if (responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = responseSchema;
  } else if (json) {
    generationConfig.responseMimeType = 'application/json';
  }

  return { contents, generationConfig };
}
