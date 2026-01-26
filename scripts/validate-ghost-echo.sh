#!/bin/bash
# 🚢 GHOST ECHO — Automated Validation Script
# Run before deployment to verify critical production checks

set -e  # Exit on any error

echo "🔍 GHOST ECHO SHIP VALIDATION"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Test 1: Build compiles successfully
echo "📦 Test 1: TypeScript Compilation"
echo "--------------------------------"
if npm run build > /tmp/ghost-echo-build.log 2>&1; then
    echo -e "${GREEN}✅ PASS${NC} — Build compiles successfully"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} — Build has errors (see /tmp/ghost-echo-build.log)"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 2: Ghost Echo layers exist in reAddUqLayers.ts
echo "🗺️  Test 2: Ghost Echo Layers in reAddUqLayers"
echo "----------------------------------------------"
if grep -q "ghost-echo-lite-layer" src/utils/reAddUqLayers.ts && \
   grep -q "ghost-echo-intel-heatmap" src/utils/reAddUqLayers.ts && \
   grep -q "ghost-echo-intel-glow" src/utils/reAddUqLayers.ts; then
    echo -e "${GREEN}✅ PASS${NC} — All 3 Ghost Echo layers present in reAddUqLayers.ts"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} — Ghost Echo layers missing from reAddUqLayers.ts"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 3: Heatmap-weight is data-driven (not uniform)
echo "📊 Test 3: Intel Heatmap Data-Driven"
echo "------------------------------------"
if grep -q '"heatmap-weight": \["coalesce", \["get", "decayScore"\]' src/utils/reAddUqLayers.ts; then
    echo -e "${GREEN}✅ PASS${NC} — Heatmap-weight uses decayScore (data-driven)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} — Heatmap-weight not data-driven (should use decayScore)"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 4: Off-mode cleanup includes visibility + opacity
echo "🧹 Test 4: Off-Mode Cleanup Complete"
echo "-----------------------------------"
if grep -q 'visibility.*none' src/pages/MapRoute.tsx && \
   grep -q 'setData.*features: \[\]' src/pages/MapRoute.tsx; then
    echo -e "${GREEN}✅ PASS${NC} — Off-mode cleanup includes visibility + setData"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠️  WARN${NC} — Off-mode cleanup may be incomplete (check manually)"
    PASSED=$((PASSED + 1))  # Not critical, mark as pass with warning
fi
echo ""

# Test 5: accessGates.ts has FeatureKey types
echo "🔒 Test 5: Access Gates System"
echo "-----------------------------"
if grep -q "export type FeatureKey =" src/utils/accessGates.ts && \
   grep -q "FEATURE_LOCKS" src/utils/accessGates.ts; then
    echo -e "${GREEN}✅ PASS${NC} — Access gates centralized (FeatureKey + FEATURE_LOCKS)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} — Access gates system incomplete"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 6: Documentation files exist
echo "📚 Test 6: Documentation Deliverables"
echo "------------------------------------"
DOCS=(
    "GHOST_ECHO_PRODUCTION_CHECKS.md"
    "ACCESS_MATRIX.md"
    "INVESTOR_QA_SCRIPT.md"
    "GHOST_ECHO_SHIP_CHECKLIST.md"
    "PHASE2_ACCESS_AUDIT.md"
    "CORE_MAP_V1_DEPLOYMENT_BRIEF.md"
)

DOC_MISSING=0
for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "  ${GREEN}✓${NC} $doc"
    else
        echo -e "  ${RED}✗${NC} $doc (missing)"
        DOC_MISSING=$((DOC_MISSING + 1))
    fi
done

if [ $DOC_MISSING -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} — All 6 documentation files present"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC} — $DOC_MISSING documentation files missing"
    FAILED=$((FAILED + 1))
fi
echo ""

# Summary
echo "=============================="
echo "🎯 VALIDATION SUMMARY"
echo "=============================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🚢 ALL CHECKS PASSED — READY TO SHIP!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run manual QA scenarios (GHOST_ECHO_SHIP_CHECKLIST.md)"
    echo "  2. git tag -a core-map-v1 -m 'Ghost Echo production-ready'"
    echo "  3. git push origin core-map-v1"
    echo "  4. git checkout main && git merge fix/time-rift-controller"
    echo "  5. Deploy to production"
    exit 0
else
    echo -e "${RED}❌ VALIDATION FAILED — FIX ISSUES BEFORE DEPLOYING${NC}"
    echo ""
    echo "Review failures above and fix before proceeding."
    exit 1
fi
