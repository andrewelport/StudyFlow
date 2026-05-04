module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set' });
  }

  try {
    const { messages, temperature, json, maxTokens } = req.body;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: temperature || 0.7,
        max_tokens: maxTokens || 4096,
        response_format: json ? { type: 'json_object' } : undefined,
      }),
    });

    const data = await groqRes.json();
    return res.status(groqRes.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
