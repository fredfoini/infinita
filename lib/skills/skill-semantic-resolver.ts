import type { ActionDomain, ActionInterpretation, CoreAttribute, RiskLevel } from '@/lib/skills/types';

export type SemanticContext = {
  previousNarrative?: string;
  nearbyNpcNames?: string[];
  knownUnlockedActions?: string[];
};

export function normalizeSemanticText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function result(rawAction: string, values: Partial<ActionInterpretation> & Pick<ActionInterpretation, 'intent' | 'domain' | 'proposedSkill' | 'proposedAttribute' | 'actionMethod' | 'requiresRoll' | 'riskLevel' | 'reasoning'>): ActionInterpretation {
  return {
    rawAction,
    intent: values.intent,
    domain: values.domain,
    proposedSkill: values.proposedSkill,
    proposedAttribute: values.proposedAttribute,
    actionMethod: values.actionMethod,
    targetId: values.targetId,
    requiresRoll: values.requiresRoll,
    opposed: values.opposed ?? false,
    riskLevel: values.riskLevel,
    reasoning: values.reasoning,
    possibleExistingSkillKeys: values.possibleExistingSkillKeys || [],
    trainable: values.trainable ?? values.requiresRoll,
    trivial: values.trivial ?? !values.requiresRoll,
    consentRequired: values.consentRequired,
  };
}

const trivial = (rawAction: string, intent: string, reasoning: string) => result(rawAction, {
  intent, domain: 'general', proposedSkill: '', proposedAttribute: 'wisdom', actionMethod: 'ação direta', requiresRoll: false, riskLevel: 'none', reasoning, trainable: false, trivial: true,
});

