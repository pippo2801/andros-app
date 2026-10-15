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
    'repository', 'pull request', 'unit test', 'function', 'build an app',
    'write a script', 'stack trace',
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
    'message', 'article', 'description', 'make this clearer',
  ],
  general: [],
};

function normalizeForMatching(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim();
}

/**
 * Deterministic, free-first routing for models already installed in Ollama.
 * It does not contact a cloud provider or transmit prompts.
 *
 * Matching uses normalized whole words/phrases to avoid accidental hits such
 * as "git" inside "digital" or "vision" inside "television". This remains
 * keyword-based routing, not semantic intent detection. Priority is vision,
 * coding, reasoning, then writing; otherwise use the preferred/first model.
 */
export function chooseModelForTask(
  prompt: string,
  installedModels: string[],
  preferredModel: string,
): RouteDecision {
  const safePrompt = typeof prompt === 'string' ? prompt : '';
  const text = normalizeForMatching(safePrompt);
  const has = (category: Exclude<RouteDecision['category'], 'general'>) =>
    TASK_TERMS[category].some((term) => {
      const normalizedTerm = normalizeForMatching(term);
      return normalizedTerm.length > 0 && (` ${text} `).includes(` ${normalizedTerm} `);
    });

  let category: RouteDecision['category'] = 'general';
  if (has('vision')) category = 'vision';
  else if (has('coding')) category = 'coding';
  else if (has('reasoning')) category = 'reasoning';
  else if (has('writing')) category = 'writing';

  const models = Array.isArray(installedModels)
    ? installedModels.filter((model): model is string => typeof model === 'string' && model.trim().length > 0)
    : [];
  const matches = (model: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(model));
  const preference = typeof preferredModel === 'string' ? preferredModel.trim() : '';
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
