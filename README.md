# INFINITA Engine - Narrative Memory + Visual Bank

RPG emergente em Next.js. O mestre textual usa failover transparente Groq → Gemini → OpenAI; a Engine TypeScript continua sendo a única autoridade sobre estado, dados, XP, atributos, inventário, combate, economia, objetivos e persistência. A camada visual compõe cenários, personagem e NPCs persistentes a partir de atlas locais; a geração externa ficou restrita a ambientes inéditos que não existam no banco visual.

## Executar e validar

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Variáveis da Vercel

Texto:

- `GROQ_API_KEY`: provedor textual prioritário.
- `GROQ_MODEL`: opcional; padrão `llama-3.3-70b-versatile`.
- `GOOGLE_GENERATIVE_AI_API_KEY`: segundo provedor textual e único nome aceito para a chave Gemini.
- `GOOGLE_GENERATIVE_AI_MODEL`: opcional; padrão `gemini-3.5-flash`.
- `OPENAI_API_KEY`: terceiro provedor textual e provedor exclusivo de novas imagens.
- `OPENAI_MODEL`: opcional; padrão `gpt-4.1-mini`.
- `NARRATIVE_PROVIDER_TIMEOUT_MS` e `NARRATIVE_CIRCUIT_COOLDOWN_MS`: timeout e revalidação automática.

Imagem (opcional):

- `IMAGE_GENERATION_ENABLED`: use `false` para desabilitar explicitamente. Sem chave, o cache/fallback é automático.
- `IMAGE_API_KEY` ou `OPENAI_API_KEY`: chave OpenAI para imagem. O endpoint é fixo na OpenAI.
- `IMAGE_MODEL`: opcional; padrão `gpt-image-1`.
- `IMAGE_ESTIMATED_COST_USD`: custo estimado por imagem para telemetria local.

Falha, falta de crédito, rate limit ou ausência de chave nunca bloqueiam o turno. Um circuit breaker interrompe tentativas repetidas e o jogador recebe imediatamente o melhor asset local ou o fallback estático.

## Memória narrativa e estado v8

- `World Genesis`: prompt original integral e resumo estruturado imutável da origem.
- `Canon Memory`: fatos permanentes, mortes, partidas, mudanças mundiais e conclusões.
- `Campaign Summary`: resumo consolidado a cada 12 turnos ou evento transformador.
- `Session Memory`: últimos acontecimentos relevantes.
- `Narrative Anchor`: objetivo atual, desejos, relações, conflitos, locais e temas.
- Memória própria de NPC: primeira impressão, confiança, favores, conflitos, eventos e assuntos pendentes.
- Memória de objetivo: origem, motivo, progresso, consequências e relação pessoal.

`lib/memory/memory-builder.ts` reconstrói somente o contexto relevante antes de cada chamada ao modelo. O validador impede que NPCs mortos, desaparecidos ou que partiram sejam recriados como ativos. Saves v2–v6 são migrados para v7 no carregamento. Antes da migração no navegador, o conteúdo original recebe uma cópia em `infinita-migration-backup:*` para rollback manual.

## Dynamic Skill & Test Engine

