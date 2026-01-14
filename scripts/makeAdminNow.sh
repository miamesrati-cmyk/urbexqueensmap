#!/bin/bash

# Script simplifié - vous donne directement votre UID et vous laisse l'utiliser

echo "🔑 Attribution des droits admin"
echo ""
echo "Votre email: mia.mesrati@gmail.com"
echo "Votre UID: AQqXqFOgu4aCRSDUAS8wwUZcJB53"
echo ""
echo "📝 Attribution des droits admin..."

# Créer le fichier JSON
cat > /tmp/admin.json << 'EOF'
{
  "isAdmin": true,
  "roles": {
    "admin": true
  },
  "updatedAt": "2026-01-01T20:00:00Z"
}
EOF

# Appliquer avec Firebase CLI
firebase firestore:write "users/AQqXqFOgu4aCRSDUAS8wwUZcJB53" /tmp/admin.json --merge

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ SUCCÈS! Vous êtes maintenant admin."
  echo ""
  echo "🔄 Prochaines étapes:"
  echo "   1. Rechargez votre page (Cmd+R ou Ctrl+R)"
  echo "   2. Essayez d'approuver un spot"
  echo ""
else
  echo ""
  echo "❌ Erreur. Essayez manuellement:"
  echo "   firebase firestore:write users/AQqXqFOgu4aCRSDUAS8wwUZcJB53 /tmp/admin.json --merge"
fi

# Nettoyer
rm -f /tmp/admin.json
