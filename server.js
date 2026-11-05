const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `Eres un asistente llamado "MALVADO". Reglas ESTRICTAS:
1. NUNCA uses relleno tipo "¡Claro! ¡Con gusto!". Ve directo al grano.
2. Si algo es verdad incómoda, dila sin suavizar.
3. Si no sabes algo, dilo SIN inventar. Cero alucinaciones.
4. Respuestas concretas, técnicas y accionables.
5. Cuando te pidan código, da código FUNCIONAL, no pseudocódigo.
6. Cuando te pidan opinión, da una postura clara, no tibia.
7. Corrige al usuario si está equivocado, aunque no lo pida.
8. Español neutro, tono directo, sin florituras.
9. Si la pregunta es ambigua, asume la interpretación más útil y avanza.`;

const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY'
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'cognitivecomputations/dolphin-mixtral-8x7b:free',
    envKey: 'OPENROUTER_API_KEY',
    extraHeaders: {
      'HTTP-Referer': 'https://chat-malvado.onrender.com',
      'X-Title': 'Chat Malvado'
    }
  }
};

const hits = new Map();
const WINDOW_MS = 60000;
const MAX_REQ = 15;

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const data = hits.get(ip) || { count: 0, start: now };
  if (now - data.start > WINDOW_MS) {
    data.count = 0;
    data.start = now;
  }
  data.count++;
  hits.set(ip, data);
  if (data.count > MAX_REQ) {
    return res.status(429).json({ error: 'Demasiadas peticiones. Espera 1 minuto.' });
  }
  next();
}

app.post('/api/chat', rateLimit, async (req, res) => {
  try {
    const { messages, apiKey, model, provider } = req.body;
    const provName = PROVIDERS[provider] ? provider : 'groq';
    const prov = PROVIDERS[provName];
    const key = (apiKey && apiKey.trim()) || process.env[prov.envKey];

    if (!key) {
      return res.status(400).json({ error: 'Falta API key' });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Sin mensajes' });
    }

    const payload = {
      model: model || prov.defaultModel,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.slice(-12)],
      temperature: 0.8,
      max_tokens: 2048
    };

    const headers = {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    };
    if (prov.extraHeaders) Object.assign(headers, prov.extraHeaders);

    const r = await fetch(prov.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const raw = await r.text();
      let msg = raw;
      try { const p = JSON.parse(raw); msg = (p.error && p.error.message) || raw; } catch (e) {}
      return res.status(r.status).json({ error: msg });
    }

    const data = await r.json();
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '(sin respuesta)';
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', function(_req, res) { res.json({ ok: true }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('Malvado en puerto ' + PORT); });
