# Braço e Escalas: importa uma pasta inteira (ex.: o pen drive) mantendo as subpastas. WAV vira .m4a (bem menor).
# Uso: importar.ps1 <pasta de origem> [pasta do app onde guardar]
param([Parameter(Mandatory = $true)][string]$Origem, [string]$Destino = '')

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

$py = Ler 'python.txt'
if (-not $py -or -not (Test-Path $py)) { Aviso 'Rode o instalar.bat antes.'; exit 1 }
$pyc = Join-Path (Split-Path $py) 'python.exe'   # com janela, para mostrar o andamento
$env:BRACO_DADOS = $Dados
$ff = Ler 'ffmpeg.txt'
if ($ff) { $env:BRACO_FFMPEG = $ff }
$env:PYTHONIOENCODING = 'utf-8'
Passo "Importando de $Origem (pode levar vários minutos)"
& $pyc (Join-Path $App 'serve.py') importar $Origem $Destino
Ok 'Terminado. Abra o app: aba Base > Minhas gravações.'
