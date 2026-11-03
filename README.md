# Braço e Escalas

Aplicativo web (instalável no celular) para estudar o braço do violão e da guitarra:

- **Escalas** — maior, menor, harmônicas, melódica, pentatônicas e blues, desenhadas no braço (12 ou 24 casas), com tônica destacada e explicação de cada escala.
- **Campo harmônico** — os acordes de cada escala, com graus em algarismos romanos.
- **Acordes** — 11 tipos, nas 12 notas, com formas geradas automaticamente, filtros (região, cordas soltas, pestana, inversões, nº de cordas) e as 5 formas do **sistema CAGED**.
- **Guitarra** — power chords, tríades por grupo de cordas (com inversões) e acordes como 7(#9), add9 e 6/9, espalhados pelas 24 casas.
- **Progressões** — as sequências de acordes mais usadas (I–IV–V, pop, ii–V–I, blues de 12 compassos, andaluza…) em qualquer tom, com cada acorde no braço.
- **Aprender** — explicações em linguagem simples para quem está começando.
- **Som** — toque nas notas do braço ou nos desenhos de acorde para ouvir; botões para ouvir escalas, acordes e tocar progressões inteiras.
- **Tema claro e escuro** e ajuste do tamanho da letra.

Funciona offline, sem anúncios, sem cadastro e sem dependências.

## Usar / instalar

Abra **https://rafaelmatos1512.github.io/braco-escalas/** e instale:

- **Windows (Edge ou Chrome):** clique no ícone de instalar na barra de endereço (um monitor com seta, ou "Aplicativo disponível") → **Instalar**. Ele aparece no menu Iniciar e funciona sem internet.
  - No Edge, se o ícone não aparecer: menu **⋯** → **Aplicativos** → **Instalar este site como um aplicativo**.
- **Mac (Safari):** menu **Arquivo → Adicionar ao Dock**. No Chrome: ícone de instalar na barra de endereço.
- **Celular:** Compartilhar → **Adicionar à Tela de Início**.

## Rodar localmente

```bash
npm start      # ou: python3 serve.py  → http://localhost:5173
npm test       # testes da lógica musical (Node 18+)
```

Para ver no celular, conecte na mesma Wi-Fi e abra `http://<IP-do-computador>:5173`.

## Estrutura

| Arquivo | Papel |
|---|---|
| `music.js` | Teoria musical (escalas, campos, tipos de acorde) |
| `chords.js` | Gerador de formas de acorde e CAGED |
| `app.js` | Interface e desenho do braço |
| `index.html` / `style.css` | Estrutura e visual |
| `sw.js` / `manifest.webmanifest` | PWA (instalação e offline) |

## Licença

A definir — ver `docs/DECISOES.md`.
