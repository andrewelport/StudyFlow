// Legacy filename — internally calls Google Gemini, not Groq.
// Kept as "groq-proxy" so the 8 callers in app_v58.js (callAI → /api/groq-proxy)
// continue to work without touching client code.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// CORS allowlist — replaces wildcard ACAO to stop arbitrary-origin abuse.
const ALLOWED_ORIGINS = [
  'https://studyflow.justbettersite.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

// Abuse caps: total request size and per-field limits.
const MAX_BODY_BYTES = 6 * 1024 * 1024; // ~6MB total (covers base64 files)
const MAX_MESSAGES = 80;

function applyCors(req, res) {
  const origin = req.headers && req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    // 503 maps cleanly to callAI's "service unavailable" branch in app_v58.js
    return res.status(503).json({ error: 'GEMINI_API_KEY is not set on server' });
  }

  try {
    const { messages, temperature, json, maxTokens, responseSchema, files, thinkingConfig } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    if (messages.length > MAX_MESSAGES) {
      return res.status(413).json({ error: 'too many messages' });
    }
    // Cap total payload size (guards megabyte base64 files draining quota/cost).
    try {
      const rawLen = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
      if (rawLen > MAX_BODY_BYTES) {
        return res.status(413).json({ error: 'request body too large' });
      }
    } catch { /* non-serializable body — fall through to normal handling */ }

    const geminiBody = buildGeminiBody({ messages, temperature, json, maxTokens, responseSchema, files, thinkingConfig });

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

function buildGeminiBody({ messages, temperature, json, maxTokens, responseSchema, files, thinkingConfig }) {
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
  let filesAttached = false;
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
      const parts = [];
      // Attach inline_data files BEFORE the text part on the first user turn
      if (role === 'user' && !filesAttached && Array.isArray(files) && files.length) {
        for (const f of files) {
          if (f && f.mime_type && f.data) {
            parts.push({ inline_data: { mime_type: f.mime_type, data: f.data } });
          }
        }
        filesAttached = true;
      }
      parts.push({ text });
      contents.push({ role, parts });
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
  if (thinkingConfig && typeof thinkingConfig === 'object') {
    generationConfig.thinkingConfig = thinkingConfig;
  }
  if (responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = responseSchema;
  } else if (json) {
    generationConfig.responseMimeType = 'application/json';
  }

  return { contents, generationConfig };
}