- `lib/skills/skill-semantic-resolver.ts` interpreta verbo, objeto, alvo, método, duração, oposição e contexto antes de classificar o domínio da ação.
- `lib/skills/test-selection-validator.ts` centraliza aliases, deduplicação, matriz atributo–perícia, CDs padronizadas e auditoria. Uma proposta da LLM nunca é aplicada sem validação.
- `lib/skills/skill-check-engine.ts` é a única fórmula para `d20 + atributo + perícia + contexto`, incluindo vantagem, desvantagem, oposição e cinco graus de resultado.
- Perícias treináveis surgem organicamente, são persistidas com uso/sucesso/falha e evoluem de Novato a Lendário. Ações triviais não criam perícias nem pedem dado.
- XP de perícia considera dificuldade, novidade e repetição recente; spam idêntico cai rapidamente para zero.
- Cada decisão fica em `world.skillAudits`, com intenção, domínio, proposta da LLM, seleção da Engine, correções, CD e justificativa. A HUD só mostra a auditoria em desenvolvimento.
- Romance separa abordagem (`Carisma + Sedução`) de leitura de receptividade (`Sabedoria + Empatia`); nenhuma rolagem substitui consentimento, limites ou objetivos do NPC.
- Ao concluir um D20, a Engine fixa o resultado mecânico e a IA narra a consequência usando a cena anterior. Se todos os provedores falharem, o teste permanece pendente e o mesmo resultado é preservado no retry, sem texto genérico.
- Saves v2–v7 migram para o schema v8. O navegador mantém o backup original e `world.skillMigrationBackup` preserva as perícias antes da normalização segura.

## Consistência transacional v2

- Cada ação recebe `requestId`, convertido em `turnId`; IDs já processados não reaplicam efeitos.
- `lib/events/event-bus.ts` define eventos tipados e sincroniza objetivos inscritos sem usar texto narrativo como estado mecânico.
- O LLM interpreta e sugere `worldDelta`; somente a Engine valida e aplica dano, cura, mana, dinheiro, reputação, locais, NPCs, itens, objetivos e magias.
- `lib/magic/magic-engine.ts` normaliza magias procedurais por nível, controla mana, cooldown, dano, cura e efeitos ativos.
- O mapa aceita tipos emergentes de local, preserva conexões, visita, estado, presença de NPCs e um único local atual.
- HP, mana e energia têm limites persistidos e a HUD lê diretamente o save.

## Identidade visual persistente

- `lib/visual/sprite-system.ts` cria e migra uma identidade determinística para jogador e NPCs importantes sem regenerá-los a cada cena.
- `public/assets/hero-sprite-sheet-v1.png` contém idle, caminhada, ataque, magia, conversa, celebração, dano, morte e ações de mundo.
- `public/assets/world-scene-atlas-v1.png` oferece oito ambientes originais reutilizáveis: vila, taverna, floresta, rio, mina, castelo, loja e montanha.
- `components/LayeredWorldScene.tsx` compõe fundo, iluminação por horário, clima, objetos animados, NPCs e jogador em câmera fixa.
- O mesmo sprite aparece no menu, cutscene, HUD e mundo. Classe, descrição e personalidade ficam persistidas no save v8.
- A interface usa paleta natural, superfícies opacas, molduras de madeira/pedra e tipografia pixel; não depende de neon, vidro ou efeitos futuristas.

## Ciclo visual persistente

- O pergaminho 8-bit local continua sendo usado em carregamentos e transições narrativas.
- Locais conhecidos usam sempre o atlas local, sem custo de API e sem bloquear o turno.
- Somente um tipo de local realmente desconhecido consulta o cache e, se permitido, solicita uma ilustração de ambiente sem personagens.
- O padrão se repete, e a mesma imagem permanece por todo o bloco ilustrado.
- Cliques em menus não contam; texto aceito, dado concluído e escolhas contextuais persistidas contam.
- Se a OpenAI estiver indisponível, o jogo usa o melhor cache e depois o pergaminho, sem interromper texto ou input.
- O pergaminho está isolado em `components/ParchmentWriting.tsx`; a fonte fica em `public/assets/parchment-writing-source-v1.png` e o loop otimizado em `public/assets/parchment-writing-v1.gif`.

## Engine Update v1.0

### Performance

