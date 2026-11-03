# Braço e Escalas

PWA estático (HTML/CSS/JS puro, sem build, sem dependências) que mostra notas, escalas, campo harmônico e acordes no braço do violão/guitarra. Público principal: músico idoso e iniciante. Explicações em linguagem simples são requisito, não enfeite.

## Rodar e testar
- `npm start` (ou `python3 serve.py`) → http://localhost:5173. O servidor manda `Cache-Control: no-store`; não troque por `python3 -m http.server`, que causa tela vazia por cache misturado.
- `npm test` → testes de lógica musical com `node:test` (sem dependências).
- No navegador, recarregar com Cmd+Shift+R (Chrome) / Cmd+Option+R (Safari) após mudanças.
- O dono acompanha no Safari: não abrir Playwright/Chrome para verificar; peça print.

## Arquivos
- `music.js` — teoria pura (sem DOM): afinação, nomes de notas, escalas (intervalos em semitons), campo harmônico, tipos de acorde, textos explicativos.
- `chords.js` — gerador de formas de acorde por força bruta (casas por corda, filtro de tocabilidade, score de facilidade) + formas CAGED fixas.
- `app.js` — estado, renderização das 4 abas (Escalas, Campos, Acordes, Aprender), SVG do braço e dos diagramas.
- `index.html` — estrutura das abas; o conteúdo da aba Aprender é HTML estático.
- `style.css` — tema escuro, tokens em `:root`, `--fs` = escala de fonte (botões A-/A+).
- `sw.js` — service worker network-first; ao mudar a lista de arquivos, suba a versão `C`.
- `docs/ROADMAP.md` (próximos passos e feedback do usuário), `docs/DECISOES.md` (decisões técnicas e licença pendente).

## Convenções
- Notas como pitch class 0–11 (C=0). Cordas indexadas 0 = 6ª (mais grave) … 5 = 1ª (mais aguda). Braço desenhado com a 1ª corda em cima; diagramas de acorde com a 6ª à esquerda.
- Lógica musical fica em `music.js`/`chords.js` e tem teste. Toda mudança de teoria → atualizar `test/`.
- Textos para o usuário em português simples, sem jargão sem explicação.
- Filtros curtos viram botões (`segmentize` em `app.js`); listas longas (nota, escala, tipo) usam `dropdown()` em `app.js`, menu próprio sobre um `<select>` escondido; chame `refreshDropdowns()` se mudar as opções.
- Seções escondidas usam o atributo `hidden`; há `[hidden]{display:none!important}` porque media queries com `display:grid` sobrescreviam.

## Limitações conhecidas
Ver `docs/ROADMAP.md`. Principal: toggle # / b é global (F maior mostra A# em vez de Bb).
