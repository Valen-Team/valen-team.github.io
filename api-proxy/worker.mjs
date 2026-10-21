// The upstream credential belongs in the VALEN_API_KEY secret, never in site assets.
const UPSTREAM = 'https://llm-proxy.openxxlab.com/v1/decisions';
const MAX_BYTES = 4500000;
const MODELS = ['valen-preview-0923', 'valen-2b', 'valen-4b', 'valen-0-8b'];
function validPayload(p) {
  if (!p || !MODELS.includes(p.model) || p.temperature !== 1 || !Array.isArray(p.questions) || p.questions.length !== 1) return false;
  const q = p.questions[0];
  if (q?.name !== 'q0' || !['predicate', 'choice', 'score'].includes(q.type) || typeof q.instructions !== 'string' || !q.instructions.trim() || q.instructions.length > 1000) return false;
  if (q.type === 'choice') {
    if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 8) return false;
    if (!q.choices.every(c => typeof c?.value === 'string' && c.value.trim() && c.value.length <= 100 && typeof c.description === 'string' && c.description.trim() && c.description.length <= 300) || new Set(q.choices.map(c => c.value)).size !== q.choices.length) return false;
  }
  if (q.type === 'score') {
    if (!Array.isArray(q.levels) || q.levels.length < 2 || q.levels.length > 8) return false;
    if (!q.levels.every(l => typeof l?.label === 'string' && l.label.trim() && l.label.length <= 100 && typeof l.description === 'string' && l.description.trim() && l.description.length <= 300) || new Set(q.levels.map(l => l.label)).size !== q.levels.length) return false;
  }
  if (typeof p.input === 'string') return p.input.trim().length > 0 && p.input.length <= 4000;
  if (!Array.isArray(p.input) || p.input.length !== 1 || p.input[0]?.role !== 'user' || !Array.isArray(p.input[0].content)) return false;
  const content = p.input[0].content;
  return content.length === 2 && content[0]?.type === 'input_text' && typeof content[0].text === 'string' && content[0].text.trim().length > 0 && content[0].text.length <= 4000 && content[1]?.type === 'input_image' && typeof content[1].image_url === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(content[1].image_url);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || 'https://valen-team.github.io,https://valen-team-valen-api.static.hf.space').split(',').map(x => x.trim());
    const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin'};
    if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers});
    if (!origin || !allowed.includes(origin)) return reply({detail: 'Origin not allowed.'}, 403);
    if (new URL(request.url).pathname !== '/v1/decisions') return reply({detail: 'Not found.'}, 404);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: {...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}});
    if (request.method !== 'POST') return reply({detail: 'Use POST.'}, 405);
    if (!env.VALEN_API_KEY || !env.PER_IP || !env.SHARED_BUDGET) return reply({detail: 'Demo is not configured.'}, 503);
    // CORS restricts browsers; it is not authentication. Rate bindings also apply to scripted clients.
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return reply({detail: 'Client address unavailable.'}, 403);
    const perIp = await env.PER_IP.limit({key: ip});
    if (!perIp.success) return reply({detail: 'Too many requests. Try again in a minute.'}, 429);
    const budget = await env.SHARED_BUDGET.limit({key: 'public-demo'});
    if (!budget.success) return reply({detail: 'Demo is busy. Try again in a minute.'}, 429);
    if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({detail: 'Send JSON.'}, 415);
    const reader = request.body?.getReader();
    if (!reader) return reply({detail: 'Missing request body.'}, 400);
    let size = 0; const chunks = [];
    while (true) {const {value, done} = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) {await reader.cancel(); return reply({detail: 'Request too large.'}, 413);} chunks.push(value);}
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
    let payload;
    try {payload = JSON.parse(new TextDecoder().decode(bytes));} catch {return reply({detail: 'Invalid JSON.'}, 400);}
    if (!validPayload(payload)) return reply({detail: 'Invalid demo request. Use a supported Valen model, one predicate, choice, or score question, and text or an inline image.'}, 400);
    // Forward only the supported fields. Never forward a user-supplied URL or authorization header.
    const q = payload.questions[0];
    const question = {name: q.name, type: q.type, instructions: q.instructions};
    if (q.type === 'choice') question.choices = q.choices.map(({value, description}) => ({value, description}));
    if (q.type === 'score') question.levels = q.levels.map(({label, description}) => ({label, description}));
    const body = {model: payload.model, input: payload.input, temperature: 1, questions: [question]};
    try {
      const response = await fetch(UPSTREAM, {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${env.VALEN_API_KEY}`}, body: JSON.stringify(body), signal: AbortSignal.timeout(115000), redirect: 'manual'});
      if (!response.ok) return reply({detail: response.status === 429 ? 'The model is busy. Please retry later.' : 'The model service could not complete this request.'}, response.status === 429 ? 429 : 502);
      const result = await response.json();
      if (!Array.isArray(result.answers)) return reply({detail: 'Unexpected model response.'}, 502);
      return reply({answers: result.answers.map(a => ({type: a.type, name: a.name, choice: a.choice, probability: a.probability, score: a.score, confidence: a.confidence, probabilities: a.probabilities})), model_id: result.model_id});
    } catch {return reply({detail: 'The model service is temporarily unavailable.'}, 502);}
  },
};
