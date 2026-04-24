node --check D:\project\myd4-base-data\viewer\js\builds-app.js
if ($LASTEXITCODE -eq 0) { Write-Host "builds-app.js SYNTAX OK" }
node --check D:\project\myd4-base-data\viewer\js\app.js
if ($LASTEXITCODE -eq 0) { Write-Host "app.js SYNTAX OK" }
node --check D:\project\myd4-base-data\viewer\js\skills-app.js
if ($LASTEXITCODE -eq 0) { Write-Host "skills-app.js SYNTAX OK" }
