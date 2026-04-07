# ===========================================
# MeroSadak Project Synchronizer
# ===========================================
Write-Host "Updating branding to MeroSadak..." -ForegroundColor Cyan

# Stage all the branding changes
git add . 

# Commit with the new branding name
git commit -m "chore: complete the rebranding to MeroSadak across all packages"

# Pull latest to prevent conflicts
git pull --rebase

# Push to your GitHub repo
git push

Write-Host "Sync Complete! All branding is now live on GitHub." -ForegroundColor Green
