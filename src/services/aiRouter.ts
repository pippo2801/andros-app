export interface RouteDecision {
  model: string;
  reason: string;
  category: 'coding' | 'reasoning' | 'writing' | 'general' | 'vision';
}

/**
 * A deterministic, free-first router for models already installed in Ollama.
 * It never sends a prompt to a paid provider or uploads it to a third party.
 */
export function chooseModelForTask(
  prompt: string,
  installedModels: string[],
  preferredModel: string,
): RouteDecision {
  const text = prompt.toLocaleLowerCase();
  const has = (...terms: string[]) => terms.some((term) => text.includes(term));
  let category: RouteDecision['category'] = 'general';

  if (has('immagine', 'foto', 'screenshot', 'immagini', 'vision', 'analizza questa figura')) {
    category = 'vision';
  } else if (has('codice', 'programma', 'programmazione', 'python', 'javascript', 'typescript', 'react', 'bug', 'errore', 'debug', 'apk', 'android', 'gradle', 'git', 'script', 'funzione', 'classe', 'compila')) {
    category = 'coding';
  } else if (has('dimostra', 'confronta', 'analizza', 'ragiona', 'pro e contro', 'strategia', 'piano', 'perché', 'spiegami in dettaglio', 'valuta')) {
    category = 'reasoning';
  } else if (has('scrivi', 'riscrivi', 'email', 'messaggio', 'articolo', 'riassumi', 'traduci', 'correggi il testo', 'descrizione')) {
    category = 'writing';
  }

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
