# INFINITA Engine - Sprint Core

RPG narrativo em Next.js no qual a Engine TypeScript é a única autoridade sobre estado, dados, XP, atributos, inventário, combate, missões e persistência. A IA interpreta ações e narra consequências por um contrato JSON controlado.

## Executar

```bash
pnpm install
pnpm dev
```

Validação:

```bash
pnpm test
pnpm build
```

## Vercel

Configure em **Settings > Environment Variables**:

- `GROQ_API_KEY`: chave da API Groq para o Mestre textual.
- `GROQ_MODEL`: opcional; o padrão atual é `llama-3.3-70b-versatile`.

Sem chave ou em caso de falha do provedor, a Engine mantém o turno e usa uma narrativa de segurança. As imagens são locais e não consomem API.

Não envie `.next`, `node_modules` ou arquivos `.env` ao GitHub.

## Arquitetura atual

- `lib/engine.ts`: estado canônico, eventos, regras, progressão, rolagens, inventário, combate, reputação, missões e migração de saves.
- `lib/game-master.ts`: adaptador isolado do provedor de IA e compressão de contexto.
- `app/api/campaign`: criação e contexto inicial de campanha.
- `app/api/turn`: ações, d20, atributos e uso de itens.
- `components/Game.tsx`: frontend que renderiza o estado e solicita comandos à Engine.
- `components/ProceduralScene.tsx`: compositor local de cenas, NPCs, clima e horário.
- `lib/graphics/asset-registry.ts`: catálogo carregado progressivamente no cliente.
- `lib/graphics/scene-composer.ts`: transforma contexto em uma cena genérica reutilizável.
- `lib/graphics/character-composer.ts`: escolhe variantes e paleta de personagens.
- `lib/graphics/building-composer.ts`: monta módulos de cenário sem acoplamento narrativo.
- `lib/graphics/renderer.ts`: desenha as camadas no canvas em 320×180.
- `public/assets/sprite_bible.json`: catálogo gerado automaticamente por `pnpm assets:catalog` e também durante o build.
- `components/IntroSequence.tsx`: abertura leve de aproximadamente 12 segundos, com opção de pular.

## Interface V2

A HUD segue proporção de portátil 16-bit no desktop e vira uma experiência mobile-first em telas menores. A barra de ação permanece fixa no celular; mochila, mapa, missões, ficha e diário abrem em um painel lateral recolhível. Teclado, toque e botão principal de gamepad são aceitos.

## Persistência e memória

Cada campanha recebe UUID e é salva automaticamente no `localStorage` por revisão. Saves da versão anterior são migrados na abertura. A memória é dividida em curto, médio e longo prazo; somente um contexto mínimo é enviado à IA.

## WebLLM

A Engine e o adaptador do Mestre foram desacoplados para permitir WebLLM ou outro provedor no futuro. A migração para WebLLM ficou deliberadamente fora desta sprint, conforme priorização do produto.
