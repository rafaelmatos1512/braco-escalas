# Instalar o Braço e Escalas no Windows

Para o computador de quem vai usar o app (Windows 10 ou 11, com Google Chrome).
Depois de instalado, a pessoa só clica no ícone **Braço e Escalas** da área de trabalho: o servidor liga
sozinho, escondido, e o app abre no Chrome numa janela própria. Nada de terminal, nada de `npm start`.

Tudo fica no computador dele, sem internet e sem custo:

| O quê | Onde | Tamanho |
|---|---|---|
| App (código) | `%USERPROFILE%\braco-escalas` | ~3 MB |
| Gravações e banco | `%LOCALAPPDATA%\BracoEscalas\dados` | ~1,1 GB com o pen drive inteiro |
| Python + ffmpeg | instalados pelo `winget` | ~250 MB |

As gravações ficam **fora** da pasta do app de propósito: atualizar ou reinstalar o app não apaga nada.

---

## Jeito 1: o agente faz tudo (Antigravity ou outro)

1. Entre na conta do Windows dele, abra o Antigravity e dê acesso ao terminal.
2. Conecte o pen drive.
3. Cole o texto abaixo para o agente:

```text
Instale o app "Braço e Escalas" neste Windows seguindo o arquivo docs/WINDOWS.md do repositório
https://github.com/rafaelmatos1512/braco-escalas (repositório privado: quando o Git pedir, eu faço o login no GitHub).

Passos:
1. Se não tiver Git: winget install -e --id Git.Git  (depois abra um terminal novo).
2. git clone https://github.com/rafaelmatos1512/braco-escalas.git "%USERPROFILE%\braco-escalas"
3. Rode %USERPROFILE%\braco-escalas\windows\instalar.bat e espere terminar.
   Ele instala Python e ffmpeg pelo winget, cria o atalho "Braço e Escalas" na área de trabalho e abre o app no Chrome.
   Se algum passo aparecer com "!!", leia a mensagem e resolva (ex.: instalar o Python pelo python.org) e rode de novo.
4. Descubra a letra do pen drive (ex.: E:) e rode:
   %USERPROFILE%\braco-escalas\windows\importar.bat "E:\" "Pen drive"
   Isso copia os áudios mantendo as pastas (tom > ritmo) e diminui os WAV. Pode levar 20 a 40 minutos.
5. Confira: abra o atalho, vá na aba Base > Minhas gravações e toque uma faixa.

Regras:
- Não mude nenhum arquivo de código do app.
- Nunca apague nada em %LOCALAPPDATA%\BracoEscalas\dados (são as gravações dele).
- Não instale nada além de Git, Python e ffmpeg.
- No fim, me diga o que fez e se algum passo deu erro (com a mensagem exata).
```

---

## Jeito 2: na mão, passo a passo

### 1. Baixar o app
1. Abra o **Prompt de Comando** (tecla Windows, digite `cmd`, Enter).
2. Se não tiver Git, instale e feche/abra o Prompt de novo:
   ```
   winget install -e --id Git.Git
   ```
3. Baixe o app:
   ```
   git clone https://github.com/rafaelmatos1512/braco-escalas.git "%USERPROFILE%\braco-escalas"
   ```
   O repositório é privado: vai abrir uma janela do GitHub para entrar. Mais seguro do que usar a sua
   conta inteira: crie um *fine-grained token* só de leitura, só para este repositório
   (GitHub > Settings > Developer settings > Personal access tokens) e use como senha.

### 2. Instalar
1. Abra a pasta `braco-escalas\windows` no Explorador de Arquivos.
2. Clique duas vezes em **`instalar.bat`**.
   - Instala o Python e o ffmpeg (pode aparecer uma janela pedindo permissão: aceite).
   - Cria o atalho **Braço e Escalas** na área de trabalho e no menu Iniciar.
   - No fim, abre o app no Chrome e mostra "Pronto!".
3. Se aparecer `!!` em amarelo, siga a mensagem. Pode rodar o `instalar.bat` quantas vezes precisar.

### 3. Trazer as gravações do pen drive
Escolha **um** dos dois:

- **Pelo app** (a própria pessoa consegue fazer depois):
  aba **Base** > **Minhas gravações** > **+ Adicionar backing tracks** > escolha a pasta no pen drive
  (ex.: `11 - B. T. EM - A MAIOR`, ou o pen drive inteiro) > **Enviar** no aviso do Chrome.
  As pastas de dentro (Blues, Pop…) vêm junto. Para guardar dentro de uma pasta do app, abra a pasta antes.
- **Tudo de uma vez** (mais rápido para o pen drive inteiro):
  ```
  %USERPROFILE%\braco-escalas\windows\importar.bat "E:\" "Pen drive"
  ```
  Troque `E:` pela letra do pen drive. O segundo nome é a pasta do app onde tudo entra (pode deixar sem).

O que já foi guardado não se repete, então dá para importar de novo depois de pôr mais coisa no pen drive.
Arquivos WAV viram M4A, uns 15 vezes menores (um WAV de 64 MB fica com 4 MB).

### 4. Pôr como app no Chrome (opcional)
O atalho já abre o app numa janela própria, sem barra de endereço. Para fixar na barra de tarefas:
com o app aberto, clique com o botão direito no ícone dele na barra de tarefas > **Fixar na barra de tarefas**.

---

## Depois de instalado

| Para… | Faça |
|---|---|
| Abrir | Clique duas vezes em **Braço e Escalas** na área de trabalho |
| Atualizar o app | `windows\atualizar.bat` (baixa a versão nova e reinicia; as gravações continuam) |
| Fazer cópia de segurança | Copie a pasta `%LOCALAPPDATA%\BracoEscalas\dados` inteira para o pen drive |
| Restaurar a cópia | Feche o Chrome, cole a pasta `dados` de volta no mesmo lugar |

Para abrir a pasta dos dados: tecla Windows + R, digite `%LOCALAPPDATA%\BracoEscalas` e Enter.

## Quando algo dá errado

| Problema | O que fazer |
|---|---|
| "Não encontrei o Python" | Rode `windows\instalar.bat` de novo |
| "não conseguiu ligar" | Reinicie o Windows. Se continuar, veja `%LOCALAPPDATA%\BracoEscalas\dados\servidor.log` |
| Tela vazia ou velha | No Chrome, aperte **Ctrl+Shift+R** |
| WAV não diminui | Falta o ffmpeg: rode `windows\instalar.bat` de novo e veja a parte "ffmpeg" |
| Atualizar dá erro | Sem internet, ou alguém mudou arquivo da pasta do app à mão. Rode `git -C "%USERPROFILE%\braco-escalas" status` |

## Como funciona (para quem mantém)
- `windows\iniciar.vbs`: confere se `http://localhost:5173/api/estado` responde; se não, liga `pythonw serve.py`
  (sem janela) com `BRACO_DADOS` e `BRACO_FFMPEG`, espera responder e abre `chrome --app=http://localhost:5173/`.
- `windows\instalar.ps1`: instala Python/ffmpeg com `winget`, grava os caminhos em `windows\python.txt` e
  `windows\ffmpeg.txt` (fora do git; assim não depende do PATH, que só se atualiza depois de sair e entrar no Windows)
  e cria os atalhos.
- O servidor só aceita conexões do próprio computador (`127.0.0.1`). Modo simples, sem login.
- Os scripts estão em CRLF e com codificação própria (`.vbs` em Windows-1252, `.ps1` em UTF-8 com BOM);
  o `.gitattributes` impede o git de mexer nisso.
