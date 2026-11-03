# Braço e Escalas

Aplicativo web (instalável no celular) para estudar o braço do violão e da guitarra:

- **Escalas** — maior, menor, harmônicas, melódica, pentatônicas e blues, desenhadas no braço (12 ou 24 casas), com tônica destacada e explicação de cada escala.
- **Campo harmônico** — os acordes de cada escala, com graus em algarismos romanos.
- **Acordes** — 11 tipos, nas 12 notas, com formas geradas automaticamente, filtros (região, cordas soltas, pestana, inversões, nº de cordas) e as 5 formas do **sistema CAGED**.
- **Aprender** — explicações em linguagem simples para quem está começando.

Funciona offline, sem anúncios, sem cadastro e sem dependências.

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
