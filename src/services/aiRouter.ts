export interface RouteDecision {
  model: string;
  reason: string;
  category: 'coding' | 'reasoning' | 'writing' | 'general' | 'vision';
}

const TASK_TERMS: Record<RouteDecision['category'], string[]> = {
  vision: [
    'immagine', 'immagini', 'foto', 'fotografia', 'screenshot', 'vision',
    'analizza questa figura', 'image', 'images', 'photo', 'picture',
    'screenshot of', 'look at this', 'what is in this image', 'imagen', 'foto de',
  ],
  coding: [
    'codice', 'programma', 'programmazione', 'python', 'javascript',
    'typescript', 'react', 'bug', 'errore', 'debug', 'apk', 'android',
    'gradle', 'git', 'script', 'funzione', 'classe', 'compila',
    'code', 'coding', 'programming', 'debugging', 'compile', 'compiler',
    'repository', 'pull request', 'unit test', 'function', 'typescript',
    'javascript', 'build an app', 'write a script', 'stack trace',
  ],
  reasoning: [
    'dimostra', 'confronta', 'analizza', 'ragiona', 'pro e contro',
    'strategia', 'piano', 'perché', 'spiegami in dettaglio', 'valuta',
    'reason', 'reasoning', 'compare', 'analyze', 'analyse', 'pros and cons',
    'strategy', 'plan', 'why does', 'explain in detail', 'evaluate',
    'think through', 'trade-off', 'tradeoff',
  ],
  writing: [
    'scrivi', 'riscrivi', 'email', 'messaggio', 'articolo', 'riassumi',
    'traduci', 'correggi il testo', 'descrizione', 'write', 'rewrite',
    'draft', 'summarize', 'summary', 'translate', 'proofread', 'essay',
    'email', 'message', 'article', 'description', 'make this clearer',
  ],
  general: [],
};

/**
 * Deterministic, free-first routing for models already installed in Ollama.
 * It does not contact a cloud provider or transmit prompts.
 *
 * This is keyword-based routing, not semantic intent detection. When a task
 * could fit multiple categories, the priority is vision, coding, reasoning,
 * then writing; otherwise the preferred/first installed model is used.
 */
export function chooseModelForTask(
  prompt: string,
  installedModels: string[],
  preferredModel: string,
): RouteDecision {
  const text = prompt.toLocaleLowerCase();
  const has = (category: Exclude<RouteDecision['category'], 'general'>) =>
    TASK_TERMS[category].some((term) => text.includes(term));

  let category: RouteDecision['category'] = 'general';
  if (has('vision')) category = 'vision';
  else if (has('coding')) category = 'coding';
  else if (has('reasoning')) category = 'reasoning';
  else if (has('writing')) category = 'writing';

  const models = installedModels.filter((model) => typeof model === 'string' && model.trim());
  const matches = (model: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(model));
  const preference = preferredModel.trim();
  const find = (patterns: RegExp[]) => models.find((model) => matches(model, patterns));

  let selected: string | undefined;
  if (category === 'coding') {
    selected = find([/coder/i, /code/i, /deepseek.*r1/i, /qwen.*2\.5/i]);
  } else if (category === 'reasoning') {
    selected = find([/deepseek.*r1/i, /qwq/i, /reason/i, /llama3/i, /gemma/i]);
  } else if (category === 'vision') {
    selected = find([/llava/i, /qwen.*vl/i, /vision/i, /minicpm.*v/i]);
  } else if (category === 'writing') {
    selected = find([/llama3/i, /mistral/i, /gemma/i, /qwen/i]);
  }

  selected = selected || models.find((model) => model === preference) || models[0] || preference;
  const reasons: Record<RouteDecision['category'], string> = {
    coding: 'Compito tecnico: priorità a un modello locale orientato al codice.',
    reasoning: 'Compito di analisi: priorità a un modello locale adatto al ragionamento.',
    writing: 'Compito di scrittura: priorità a un modello locale generalista.',
    vision: 'Richiesta visiva: priorità a un modello multimodale locale, se installato.',
    general: 'Richiesta generale: uso del modello locale preferito.',
  };
  return { model: selected, reason: reasons[category], category };
}
