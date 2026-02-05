# TechGo

Este repositório agora está organizado em duas partes:

- **Site principal da TechGo**: `index.html` (na raiz)
- **Plataforma TechGoSaude**: tudo dentro de `techgosaude/`

## Estrutura

- `index.html` → site institucional da TechGo
- `techgosaude/` → app completo (login, dashboard, pacientes, etc.)
- `techgosaude/css/`, `techgosaude/js/`, `techgosaude/vendor/` → assets da plataforma
- `techgosaude/cloudflare/stripe-worker/` → worker do Stripe
- `techgosaude/supabase/` → scripts SQL do Supabase

## Como acessar

- Site principal: `index.html`
- Plataforma: `techgosaude/login.html`

## Deploy (GitHub Pages)

- O site principal abre direto na raiz.
- A plataforma fica em `/techgosaude/`.

URLs usadas no Stripe (no worker):

- `https://<seu-dominio>/techgosaude/dashboard.html?checkout=success#dashboard`
- `https://<seu-dominio>/techgosaude/dashboard.html?checkout=cancel#dashboard`

## Observações

- O `index.html` já aponta para os assets e o login dentro de `techgosaude/`.
- Se mudar o nome da pasta `techgosaude`, atualize também os links do `index.html` e as URLs no `wrangler.toml`.
