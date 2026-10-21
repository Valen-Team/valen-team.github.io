/** Native Decisions requests, with probability bars normalized for the conversation UI. */
export type OutputMode = 'choice' | 'boolean' | 'score';
export type Candidate = {value: string; description: string; score?: number};
export type Probability = {value: string; probability: number};
export type DecisionAnswer = {name: string; type: 'predicate' | 'choice' | 'score'; choice: string; raw?: unknown; probability?: number; score?: number; confidence?: number; probabilities: Probability[]};
export const modelOptions = [
  ['valen-2b', 'Valen 2B'], ['valen-4b', 'Valen 4B'],
  ['valen-0-8b', 'Valen 0.8B'], ['valen-preview-0923', 'Valen Preview'],
] as const;
export function booleanCandidates(zh: boolean): Candidate[] {
  return [{value: 'true', description: zh ? '是：问题中的条件成立' : 'Yes: the condition in the question is true'},
    {value: 'false', description: zh ? '否：问题中的条件不成立' : 'No: the condition in the question is false'}];
}
export function scoreCandidates(zh: boolean): Candidate[] {
  const labels = zh ? ['很低', '较低', '中等', '较高', '很高'] : ['Very low', 'Low', 'Moderate', 'High', 'Very high'];
  return labels.map((description, i) => ({value: `score_${i + 1}`, score: i, description}));
}
export function buildPayload({model, question, context, image, mode, candidates, history = ''}: {
  model: string; question: string; context: string; image?: string; mode: OutputMode;
  candidates: Candidate[]; history?: string;
}) {
  if (!modelOptions.some(([value]) => value === model)) throw new Error('model');
  if (!question.trim() || question.length > 1000) throw new Error('question');
  if (context.length > 3000) throw new Error('context');
  if (candidates.length < 2 || candidates.length > 8 || new Set(candidates.map(c => c.value)).size !== candidates.length || candidates.some(c => !c.description.trim() || c.description.length > 280)) throw new Error('candidates');
  if (mode === 'score' && candidates.some((c, i) => c.score !== i)) throw new Error('candidates');
  if (image && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) throw new Error('image');
  // Current evidence has priority. Recent decisions are bounded and marked as history.
  const evidence = context.trim() || (image ? 'Use the visible image to answer the question.' : question.trim());
  const room = Math.max(0, 4000 - evidence.length - 24);
  const recent = room > 0 ? history.slice(-room) : '';
  const input = recent ? `Previous decisions:\n${recent}\n\n${evidence}` : evidence;
  return {
    model,
    input: image ? [{role: 'user', content: [{type: 'input_text', text: input}, {type: 'input_image', image_url: image}]}] : input,
    questions: [{name: 'q0', type: mode === 'boolean' ? 'predicate' : mode, instructions: question.trim(), ...(mode === 'choice' ? {choices: candidates.map(c => ({value: c.value, description: c.description.trim()}))} : mode === 'score' ? {levels: candidates.map(c => ({label: String(c.score), description: c.description.trim()}))} : {})}],
    temperature: 1,
  };
}
export function parseAnswer(data: unknown, candidates: Candidate[], mode: OutputMode): DecisionAnswer {
  const body = data as {answers?: unknown[]};
  const answer = body?.answers?.[0] as DecisionAnswer | undefined;
  const type = mode === 'boolean' ? 'predicate' : mode;
  const validProbability = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  if (!answer || answer.name !== 'q0' || answer.type !== type) throw new Error('response');
  if (answer.confidence !== undefined && !validProbability(answer.confidence)) throw new Error('response');
  if (type === 'predicate') {
    if (!validProbability(answer.probability)) throw new Error('response');
    return {...answer, raw: answer, choice: answer.probability >= 0.5 ? 'true' : 'false', probabilities: [{value: 'true', probability: answer.probability}, {value: 'false', probability: 1 - answer.probability}]};
  }
  if (!Array.isArray(answer.probabilities)) throw new Error('response');
  if (type === 'score' && (typeof answer.score !== 'number' || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > candidates.length - 1)) throw new Error('response');
  const probabilities = answer.probabilities.map(p => ({value: type === 'score' ? candidates[Number(p.value)]?.value : p.value, probability: p.probability}));
  if (probabilities.length !== candidates.length || new Set(probabilities.map(p => p.value)).size !== candidates.length || probabilities.some(p => !candidates.some(c => c.value === p.value) || !validProbability(p.probability)) || Math.abs(probabilities.reduce((sum, p) => sum + p.probability, 0) - 1) > 0.02) throw new Error('response');
  if (type === 'choice' && !candidates.some(c => c.value === answer.choice)) throw new Error('response');
  return {...answer, raw: answer, probabilities};
}
export function weightedScore(answer: DecisionAnswer, _candidates: Candidate[]): number {
  return answer.score ?? 0;
}
