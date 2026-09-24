# push.ps1 — Script per push rapido su GitHub via SSH
# Uso: .\push.ps1 "messaggio del commit"

param(
    [string]$Message = "update: modifiche automatiche"
)

$git = "C:\Program Files\Git\cmd\git.exe"
$env:GIT_SSH_COMMAND = '"C:/Program Files/Git/usr/bin/ssh.exe" -i "C:/Users/HP/.ssh/id_ed25519_github" -o StrictHostKeyChecking=no'

Write-Host "📦 Aggiunta file modificati..." -ForegroundColor Cyan
& $git add .

Write-Host "✍️  Commit: $Message" -ForegroundColor Cyan
& $git commit -m $Message

Write-Host "🚀 Push su GitHub (main)..." -ForegroundColor Cyan
& $git push origin main

Write-Host "✅ Deploy su Vercel in corso — controlla https://gestione-sala-prove-musicale.vercel.app/" -ForegroundColor Green
