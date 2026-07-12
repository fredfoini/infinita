# INFINITA Engine MVP

RPG narrativo de texto com interface inspirada em Game Boy, pronto para Vercel.

## Publicar

1. Envie esta pasta para um repositório GitHub e importe-o na Vercel.
2. Defina `OPENAI_API_KEY` nas variáveis de ambiente para usar a engine de IA.
3. Sem chave, o projeto continua funcionando em modo de demonstração, com progresso guardado no navegador.

Para executar localmente: `npm install` e `npm run dev`.

## Supabase (opcional)

Crie uma tabela `campaigns` com colunas: `id text primary key`, `state jsonb not null`, `updated_at timestamptz default now()`.
Depois configure `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
