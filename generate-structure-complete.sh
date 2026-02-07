#!/bin/bash

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           🎯 GÉNÉRATION STRUCTURE COMPLÈTE DRY               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "📁 Génération de la structure complète du projet DRY..."
echo ""

# Créer le fichier de sortie
output_file="structure-complete-dry.txt"

# En-tête
cat > "$output_file" << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           🎯 STRUCTURE COMPLÈTE DU PROJET DRY                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

📅 Date: $(date)
📁 Racine: $(pwd)

══════════════════════════════════════════════════════════════

📦 STRUCTURE PRINCIPALE:
───────────────────
EOF

# Lister les dossiers principaux de dryApp
if [ -d "dryApp" ]; then
    find dryApp -maxdepth 1 -type d | sed 's|.*/||' | grep -v "dryApp$" >> "$output_file"
fi

echo "" >> "$output_file"
echo "📁 Contenu de dryApp\:" >> "$output_file"
echo "───────────────────────" >> "$output_file"

# Lister tous les fichiers de dryApp (sauf node_modules et .git)
if [ -d "dryApp" ]; then
    find dryApp -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | sort >> "$output_file"
fi

echo "" >> "$output_file"
echo "📚 Applications présentes:" >> "$output_file"
echo "────────────────────────" >> "$output_file"

# Lister les applications
if [ -d "dryApp" ]; then
    find dryApp -maxdepth 1 -type d | sed 's|.*/||' | grep -v "dryApp$" | sed 's/^/📱 /' >> "$output_file"
fi

echo "" >> "$output_file"
echo "══════════════════════════════════════════════════════════════" >> "$output_file"
echo "" >> "$output_file"
echo "📋 Détail par application:" >> "$output_file"
echo "────────────────────────" >> "$output_file"

# Détail par application
if [ -d "dryApp" ]; then
    for app_dir in dryApp/*/; do
        if [ -d "$app_dir" ]; then
            app_name=$(basename "$app_dir")
            echo "" >> "$output_file"
            echo "📱 Application: $app_name" >> "$output_file"
            echo "────────────────────────" >> "$output_file"
            find "$app_dir" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | sort >> "$output_file"
            echo "" >> "$output_file"
        fi
    done
fi

echo "══════════════════════════════════════════════════════════════" >> "$output_file"
echo "" >> "$output_file"
echo "🔍 Fichiers de configuration principaux:" >> "$output_file"
echo "──────────────────────────────────────" >> "$output_file"

# Fichiers de configuration
for file in package.json package-lock.json .env server.js; do
    if [ -f "$file" ]; then
        echo "$file" >> "$output_file"
    fi
done

echo "" >> "$output_file"
echo "📁 Structure du dossier dry\:" >> "$output_file"
echo "───────────────────────────" >> "$output_file"

if [ -d "dry" ]; then
    find dry -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | sort >> "$output_file"
fi

echo "" >> "$output_file"
echo "📝 Scripts et outils:" >> "$output_file"
echo "────────────────────" >> "$output_file"

if [ -d "scripts" ]; then
    find scripts -type f | sort >> "$output_file"
fi

echo "" >> "$output_file"
echo "══════════════════════════════════════════════════════════════" >> "$output_file"
echo "" >> "$output_file"
echo "📊 STATISTIQUES:" >> "$output_file"
echo "─────────────" >> "$output_file"

# Statistiques
js_count=0
json_count=0
app_count=0

if [ -d "dryApp" ]; then
    js_count=$(find dryApp -name "*.js" ! -path "*/node_modules/*" ! -path "*/.git/*" | wc -l)
    json_count=$(find dryApp -name "*.json" ! -path "*/node_modules/*" ! -path "*/.git/*" | wc -l)
    app_count=$(find dryApp -maxdepth 1 -type d | grep -v "dryApp$" | wc -l)
fi

echo "📄 Fichiers JS: $js_count" >> "$output_file"
echo "📋 Fichiers JSON: $json_count" >> "$output_file"
echo "📱 Applications: $app_count" >> "$output_file"

echo "" >> "$output_file"
echo "══════════════════════════════════════════════════════════════" >> "$output_file"
echo "" >> "$output_file"
echo "✅ Génération terminée avec succès !" >> "$output_file"
echo "📄 Fichier créé: $output_file" >> "$output_file"

echo "✅ Génération terminée avec succès !" >&2
echo "📄 Fichier créé: $output_file" >&2
echo ""

echo "📂 Affichage du fichier..."
echo ""
cat "$output_file"

echo ""
echo "📋 Fichier sauvegardé dans: $output_file"
echo ""
read -p "Appuyez sur Entrée pour quitter..."
