#!/bin/bash
# Runs CodeQL security analysis on the database
# Supports quick mode (custom queries only) and full mode (standard + custom queries)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CODEQL_BIN="$PROJECT_ROOT/tools/codeql/codeql"
DB_PATH="$PROJECT_ROOT/codeql-db"
RESULTS_DIR="$PROJECT_ROOT/codeql-results"
CUSTOM_QUERIES="$PROJECT_ROOT/codeql-custom-queries"

# Parse arguments
QUICK_MODE=false
if [ "$1" = "--quick" ]; then
    QUICK_MODE=true
fi

echo "=================================================="
if [ "$QUICK_MODE" = true ]; then
    echo "CodeQL Quick Analysis (Custom Queries Only)"
else
    echo "CodeQL Full Security Analysis"
fi
echo "=================================================="
echo ""

# Verify CodeQL CLI is installed
if [ ! -f "$CODEQL_BIN" ]; then
    echo "Error: CodeQL CLI not found at $CODEQL_BIN"
    echo ""
    echo "Please run the setup script first:"
    echo "  bash scripts/setup-codeql.sh"
    echo ""
    exit 1
fi

# Verify database exists
if [ ! -d "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    echo ""
    echo "Please create the database first:"
    echo "  npm run security:db"
    echo ""
    exit 1
fi

# Create results directory
mkdir -p "$RESULTS_DIR"

echo "Database: $DB_PATH"
echo "Results: $RESULTS_DIR"
echo ""

# Run custom queries
echo "Running custom security queries..."
echo "  - TokenLogging.ql (token exposure detection)"
echo "  - DomXss.ql (XSS vulnerability detection)"
echo "  - WeakEncryption.ql (encryption issues)"
echo "  - CsrfTokenMishandling.ql (CSRF token security)"
echo "  - SensitiveDataInErrors.ql (error message leakage)"
echo ""

"$CODEQL_BIN" database analyze "$DB_PATH" \
    "$CUSTOM_QUERIES/queries" \
    --format=sarif-latest \
    --output="$RESULTS_DIR/custom-security.sarif" \
    --sarif-category=custom-security \
    2>&1 | grep -v "^Finalizing database" || true

echo ""
echo "✓ Custom queries complete"
echo ""

# Also generate CSV for easy viewing
"$CODEQL_BIN" database analyze "$DB_PATH" \
    "$CUSTOM_QUERIES/queries" \
    --format=csv \
    --output="$RESULTS_DIR/custom-security.csv" \
    2>&1 | grep -v "^Finalizing database" || true

# Run standard security queries if not in quick mode
if [ "$QUICK_MODE" = false ]; then
    echo "Running standard CodeQL security queries..."
    echo "  (This includes CWE coverage and additional vulnerability detection)"
    echo ""

    "$CODEQL_BIN" database analyze "$DB_PATH" \
        --format=sarif-latest \
        --output="$RESULTS_DIR/security-extended.sarif" \
        --sarif-category=security-extended \
        codeql/javascript-queries:Security/CWE \
        2>&1 | grep -v "^Finalizing database" || true

    echo ""
    echo "✓ Standard queries complete"
    echo ""
fi

# Count findings
echo "=================================================="
echo "Analysis Complete"
echo "=================================================="
echo ""

# Parse SARIF to count issues
if command -v jq &> /dev/null; then
    CUSTOM_COUNT=$(jq '[.runs[].results[]] | length' "$RESULTS_DIR/custom-security.sarif" 2>/dev/null || echo "0")
    echo "Custom security findings: $CUSTOM_COUNT"

    if [ "$QUICK_MODE" = false ] && [ -f "$RESULTS_DIR/security-extended.sarif" ]; then
        STANDARD_COUNT=$(jq '[.runs[].results[]] | length' "$RESULTS_DIR/security-extended.sarif" 2>/dev/null || echo "0")
        echo "Standard security findings: $STANDARD_COUNT"
    fi
else
    echo "Note: Install 'jq' to see finding counts"
fi

echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""
echo "Next steps:"
echo "  npm run security:view     # View formatted results"
echo "  cat $RESULTS_DIR/custom-security.csv  # View raw CSV"
echo ""

# Show quick summary if CSV exists
if [ -f "$RESULTS_DIR/custom-security.csv" ]; then
    ISSUE_COUNT=$(tail -n +2 "$RESULTS_DIR/custom-security.csv" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$ISSUE_COUNT" -gt 0 ]; then
        echo "Summary: $ISSUE_COUNT issue(s) found"
        echo ""
        echo "Top issues:"
        tail -n +2 "$RESULTS_DIR/custom-security.csv" | head -n 5 | cut -d',' -f4,5 | sed 's/,/ - /'
        echo ""
    else
        echo "✓ No security issues found!"
        echo ""
    fi
fi