export function resolveActionSemantics(rawAction: string, context: SemanticContext = {}): ActionInterpretation {
  const action = normalizeSemanticText(rawAction);
  const scene = normalizeSemanticText(context.previousNarrative || '');

  if (/\b(abrir|abro)\b.*\bporta\b.*\bdestrancad/.test(action)) return trivial(rawAction, 'abrir uma passagem acessível', 'A porta foi declarada destrancada; falhar não produziria uma consequência relevante.');
  if (/\b(ler|leio)\b.*\b(placa|frase|bilhete simples|nome)\b/.test(action) && !/codigo|cifrad|tecnic|antig|desconhecid|complex/.test(action)) return trivial(rawAction, 'ler informação comum', 'Texto simples e acessível não exige teste.');
  if (/\b(andar|caminhar|caminho|sentar|sento|respirar|pegar|apanhar)\b/.test(action) && !/correndo|perigo|escondid|armadilh|precipicio/.test(action + ' ' + scene)) return trivial(rawAction, 'realizar ação cotidiana', 'Ação cotidiana sem oposição, risco ou consequência de falha.');

  if (/\b(?:observ\w*|examin\w*|analis\w*).*\b(?:postura|movimento|golpe)\b/.test(action)) return result(rawAction, {
    intent: 'antecipar o comportamento físico de alguém', domain: 'perception', proposedSkill: 'Percepção', proposedAttribute: 'wisdom', actionMethod: 'observação cuidadosa', requiresRoll: true, opposed: true, riskLevel: 'medium', reasoning: 'O jogador observa sinais corporais; não está executando o ataque.', possibleExistingSkillKeys: ['percepcao', 'empatia'],
  });
  if (/\b(?:perceb\w*|not\w*|examin\w*|leio|ler).*\b(?:desconfort\w*|emoc\w*|reacao|receptiv\w*|sentimento|expressao)\b/.test(action)) return result(rawAction, {
    intent: 'interpretar o estado emocional do alvo', domain: 'perception', proposedSkill: 'Empatia', proposedAttribute: 'wisdom', actionMethod: 'leitura emocional', requiresRoll: true, opposed: false, riskLevel: 'low', reasoning: 'Compreender receptividade usa experiência social perceptiva, não conquista romântica.', possibleExistingSkillKeys: ['empatia', 'percepcao'], consentRequired: true,
  });
  if (/\b(?:beij\w*|tento beij\w*|aproxim\w*.*romantic\w*)/.test(action)) return result(rawAction, {
    intent: 'tentar uma aproximação romântica respeitando a resposta do alvo', domain: 'romance', proposedSkill: 'Sedução', proposedAttribute: 'charisma', actionMethod: 'aproximação romântica', requiresRoll: true, opposed: true, riskLevel: 'medium', reasoning: 'Carisma mede a abordagem; nenhum resultado substitui interesse, limites ou consentimento do NPC.', possibleExistingSkillKeys: ['seducao', 'persuasao', 'empatia'], consentRequired: true,
  });
  if (/\b(?:flert\w*|seduz\w*|conquist\w*|paquer\w*|encant\w*)/.test(action)) return result(rawAction, {
    intent: 'criar proximidade romântica', domain: 'romance', proposedSkill: 'Sedução', proposedAttribute: 'charisma', actionMethod: 'interação social romântica', requiresRoll: true, opposed: true, riskLevel: 'medium', reasoning: 'A abordagem é social e usa Carisma; sucesso significa boa recepção possível, nunca controle.', possibleExistingSkillKeys: ['seducao', 'persuasao'], consentRequired: true,
  });

  if (/\b(soco|socar|esmurr|murro|luta desarmada|brigar)\b/.test(action)) return result(rawAction, {
    intent: 'atingir um alvo em combate corporal', domain: 'combat', proposedSkill: 'Luta', proposedAttribute: 'strength', actionMethod: 'golpe corporal baseado em potência', requiresRoll: true, opposed: true, riskLevel: 'high', reasoning: 'Um golpe corporal direto combina Força e experiência em Luta.', possibleExistingSkillKeys: ['luta', 'combate corporal'],
  });
  if (/\b(adaga|punhal|faca)\b/.test(action) && /atac|golpe|cort|apunhal/.test(action)) return result(rawAction, {
    intent: 'atacar com uma arma leve', domain: 'combat', proposedSkill: 'Armas Leves', proposedAttribute: 'dexterity', actionMethod: 'ataque preciso com lâmina leve', requiresRoll: true, opposed: true, riskLevel: 'high', reasoning: 'Armas leves dependem primariamente de precisão e coordenação.', possibleExistingSkillKeys: ['armas leves', 'luta'],
  });
  if (/\b(atac|golpe|lutar|combater|espada|machado|martelo)\b/.test(action)) return result(rawAction, {
    intent: 'executar um ataque físico', domain: 'combat', proposedSkill: 'Luta', proposedAttribute: 'strength', actionMethod: 'ataque físico direto', requiresRoll: true, opposed: true, riskLevel: 'high', reasoning: 'Ataque físico exige capacidade marcial e oposição do alvo.', possibleExistingSkillKeys: ['luta', 'combate'],
  });

  if (/\b(arrombar|gazua|lockpick|forcar fechadura|abrir fechadura)\b/.test(action)) return result(rawAction, {
    intent: 'abrir uma fechadura tecnicamente', domain: 'stealth', proposedSkill: 'Ladinagem', proposedAttribute: 'dexterity', actionMethod: 'manipulação técnica da fechadura', requiresRoll: true, opposed: false, riskLevel: /guard|alarme|pressa/.test(action + ' ' + scene) ? 'high' : 'medium', reasoning: 'O método declarado é técnico e exige coordenação manual.', possibleExistingSkillKeys: ['ladinagem', 'arrombamento'],
  });
  if (/\b(?:quebr\w*|derrub\w*|arrebent\w*|chut\w*).*\b(?:porta|portao|barreira)\b/.test(action)) return result(rawAction, {
    intent: 'romper uma barreira pela força', domain: 'movement', proposedSkill: 'Atletismo', proposedAttribute: 'strength', actionMethod: 'aplicação de força bruta', requiresRoll: true, riskLevel: 'medium', reasoning: 'Quebrar a passagem usa potência física, não técnica de fechaduras.', possibleExistingSkillKeys: ['atletismo'],
  });
  if (/\b(?:salt\w*|pul\w*|equilibr\w*|acrob\w*|atravess\w*)/.test(action) && /abismo|precipicio|telhado|corda|obstaculo|perigo/.test(action + ' ' + scene)) return result(rawAction, {
    intent: 'superar um obstáculo com coordenação corporal', domain: 'movement', proposedSkill: 'Acrobacia', proposedAttribute: 'dexterity', actionMethod: 'movimento corporal preciso', requiresRoll: true, riskLevel: /abismo|precipicio/.test(action + ' ' + scene) ? 'high' : 'medium', reasoning: 'O movimento exige precisão e uma falha produziria consequência concreta.', possibleExistingSkillKeys: ['acrobacia', 'atletismo'],
  });
  if (/\b(descobrir|entender|examinar|investigar)\b.*\b(mecanismo|fechadura|engrenagem|dispositivo)\b/.test(action)) return result(rawAction, {
    intent: 'compreender um mecanismo', domain: 'knowledge', proposedSkill: 'Investigação', proposedAttribute: 'intelligence', actionMethod: 'análise lógica', requiresRoll: true, riskLevel: 'medium', reasoning: 'Compreender o funcionamento exige análise e conhecimento.', possibleExistingSkillKeys: ['investigacao', 'mecanica'],
  });
  if (/\b(procur|buscar|achar)\b.*\b(chave|pista|passagem|objeto)\b.*\b(escond|ocult)/.test(action)) return result(rawAction, {
    intent: 'encontrar algo oculto', domain: 'perception', proposedSkill: 'Percepção', proposedAttribute: 'wisdom', actionMethod: 'busca sensorial', requiresRoll: true, riskLevel: 'medium', reasoning: 'A ação procura sinais ocultos no ambiente.', possibleExistingSkillKeys: ['percepcao', 'investigacao'],
  });

  if (/\b(sprint|disparo em corrida|corrida curta|arrancada)\b/.test(action)) return result(rawAction, {
    intent: 'cobrir uma distância curta rapidamente', domain: 'movement', proposedSkill: 'Corrida', proposedAttribute: 'dexterity', actionMethod: 'arrancada explosiva', requiresRoll: /persegu|alcanc|fug|tempo|antes/.test(action + ' ' + scene), opposed: /persegu|alcanc|fug/.test(action), riskLevel: 'medium', reasoning: 'Sprint curto privilegia explosão, coordenação e reação.', possibleExistingSkillKeys: ['corrida'], trainable: true,
  });
  if (/\b(?:corr\w*|maratona|persegu\w*.*pe|fug\w*.*correndo)/.test(action)) return result(rawAction, {
    intent: 'sustentar deslocamento físico', domain: 'movement', proposedSkill: 'Corrida', proposedAttribute: /long|longe|horas|ate cansar|resistencia/.test(action + ' ' + scene) ? 'constitution' : 'constitution', actionMethod: 'corrida sustentada', requiresRoll: /persegu|fug|long|longe|tempo|risco|alcanc/.test(action + ' ' + scene), opposed: /persegu|fug|alcanc/.test(action), riskLevel: /long|horas|exaust/.test(action + ' ' + scene) ? 'high' : 'medium', reasoning: 'Corrida sustentada depende de Constituição; caminhar sem risco não entraria nesta regra.', possibleExistingSkillKeys: ['corrida', 'atletismo'], trainable: true,
  });

  if (/\b(ler|leio|decifrar|estudar)\b/.test(action) && /complex|tecnic|tratado|cifrad|codigo|idioma|antig|memorizar|interpretar/.test(action + ' ' + scene)) return result(rawAction, {
    intent: 'compreender informação textual complexa', domain: 'knowledge', proposedSkill: 'Leitura', proposedAttribute: 'intelligence', actionMethod: 'leitura analítica', requiresRoll: true, riskLevel: /cifrad|idioma desconhecido|codigo/.test(action + ' ' + scene) ? 'high' : 'medium', reasoning: 'A complexidade ou informação oculta torna a compreensão incerta.', possibleExistingSkillKeys: ['leitura', 'investigacao'], trainable: true,
  });
  if (/\b(?:pesc\w*|anzol|rede de pesca|captur\w* peixe)/.test(action)) return result(rawAction, {
    intent: 'capturar peixe ou criatura aquática', domain: 'survival', proposedSkill: 'Pesca', proposedAttribute: 'wisdom', actionMethod: /rede/.test(action) ? 'pesca com rede' : 'pesca com equipamento disponível', requiresRoll: true, riskLevel: /tempest|alto mar|criatura|perigo/.test(action + ' ' + scene) ? 'high' : 'medium', reasoning: 'Pesca é uma capacidade treinável e o resultado é incerto; a ferramenta não cria outra perícia.', possibleExistingSkillKeys: ['pesca'], trainable: true,
  });

  if (/\b(escond|furtiv|sem ser visto|esgueir|infiltr)\b/.test(action)) return result(rawAction, {
    intent: 'agir sem ser detectado', domain: 'stealth', proposedSkill: 'Furtividade', proposedAttribute: 'dexterity', actionMethod: 'movimento discreto', requiresRoll: true, opposed: true, riskLevel: 'medium', reasoning: 'A tentativa enfrenta a percepção de observadores.', possibleExistingSkillKeys: ['furtividade'],
  });
  if (/\b(convenc|persuad|negoci|diplomac|pedir favor)\b/.test(action)) return result(rawAction, {
    intent: 'influenciar uma decisão por diálogo', domain: 'social', proposedSkill: 'Persuasão', proposedAttribute: 'charisma', actionMethod: 'argumentação social', requiresRoll: true, opposed: true, riskLevel: 'medium', reasoning: 'Existe resistência social e uma consequência para a resposta.', possibleExistingSkillKeys: ['persuasao', 'diplomacia'],
  });
  if (/\b(ameac|intimid|coagir)\b/.test(action)) return result(rawAction, {
    intent: 'pressionar alguém por intimidação', domain: 'social', proposedSkill: 'Intimidação', proposedAttribute: 'charisma', actionMethod: 'pressão social', requiresRoll: true, opposed: true, riskLevel: 'high', reasoning: 'A ação enfrenta a determinação do alvo.', possibleExistingSkillKeys: ['intimidacao'],
  });
  if (/\b(investig|vasculh|deduz|pista|examinar)\b/.test(action)) return result(rawAction, {
    intent: 'obter informação por análise', domain: 'knowledge', proposedSkill: 'Investigação', proposedAttribute: 'intelligence', actionMethod: 'análise lógica', requiresRoll: /ocult|pista|mister|complex|tempo|pressa/.test(action + ' ' + scene), riskLevel: 'medium', reasoning: 'A análise só exige teste quando há informação incerta ou pressão.', possibleExistingSkillKeys: ['investigacao'], trainable: true,
  });
  if (/\b(observ|perceb|ouvir|vigiar|notar|rastrear)\b/.test(action)) return result(rawAction, {
    intent: 'detectar sinais relevantes', domain: 'perception', proposedSkill: 'Percepção', proposedAttribute: 'wisdom', actionMethod: 'atenção aos sentidos', requiresRoll: /ocult|perigo|rastro|distante|silenc|embosc/.test(action + ' ' + scene), riskLevel: 'medium', reasoning: 'Percepção é testada apenas quando existe algo difícil ou oculto.', possibleExistingSkillKeys: ['percepcao'], trainable: true,
  });

  return trivial(rawAction, 'executar a ação declarada', 'A Engine não identificou risco, oposição e consequência suficientes para justificar um teste.');
}

export const SkillSemanticResolver = { resolve: resolveActionSemantics, normalize: normalizeSemanticText };
