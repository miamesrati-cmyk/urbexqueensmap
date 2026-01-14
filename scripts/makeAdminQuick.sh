#!/bin/bash

# Script rapide pour donner les droits admin
# Utilise Firebase CLI pour trouver l'UID et donner les droits

echo "🔑 Configuration admin rapide"
echo ""
echo "Entrez votre email Firebase:"
read EMAIL

if [ -z "$EMAIL" ]; then
  echo "❌ Email requis"
  exit 1
fi

echo ""
echo "🔍 Recherche de votre UID..."

# Trouver l'UID (utiliser USER_UID car UID est réservé)
# Supprimer la première ligne qui contient "Exporting accounts to..."
USER_UID=$(firebase auth:export /dev/stdout --format=json 2>&1 | tail -n +2 | jq -r ".users[] | select(.email == \"$EMAIL\") | .localId" | head -n 1)

if [ -z "$USER_UID" ] || [ "$USER_UID" = "null" ]; then
  echo "❌ Utilisateur non trouvé. Vérifiez votre email: $EMAIL"
  echo "   Debug: Sortie brute:"
  firebase auth:export /dev/stdout --format=json 2>&1 | tail -n +2 | jq -r ".users[].email" | head -5
  exit 1
fi

echo "✅ Trouvé! UID: $USER_UID"
echo ""
echo "📝 Attribution des droits admin..."

# Écrire dans Firestore
cat > /tmp/admin.json << EOF
{
  "isAdmin": true,
  "roles": {
    "admin": true
  }
}
EOF

firebase firestore:write "users/$USER_UID" /tmp/admin.json --merge 2>/dev/null

if [ $? -eq 0 ]; then
  echo "✅ SUCCÈS! Vous êtes maintenant admin."
  echo ""
  echo "🔄 Prochaines étapes:"
  echo "   1. Rechargez votre page (Cmd+R ou Ctrl+R)"
  echo "   2. Essayez d'approuver le spot à nouveau"
else
  echo "❌ Erreur lors de l'attribution des droits"
fi

rm -f /tmp/admin.json
