param(
  [switch]$SkipLocalBuild
)

$ErrorActionPreference = "Stop"

$env:BACKEND_URL = "https://staging-api.chaekdojang.com"
$env:NEXT_PUBLIC_API_BASE_URL = "https://staging-api.chaekdojang.com"
$env:NEXT_PUBLIC_SITE_URL = "https://staging.chaekdojang.com"

if (-not $SkipLocalBuild) {
  npm run build
}

$deployOutput = & cmd.exe /c "npx vercel deploy --yes --archive=tgz 2>&1"
$deployExitCode = $LASTEXITCODE
$deployOutput | ForEach-Object { Write-Output $_ }

if ($deployExitCode -ne 0) {
  throw "Vercel deploy failed with exit code $deployExitCode."
}

$previewUrl = ($deployOutput | Select-String -Pattern "https://[^\s`"']+\.vercel\.app" -AllMatches |
  ForEach-Object { $_.Matches.Value } |
  Where-Object { $_ -notmatch "vercel\.com/" } |
  Select-Object -First 1)

if (-not $previewUrl) {
  throw "Vercel preview URL을 찾지 못했습니다."
}

& cmd.exe /c "npx vercel alias set $previewUrl staging.chaekdojang.com"
Write-Output "staging.chaekdojang.com -> $previewUrl"
