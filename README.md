# INFINITA Engine - Narrative Memory + Visual Bank

RPG emergente em Next.js. O mestre textual usa failover transparente Groq → Gemini → OpenAI; a Engine TypeScript continua sendo a única autoridade sobre estado, dados, XP, atributos, inventário, combate, economia, objetivos e persistência. A camada visual alterna blocos de pergaminho e ilustração, consultando o banco antes de solicitar uma nova imagem à OpenAI.

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

## Memória narrativa e estado v5

- `World Genesis`: prompt original integral e resumo estruturado imutável da origem.
- `Canon Memory`: fatos permanentes, mortes, partidas, mudanças mundiais e conclusões.
- `Campaign Summary`: resumo consolidado a cada 12 turnos ou evento transformador.
- `Session Memory`: últimos acontecimentos relevantes.
- `Narrative Anchor`: objetivo atual, desejos, relações, conflitos, locais e temas.
- Memória própria de NPC: primeira impressão, confiança, favores, conflitos, eventos e assuntos pendentes.
- Memória de objetivo: origem, motivo, progresso, consequências e relação pessoal.

`lib/memory/memory-builder.ts` reconstrói somente o contexto relevante antes de cada chamada ao modelo. O validador impede que NPCs mortos, desaparecidos ou que partiram sejam recriados como ativos. Saves v2/v3/v4 são migrados para v5 no carregamento.

## Ciclo visual persistente

- Ações válidas 1–10: GIF 8-bit local `ui_story_parchment_writing_v1`, construído na mesma direção de arte GBA das ilustrações.
- Ações válidas 11–20: uma ilustração escolhida do cache ou gerada uma única vez.
- O padrão se repete, e a mesma imagem permanece por todo o bloco ilustrado.
- Cliques em menus não contam; texto aceito, dado concluído e escolhas contextuais persistidas contam.
- Se a OpenAI estiver indisponível, o jogo usa o melhor cache e depois o pergaminho, sem interromper texto ou input.
- O pergaminho está isolado em `components/ParchmentWriting.tsx`; a fonte fica em `public/assets/parchment-writing-source-v1.png` e o loop otimizado em `public/assets/parchment-writing-v1.gif`.

## Banco visual acumulativo

- `lib/visual/scene-descriptor.ts`: produz o descritor semântico normalizado da cena.
- `lib/visual/semantic-matcher.ts`: pontua emoção, gênero, ação, local, ambiente, intensidade, personagens e diversidade recente.
- `lib/visual/moderation.ts`: converte pedidos inadequados em representações seguras e não gráficas.
- `lib/visual/image-provider.ts`: adaptador do provedor, direção de arte GBA 16-bit e materialização do asset.
- `lib/visual/visual-asset-repository.ts`: banco persistente IndexedDB, circuit breaker e métricas.
- `app/api/visual`: geração opcional e resposta resiliente.
- `components/SceneVisual.tsx`: consulta cache, gera sem bloquear e aplica fallback.
- `components/AdminVisualDashboard.tsx`: assets, cache hit, confiança, custos, falhas e sanitizações.

O banco atual é compartilhado por todas as campanhas no mesmo navegador. Para compartilhamento global entre jogadores, o repositório foi isolado atrás do serviço e pode ser conectado posteriormente a um storage persistente (Vercel Blob/S3 + banco de metadados) sem alterar a HUD ou a Engine.

## Logo oficial

`public/assets/logo.png` é a única fonte do logotipo. `components/Logo.tsx` é reutilizado no menu, abertura, carregamento e HUD, com preload, proporção preservada, transparência e fallback não bloqueante.

Não envie `.next`, `node_modules` ou arquivos `.env` ao GitHub.