- O contexto do LLM remove duplicações entre mundo, memória, NPCs e objetivos e é memorizado por revisão do save.
- Após o schema transacional v7, o benchmark de 80 turnos usa um save de 26.329 bytes e mantém o contexto narrativo em 2.794 bytes: **89,4% menos dados enviados ao modelo**. Antes da revisão, eram 17.058/2.794 bytes e 83,6% de redução; o crescimento do save corresponde ao histórico tipado e à idempotência, sem aumentar tokens enviados ao LLM.
- O autosave v8 mantém um índice pequeno e serializa somente campanhas cuja revisão mudou; saves v3–v7 continuam migrando automaticamente.
- `SceneVisual`, áudio e cutscene usam code splitting; inventário e cena são memoizados contra renders causados pela digitação.
- Failover usa timeout adaptativo: Groq 8s, Gemini 10s e OpenAI 12s, salvo configuração explícita.
- A API de turno expõe `Server-Timing` para separar tempo da Engine, LLM e total.
- Imagens continuam assíncronas e não bloqueiam o input nem a resposta textual. Qualidade e resolução do provedor não foram reduzidas porque o profiling apontou contexto/failover/autosave como gargalos principais.
- Execute `pnpm profile` para repetir o profiling local.

### Item Engine

`lib/items/item-engine.ts` é a autoridade para criação, validação e transações. Cada item possui categoria, raridade, peso, valor, estado, origem, efeitos narrativos e mecânicos, stack, durabilidade, proprietário e histórico.

Categorias suportadas: consumível, ferramenta, arma, armadura, acessório, material, item de missão, documento, chave, relíquia e objeto narrativo.

Operações persistentes:

- usar, equipar e guardar;
- emprestar, vender, perder, roubar, destruir e descartar;
- fabricar, combinar e reparar;
- comprar por meio da economia local.

O modelo pode apenas sugerir `worldDelta.items`. A Engine exige que o nome apareça na narrativa, limita a um item por turno, rejeita duplicatas e exige pelo menos um efeito mecânico válido. O registro `world.itemRegistry` preserva o item mesmo depois de vendido, emprestado, consumido, perdido ou destruído.

### Interface

- Logo do menu reduzido aproximadamente 25%, sem alterar proporção.
- Pequenos atores pixel art ambientam o menu com caminhada, magia, leitura e um companheiro; os duelistas foram removidos.
- A cutscene clássica de doze segundos, com amanhecer, viagem, vila, portal, logo e trilha procedural, foi restaurada. `PULAR` permanece sempre disponível.
- Inventário usa fichas expansíveis com efeito, peso, raridade, durabilidade e ações contextuais.
- Em telas pequenas, HUD vira interface de aplicativo com painel lateral e barra de ação fixa.

## Banco visual acumulativo

- `lib/visual/scene-descriptor.ts`: produz o descritor semântico normalizado da cena.
- `lib/visual/semantic-matcher.ts`: pontua emoção, gênero, ação, local, ambiente, intensidade, personagens e diversidade recente.
- `lib/visual/moderation.ts`: converte pedidos inadequados em representações seguras e não gráficas.
- `lib/visual/image-provider.ts`: adaptador excepcional para ambientes originais em pixel art isométrica, sem personagens, e materialização do asset.
- `lib/visual/visual-asset-repository.ts`: banco persistente IndexedDB, circuit breaker e métricas.
- `app/api/visual`: geração opcional e resposta resiliente.
- `components/SceneVisual.tsx`: consulta cache, gera sem bloquear e aplica fallback.
- `components/AdminVisualDashboard.tsx`: assets, cache hit, confiança, custos, falhas e sanitizações.

O banco atual é compartilhado por todas as campanhas no mesmo navegador. Para compartilhamento global entre jogadores, o repositório foi isolado atrás do serviço e pode ser conectado posteriormente a um storage persistente (Vercel Blob/S3 + banco de metadados) sem alterar a HUD ou a Engine.

## Logo oficial

`public/assets/logo.png` é a única fonte do logotipo. `components/Logo.tsx` é reutilizado no menu, abertura, carregamento e HUD, com preload, proporção preservada, transparência e fallback não bloqueante.

Não envie `.next`, `node_modules` ou arquivos `.env` ao GitHub.
