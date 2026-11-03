# Braço e Escalas

PWA estático (HTML/CSS/JS puro, sem build, sem dependências) que mostra notas, escalas, campo harmônico e acordes no braço do violão/guitarra. Público principal: músico idoso e iniciante. Explicações em linguagem simples são requisito, não enfeite.

## Rodar e testar
- `npm start` (ou `python3 serve.py`) → http://localhost:5173. O servidor manda `Cache-Control: no-store`; não troque por `python3 -m http.server`, que causa tela vazia por cache misturado.
- `npm test` → testes de lógica musical com `node:test` (sem dependências).
- No navegador, recarregar com Cmd+Shift+R (Chrome) / Cmd+Option+R (Safari) após mudanças.
- O dono acompanha no Safari: não abrir Playwright/Chrome para verificar; peça print.

## Arquivos
- `music.js` — teoria pura (sem DOM): afinação, nomes de notas, escalas (intervalos em semitons), campo harmônico, tipos de acorde, textos explicativos.
- `chords.js` — gerador de formas de acorde por força bruta (casas por corda, filtro de tocabilidade, score de facilidade) + formas CAGED fixas + formas pelo braço até a casa 24 (`neckPositions`, `powerChords`, `stringSetTriads`).
- `app.js` — estado, renderização das 6 abas (Escalas, Campos, Acordes, Guitarra, Progressões, Aprender), SVG do braço e dos diagramas.
- `index.html` — estrutura das abas; o conteúdo da aba Aprender é HTML estático.
- `style.css` — cores só em variáveis: tema escuro em `:root`, claro em `:root[data-theme=light]`; no SVG use `fill: 'var(--x)'` (o `el()` joga para `style`). `--fs` = escala de fonte (A-/A+).
- `audio.js` — som de corda gerado no navegador (Karplus-Strong, Web Audio): `playNote`, `strum`, `sequence`, `schedule`; o AudioContext só nasce num toque do usuário (exigência do iOS).
- `sw.js` — service worker network-first; ao mudar a lista de arquivos, suba a versão `C`.
- `docs/ROADMAP.md` (próximos passos e feedback do usuário), `docs/DECISOES.md` (decisões técnicas e licença pendente).

## Armadilhas já encontradas
- `backdrop-filter` no cabeçalho prende elementos `position:fixed` dentro dele: no celular a barra de abas fixa só funciona sem esse filtro.
- Blues: a blue note é escrita como b5 ou #4, a que tiver menos acidentes (`spelledScale`), e o grau acompanha (`scaleDegreeLabels`).

## Commits
Autor sempre Rafael Matos (identidade local do repo). Nunca adicionar Co-Authored-By, "Generated with Claude" ou qualquer marca do Claude em commits/PRs.

## Convenções
- Notas como pitch class 0–11 (C=0). Cordas indexadas 0 = 6ª (mais grave) … 5 = 1ª (mais aguda). Braço desenhado com a 1ª corda em cima; diagramas de acorde com a 6ª à esquerda.
- Lógica musical fica em `music.js`/`chords.js` e tem teste. Toda mudança de teoria → atualizar `test/`.
- Textos para o usuário em português simples, sem jargão sem explicação.
- Filtros curtos viram botões (`segmentize` em `app.js`); listas longas (nota, escala, tipo) usam `dropdown()` em `app.js`, menu próprio sobre um `<select>` escondido; chame `refreshDropdowns()` se mudar as opções.
- Seções escondidas usam o atributo `hidden`; há `[hidden]{display:none!important}` porque media queries com `display:grid` sobrescreviam.

## Limitações conhecidas
Ver `docs/ROADMAP.md`.

## Grafia das notas
Escalas, campos e acordes usam `spelledScale`/`spelledChord` (`music.js`): cada letra uma vez, tônica escrita com # ou b conforme der menos acidentes; empate segue o botão Sustenidos. O botão também vale para notas fora da escala. Pode gerar `##`/`bb` em escalas raras (correto).
