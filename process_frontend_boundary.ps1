$d = Get-Content 'D:\LNB\sadaksath\.firebase\nepal_boundary.json' -Raw | ConvertFrom-Json
$coords = @()
foreach ($c in $d.features[0].geometry.coordinates[0]) {
    $coords += "[@($($c[1]), $($c[0])]"
}
$fallback = "const FALLBACK_NEPAL_BOUNDARY: [number, number][] = [`n" + ($coords -join ",`n") + "`n];"
$fallback | Set-Content -Path 'D:\LNB\sadaksath\frontend_boundary.txt' -Encoding UTF8
Write-Host "Done! Created fallback with $($coords.Count) coordinates"