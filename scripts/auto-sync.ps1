$ErrorActionPreference = 'Continue'
$mutex = [System.Threading.Mutex]::new($false, 'Local\NEMVIA-AutoSync')
if (-not $mutex.WaitOne(0)) {
  $mutex.Dispose()
  exit 0
}
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
function Invoke-RepoGit {
  & git -c "safe.directory=$root" -C $root @args
}

$branch = (Invoke-RepoGit branch --show-current 2>$null | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
  Write-Host 'Auto-sync stopped: open the project on the main branch.'
  exit 1
}

$watcher = [System.IO.FileSystemWatcher]::new($root)
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'LastWrite, FileName, DirectoryName, Size'
$watcher.EnableRaisingEvents = $true
$events = @('Changed', 'Created', 'Deleted', 'Renamed')
foreach ($name in $events) {
  Register-ObjectEvent -InputObject $watcher -EventName $name -SourceIdentifier "Nemvia.AutoSync.$name" | Out-Null
}

Write-Host 'NEMVIA auto-sync is watching for saved file changes.'
try {
  while ($true) {
    $event = Wait-Event -Timeout 1
    if (-not $event) { continue }
    $eventPath = $event.SourceEventArgs.FullPath
    Remove-Event -EventIdentifier $event.EventIdentifier
    if ($eventPath -match '[\\/](\.git|node_modules|dist|\.codex|\.agents)[\\/]') { continue }

    # Wait until the editor has finished writing the file.
    do {
      $event = Wait-Event -Timeout 2
      if ($event) { Remove-Event -EventIdentifier $event.EventIdentifier }
    } while ($event)

    $status = Invoke-RepoGit status --porcelain --untracked-files=all
    if ($LASTEXITCODE -ne 0 -or -not $status) { continue }
    Invoke-RepoGit add -A
    if ($LASTEXITCODE -ne 0) { Write-Host 'Auto-sync: git add failed.'; continue }
    Invoke-RepoGit diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { continue }

    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Invoke-RepoGit commit -m "Auto-sync: $stamp"
    if ($LASTEXITCODE -ne 0) { Write-Host 'Auto-sync: commit failed.'; continue }
    Invoke-RepoGit pull --rebase origin main
    if ($LASTEXITCODE -ne 0) { Write-Host 'Auto-sync: pull/rebase failed; resolve the Git issue, then save again.'; continue }
    Invoke-RepoGit push origin main
    if ($LASTEXITCODE -ne 0) { Write-Host 'Auto-sync: push failed; check GitHub sign-in or network, then save again.'; continue }
    Write-Host "Auto-sync pushed changes at $stamp."
  }
}
finally {
  foreach ($name in $events) { Unregister-Event -SourceIdentifier "Nemvia.AutoSync.$name" -ErrorAction SilentlyContinue }
  $watcher.Dispose()
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
