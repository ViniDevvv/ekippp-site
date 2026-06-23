# Génère N clés EKIPPP et les exporte en deux fichiers :
# - keys-supabase.sql  → à coller dans Supabase pour les activer
# - keys-sellix.txt    → à uploader dans Sellix (liste de clés)

param(
    [int]$Count = 50
)

$chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # sans 0/O/1/I pour éviter confusion

function New-LicenseKey {
    $groups = 1..4 | ForEach-Object {
        -join (1..4 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    }
    return $groups -join '-'
}

$keys = 1..$Count | ForEach-Object { New-LicenseKey }

# Fichier pour Sellix (une clé par ligne)
$keys | Out-File "keys-sellix.txt" -Encoding utf8
Write-Output "keys-sellix.txt généré ($Count clés)"

# Fichier SQL pour Supabase
$sqlValues = ($keys | ForEach-Object { "('$_')" }) -join ",`n"
$sql = @"
-- Colle ce SQL dans l'éditeur SQL Supabase pour ajouter les clés
INSERT INTO licenses (key) VALUES
$sqlValues;
"@
$sql | Out-File "keys-supabase.sql" -Encoding utf8
Write-Output "keys-supabase.sql généré"
Write-Output ""
Write-Output "Étapes :"
Write-Output "1. Lance le SQL dans Supabase (SQL Editor)"
Write-Output "2. Upload keys-sellix.txt dans ton produit Sellix (Product > Keys)"
