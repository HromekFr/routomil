#!/bin/bash
# Verifies CodeQL CLI installation and configuration
# Checks all required files and directories exist

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CODEQL_BIN="$PROJECT_ROOT/tools/codeql/codeql"

echo "=================================================="
echo "CodeQL Setup Verification"
echo "=================================================="
echo ""

# Track overall status
ALL_CHECKS_PASSED=true

# Function to check and report status
check_item() {
    local item=$1
    local check_type=$2  # "file" or "dir"
    local required=$3    # true or false

    if [ "$check_type" = "file" ]; then
        if [ -f "$item" ]; then
            echo "✓ $item"
            return 0
        fi
    elif [ "$check_type" = "dir" ]; then
        if [ -d "$item" ]; then
            echo "✓ $item"
            return 0
        fi
    fi

    if [ "$required" = true ]; then
        echo "✗ $item (MISSING - required)"
        ALL_CHECKS_PASSED=false
    else
        echo "⚠ $item (not found - will be created)"
    fi
    return 1
}

# Check CodeQL CLI
echo "1. CodeQL CLI Installation"
echo "----------------------------"
if check_item "$CODEQL_BIN" "file" true; then
    VERSION=$("$CODEQL_BIN" version --format=text 2>/dev/null | head -n1 || echo "unknown")
    echo "   Version: $VERSION"
else
    echo "   Run: bash scripts/setup-codeql.sh"
fi
echo ""

# Check directory structure
echo "2. Directory Structure"
echo "----------------------------"
check_item "$PROJECT_ROOT/tools/codeql" "dir" true
check_item "$PROJECT_ROOT/codeql-custom-queries" "dir" true
check_item "$PROJECT_ROOT/codeql-custom-queries/lib" "dir" true
check_item "$PROJECT_ROOT/codeql-custom-queries/queries" "dir" true
check_item "$PROJECT_ROOT/scripts" "dir" true
check_item "$PROJECT_ROOT/docs" "dir" true
check_item "$PROJECT_ROOT/codeql-db" "dir" false
check_item "$PROJECT_ROOT/codeql-results" "dir" false
echo ""

# Check configuration files
echo "3. Configuration Files"
echo "----------------------------"
check_item "$PROJECT_ROOT/codeql-config.yml" "file" true
check_item "$PROJECT_ROOT/codeql-custom-queries/qlpack.yml" "file" true
echo ""

# Check custom query library
echo "4. Custom Query Library"
echo "----------------------------"
check_item "$PROJECT_ROOT/codeql-custom-queries/lib/SecurityConcepts.qll" "file" true
echo ""

# Check custom queries
echo "5. Custom Security Queries"
echo "----------------------------"
check_item "$PROJECT_ROOT/codeql-custom-queries/queries/TokenLogging.ql" "file" true
check_item "$PROJECT_ROOT/codeql-custom-queries/queries/DomXss.ql" "file" true
check_item "$PROJECT_ROOT/codeql-custom-queries/queries/WeakEncryption.ql" "file" true
check_item "$PROJECT_ROOT/codeql-custom-queries/queries/CsrfTokenMishandling.ql" "file" true
check_item "$PROJECT_ROOT/codeql-custom-queries/queries/SensitiveDataInErrors.ql" "file" true
check_item "$PROJECT_ROOT/codeql-custom-queries/queries/PostMessageSecurity.ql" "file" true
check_item "$PROJECT_ROOT/codeql-custom-queries/queries/FetchPatching.ql" "file" true
echo ""

# Check scripts
echo "6. Automation Scripts"
echo "----------------------------"
check_item "$PROJECT_ROOT/scripts/setup-codeql.sh" "file" true
check_item "$PROJECT_ROOT/scripts/create-codeql-db.sh" "file" true
check_item "$PROJECT_ROOT/scripts/run-codeql-analysis.sh" "file" true
check_item "$PROJECT_ROOT/scripts/view-codeql-results.sh" "file" true
check_item "$PROJECT_ROOT/scripts/verify-codeql-setup.sh" "file" true

# Check if scripts are executable
echo ""
echo "7. Script Permissions"
echo "----------------------------"
for script in setup-codeql.sh create-codeql-db.sh run-codeql-analysis.sh view-codeql-results.sh verify-codeql-setup.sh; do
    SCRIPT_PATH="$PROJECT_ROOT/scripts/$script"
    if [ -x "$SCRIPT_PATH" ]; then
        echo "✓ $script is executable"
    else
        echo "⚠ $script is not executable"
        echo "   Run: chmod +x $SCRIPT_PATH"
    fi
done
echo ""

# Check .gitignore
echo "8. Git Configuration"
echo "----------------------------"
if [ -f "$PROJECT_ROOT/.gitignore" ]; then
    if grep -q "tools/codeql" "$PROJECT_ROOT/.gitignore"; then
        echo "✓ .gitignore includes CodeQL artifacts"
    else
        echo "⚠ .gitignore missing CodeQL exclusions"
        echo "   Add: /tools/codeql/, /codeql-db/, /codeql-results/, *.sarif"
    fi
else
    echo "✗ .gitignore not found"
    ALL_CHECKS_PASSED=false
fi
echo ""

# Check database status
echo "9. Database Status"
echo "----------------------------"
if [ -d "$PROJECT_ROOT/codeql-db" ]; then
    DB_SIZE=$(du -sh "$PROJECT_ROOT/codeql-db" 2>/dev/null | cut -f1 || echo "unknown")
    echo "✓ Database exists ($DB_SIZE)"
else
    echo "⚠ Database not created yet"
    echo "   Run: npm run security:db"
fi
echo ""

# Final summary
echo "=================================================="
if [ "$ALL_CHECKS_PASSED" = true ]; then
    echo "✓ All required checks passed!"
    echo ""
    echo "Setup is complete. You can now:"
    echo "  npm run security:db       # Create database"
    echo "  npm run security:analyze  # Run analysis"
    echo "  npm run security:quick    # Quick scan"
    echo "  npm run security:view     # View results"
else
    echo "✗ Some required checks failed"
    echo ""
    echo "Please fix the issues above before running analysis."
fi
echo "=================================================="
echo ""
