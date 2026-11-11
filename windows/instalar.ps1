# Braço e Escalas: instalação no Windows (roda uma vez; pode repetir sem estragar nada).
#  1. Python 3 (se não tiver) e ffmpeg (diminui os WAV), pelo winget
#  2. Guarda os caminhos em python.txt e ffmpeg.txt (o iniciar.vbs lê daqui)
#  3. Cria a pasta dos dados em %LOCALAPPDATA%\BracoEscalas\dados
#  4. Cria o atalho "Braço e Escalas" na área de trabalho e no menu Iniciar

$ErrorActionPreference = 'Stop'
$Aqui = $PSScriptRoot
$App = Split-Path $Aqui -Parent
$Dados = Join-Path $env:LOCALAPPDATA 'BracoEscalas\dados'
function Ok($t) { Write-Host "  OK  $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  !!  $t" -ForegroundColor Yellow }
function Passo($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan }
function Atualiza-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Ler($nome) { $f = Join-Path $Aqui $nome; if (Test-Path $f) { (Get-Content $f -TotalCount 1).Trim() } else { '' } }
function Parar-Servidor {
  Get-CimInstance Win32_Process -Filter "Name='pythonw.exe' OR Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*serve.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Acha-Python {
  Atualiza-Path
  $teste = "import sys; print(sys.executable if sys.version_info >= (3, 9) else '')"
  foreach ($tentativa in 1, 2) {
    try {
      if ($tentativa -eq 1) { $exe = & py -3 -c $teste 2>$null } else { $exe = & python -c $teste 2>$null }
      if ($LASTEXITCODE -eq 0 -and $exe) {
        $w = Join-Path (Split-Path ([string]$exe).Trim()) 'pythonw.exe'
        if (Test-Path $w) { return $w }
      }
    } catch {}
  }
  return $null
}
function Acha-Ffmpeg {
  Atualiza-Path
  $c = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $c = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages') -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.FullName }
  return $null
}
function Winget($id) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Aviso "winget não existe neste Windows. Instale '$id' pelo site oficial."; return }
  winget install -e --id $id --scope user --accept-package-agreements --accept-source-agreements --silent
  if ($LASTEXITCODE -ne 0) { winget install -e --id $id --accept-package-agreements --accept-source-agreements --silent }
}

Write-Host "Instalando o Braço e Escalas em: $App"

Passo 'Python'
$py = Acha-Python
if (-not $py) { Write-Host '  Instalando o Python...'; Winget 'Python.Python.3.12'; $py = Acha-Python }
if ($py) { Set-Content (Join-Path $Aqui 'python.txt') $py -Encoding ASCII; Ok "Python: $py" }
else { Aviso 'Não consegui instalar o Python. Instale pelo site python.org (marque "Add python.exe to PATH") e rode este instalar de novo.'; exit 1 }

Passo 'ffmpeg (diminui os arquivos WAV ao guardar)'
$ff = Acha-Ffmpeg
if (-not $ff) { Write-Host '  Instalando o ffmpeg...'; Winget 'Gyan.FFmpeg'; $ff = Acha-Ffmpeg }
if ($ff) { Set-Content (Join-Path $Aqui 'ffmpeg.txt') $ff -Encoding ASCII; Ok "ffmpeg: $ff" }
else { Remove-Item (Join-Path $Aqui 'ffmpeg.txt') -ErrorAction SilentlyContinue; Aviso 'Sem ffmpeg: o app funciona, mas os WAV ficam do tamanho original.' }

Passo 'Pasta dos dados (gravações e banco)'
New-Item -ItemType Directory -Force -Path $Dados | Out-Null
Ok $Dados

Passo 'Atalhos'
$ws = New-Object -ComObject WScript.Shell
$alvos = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
foreach ($pasta in $alvos) {
  $lnk = $ws.CreateShortcut((Join-Path $pasta 'Braço e Escalas.lnk'))
  $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $lnk.Arguments = '"' + (Join-Path $Aqui 'iniciar.vbs') + '"'
  $lnk.WorkingDirectory = $App
  $lnk.IconLocation = (Join-Path $Aqui 'icone.ico') + ',0'
  $lnk.Description = 'Notas, escalas, acordes e bases no braço do violão'
  $lnk.Save()
  Ok "Atalho em $pasta"
}

Passo 'Teste'
Parar-Servidor
Start-Process (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + (Join-Path $Aqui 'iniciar.vbs') + '"')
$ok = $false
for ($i = 0; $i -lt 40 -and -not $ok; $i++) {
  Start-Sleep -Milliseconds 500
  try { $ok = (Invoke-WebRequest 'http://localhost:5173/api/estado' -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch {}
}
if ($ok) { Ok 'O app abriu no Chrome. Pronto!' } else { Aviso "O servidor não respondeu. Veja $Dados\servidor.log" ; exit 1 }
Write-Host ""
Write-Host 'Para abrir depois: clique duas vezes no ícone "Braço e Escalas" da área de trabalho.' -ForegroundColor Green
