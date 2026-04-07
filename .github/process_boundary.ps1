$d = Get-Content 'D:\LNB\sadaksath\.firebase\nepal_boundary.json' -Raw | ConvertFrom-Json
$coords = @()
foreach ($c in $d.features[0].geometry.coordinates[0]) {
    $coords += ,@($c[0], $c[1])
}
$geojson = @{
    type = "FeatureCollection"
    features = @(
        @{
            type = "Feature"
            properties = @{
                name = "Nepal"
            }
            geometry = @{
                type = "Polygon"
                coordinates = @($coords)
            }
        }
    )
}
$geojson | ConvertTo-Json -Depth 20 | Set-Content -Path 'D:\LNB\sadaksath\backend\data\boundary.geojson' -Encoding UTF8
Write-Host "Done! Boundary updated with $($coords.Count) coordinates"