# Braço e Escalas: baixa a versão nova (git pull) e reinicia o servidor. Gravações e banco ficam em %LOCALAPPDATA%\BracoEscalas\dados e não são tocados.

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

Atualiza-Path
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Aviso 'O Git não está instalado. Rode: winget install -e --id Git.Git'; exit 1 }
Passo 'Baixando a versão nova'
git -C $App pull --ff-only
if ($LASTEXITCODE -ne 0) { Aviso 'Não deu para atualizar (sem internet ou arquivos mudados à mão nesta pasta).'; exit 1 }
Passo 'Reiniciando o servidor'
Parar-Servidor
Ok 'Pronto. Abra o app pelo ícone "Braço e Escalas" (se o Chrome estiver aberto, aperte Ctrl+Shift+R).'
