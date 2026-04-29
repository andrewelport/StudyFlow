// Serverless proxy — keeps GROQ_API_KEY out of client-side code.
// Set GROQ_API_KEY in Netlify → Site settings → Environment variables.
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

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: 'GROQ_API_KEY environment variable is not set' } }),
    };
  }

  let messages, temperature, json, maxTokens;
  try {
    ({ messages, temperature = 0.7, json = false, maxTokens = 4096 } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'Invalid JSON body' } }) };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: { message: 'messages array required' } }) };
  }

  const groqBody = {
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (json) groqBody.response_format = { type: 'json_object' };

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groqBody),
    });

    const data = await groqRes.json();
    return {
      statusCode: groqRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: err.message } }),
    };
  }
};
