$ErrorActionPreference = 'Continue'
$files = @(
    'D:\project\myd4-base-data\viewer\js\builds-app.js',
    'D:\project\myd4-base-data\viewer\js\app.js',
    'D:\project\myd4-base-data\viewer\js\skills-app.js'
)
foreach ($f in $files) {
    $result = node --check $f 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $f"
    } else {
        Write-Host "[FAIL] $f : $result"
    }
}
