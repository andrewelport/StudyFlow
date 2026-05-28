// Legacy filename — internally calls Google Gemini, not Groq.
// Kept as "groq-proxy" so the 8 callers in app_v58.js continue to work
// without touching client code.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    // 503 maps cleanly to callAI's "service unavailable" branch in app_v58.js
    return jsonResponse(503, { error: 'GEMINI_API_KEY is not set on server' });
  }

  let messages, temperature, json, maxTokens, responseSchema, files, thinkingConfig;
  try {
    ({ messages, temperature, json, maxTokens, responseSchema, files, thinkingConfig } = JSON.parse(event.body));
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(400, { error: 'messages array required' });
  }

  const geminiBody = buildGeminiBody({ messages, temperature, json, maxTokens, responseSchema, files, thinkingConfig });

  try {
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
      return jsonResponse(geminiRes.status, { error: msg });
    }

    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('');

    // Shape the response to match what callAI() expects (Groq/OpenAI format)
    return jsonResponse(200, { choices: [{ message: { content: text } }] });
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

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
