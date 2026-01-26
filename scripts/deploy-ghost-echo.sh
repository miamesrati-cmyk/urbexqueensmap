#!/bin/bash
# 🚢 Ghost Echo Deployment Script
# Run AFTER manual QA validation passes

set -e

echo "🚢 GHOST ECHO — DEPLOYMENT"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Verify we're on the right branch
echo "📍 Step 1: Verify Branch"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "fix/time-rift-controller" ]; then
    echo "❌ ERROR: Not on fix/time-rift-controller branch (currently on $CURRENT_BRANCH)"
    echo "Run: git checkout fix/time-rift-controller"
    exit 1
fi
echo -e "${GREEN}✅${NC} On fix/time-rift-controller branch"
echo ""

# Step 2: Check for uncommitted changes
echo "📍 Step 2: Check Working Tree"
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  WARNING: You have uncommitted changes"
    git status --short
    echo ""
    read -p "Commit changes before tagging? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "chore: final Ghost Echo production checks + documentation"
        echo -e "${GREEN}✅${NC} Changes committed"
    else
        echo "Continuing without committing..."
    fi
fi
echo -e "${GREEN}✅${NC} Working tree ready"
echo ""

# Step 3: Create and push tag
echo "📍 Step 3: Create Tag core-map-v1"
if git tag -a core-map-v1 -m "Ghost Echo production-ready + MapRoute access controls documented

🎯 What's in this release:
- Ghost Echo (tiered: Guest/Free → Lite, Pro → Intel heatmap)
- MapRoute Pro gates (Satellite, Cluster, Time Rift)
- Style switch resilience (Ghost Echo layers in reAddUqLayers)
- Data-driven Intel (heatmap uses decayScore)
- Access control audit Phase 1 complete (11/37 features)

📚 Documentation:
- GHOST_ECHO_PRODUCTION_CHECKS.md
- ACCESS_MATRIX.md (37 features catalogued)
- INVESTOR_QA_SCRIPT.md (10 test scenarios)
- PHASE2_ACCESS_AUDIT.md (roadmap for next sprint)
- CORE_MAP_V1_DEPLOYMENT_BRIEF.md

🔒 Defense in depth verified for core features (UI + logic + backend)
"; then
    echo -e "${GREEN}✅${NC} Tag core-map-v1 created"
else
    echo "⚠️  Tag core-map-v1 already exists"
    read -p "Delete and recreate tag? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d core-map-v1
        git tag -a core-map-v1 -m "Ghost Echo production-ready + MapRoute access controls"
        echo -e "${GREEN}✅${NC} Tag core-map-v1 recreated"
    fi
fi

echo ""
echo "📍 Step 4: Push Tag to Remote"
git push origin core-map-v1 --force
echo -e "${GREEN}✅${NC} Tag pushed to origin"
echo ""

# Step 5: Switch to main and merge
echo "📍 Step 5: Merge to Main Branch"
echo -e "${YELLOW}⚠️  About to merge fix/time-rift-controller → main${NC}"
read -p "Proceed with merge? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Merge cancelled. Tag core-map-v1 is ready, merge manually when ready."
    exit 0
fi

git checkout main
git pull origin main
git merge fix/time-rift-controller -m "feat: Ghost Echo production release (core-map-v1)

🎯 Major Features:
- Ghost Echo tiered access (Guest/Free → Lite, Pro → Intel)
- MapRoute Pro gates (Satellite, Cluster, Time Rift)
- Style switch resilience + off-mode cleanup
- Data-driven Intel heatmap (decayScore)

📊 Access Audit:
- 37 features catalogued and documented
- 11/37 features fully audited (MapRoute + MapProPanel)
- Phase 2 sprint planned (Spot Detail, Social, Admin)

See CORE_MAP_V1_DEPLOYMENT_BRIEF.md for full details.
"
echo -e "${GREEN}✅${NC} Merged to main"
echo ""

# Step 6: Push main
echo "📍 Step 6: Push Main to Remote"
git push origin main
echo -e "${GREEN}✅${NC} Main branch pushed"
echo ""

# Step 7: Deploy instructions
echo "=========================="
echo "🎉 READY TO DEPLOY!"
echo "=========================="
echo ""
echo "Next steps:"
echo ""
echo "  Option A: Firebase Hosting"
echo "    $ npm run deploy:hosting"
echo ""
echo "  Option B: Your custom deployment"
echo "    (Vercel, Netlify, etc.)"
echo ""
echo "After deployment:"
echo "  1. Test production URL (map loads, Ghost Echo works)"
echo "  2. Post release notes (use CORE_MAP_V1_DEPLOYMENT_BRIEF.md templates)"
echo "  3. Create Phase 2 ticket (PHASE2_ACCESS_AUDIT.md)"
echo ""
echo "✨ Ghost Echo is officially live!"
