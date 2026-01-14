#!/bin/bash

# Script pour donner les droits admin via Firebase CLI
# Usage: ./scripts/setAdminCli.sh <email>

EMAIL=$1

if [ -z "$EMAIL" ]; then
  echo "❌ Usage: ./scripts/setAdminCli.sh <email>"
  echo "   Exemple: ./scripts/setAdminCli.sh admin@example.com"
  exit 1
fi

echo "🔍 Recherche de l'utilisateur avec l'email: $EMAIL"

# Utiliser Firebase CLI pour obtenir l'UID
UID=$(firebase auth:export /dev/stdout --format=json 2>/dev/null | jq -r ".users[] | select(.email == \"$EMAIL\") | .localId")

if [ -z "$UID" ] || [ "$UID" = "null" ]; then
  echo "❌ Utilisateur non trouvé avec l'email: $EMAIL"
  echo "   Assurez-vous que l'utilisateur existe dans Firebase Authentication"
  exit 1
fi

echo "✅ Utilisateur trouvé: UID = $UID"
echo "📝 Attribution des droits admin..."

# Créer un fichier temporaire avec les données à mettre à jour
cat > /tmp/admin-update.json << EOF
{
  "isAdmin": true,
  "roles": {
    "admin": true
  },
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

# Utiliser Firebase CLI pour mettre à jour le document
firebase firestore:write "users/$UID" /tmp/admin-update.json --merge

if [ $? -eq 0 ]; then
  echo "✅ Droits admin attribués avec succès !"
  echo "   Rechargez la page pour appliquer les changements."
else
  echo "❌ Erreur lors de l'attribution des droits admin"
  exit 1
fi

# Nettoyer
rm /tmp/admin-update.json
