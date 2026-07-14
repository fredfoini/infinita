export function cleanNarrativeScaffolding(narrative: string, characterName = '') {
  let clean = String(narrative || '').trim();
  const escapedName = characterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedName) clean = clean.replace(new RegExp(`^${escapedName}\\s+executa:\\s*[“\"]?.{0,500}?[”\"]\\.?\\s*`, 'i'), '');
  clean = clean
    .replace(/^[^.!?\n]{1,80}\s+executa:\s*[“\"]?.{0,500}?[”\"]\.?\s*/i, '')
    .replace(/(?:Em\s+[^.!?]{1,100},\s*)?algo concreto muda:\s*o ambiente e as pessoas passam a responder a essa escolha,?\s*abrindo uma nova situação em vez de repetir a anterior\.\s*/gi, '')
    .replace(/(?:O\s+)?ambiente reage (?:ao que (?:você|eu) faço|à sua ação|a essa escolha)\.?\s*/gi, '');
  return clean.trim();
}

export const NarrativeCleaner = { clean: cleanNarrativeScaffolding };
