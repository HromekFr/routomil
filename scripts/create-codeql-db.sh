#!/bin/bash
# Creates CodeQL database from TypeScript source code
# Database is used for subsequent security analysis queries

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CODEQL_BIN="$PROJECT_ROOT/tools/codeql/codeql"
DB_PATH="$PROJECT_ROOT/codeql-db"
SOURCE_DIR="$PROJECT_ROOT/src"

echo "=================================================="
echo "Creating CodeQL Database"
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

# Verify source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found at $SOURCE_DIR"
    exit 1
fi

# Remove existing database if present
if [ -d "$DB_PATH" ]; then
    echo "Removing existing database..."
    rm -rf "$DB_PATH"
    echo ""
fi

echo "Source directory: $SOURCE_DIR"
echo "Database path: $DB_PATH"
echo "Language: JavaScript (TypeScript treated as JavaScript)"
echo ""
echo "Creating database (this may take 30-60 seconds)..."
echo ""

# Create database
# Note: CodeQL treats TypeScript as JavaScript
"$CODEQL_BIN" database create "$DB_PATH" \
    --language=javascript \
    --source-root="$PROJECT_ROOT" \
    --overwrite \
    2>&1 | grep -v "^Finalizing database" || true

echo ""
echo "✓ Database created successfully!"
echo ""

# Show database info
DB_SIZE=$(du -sh "$DB_PATH" 2>/dev/null | cut -f1 || echo "unknown")
echo "Database location: $DB_PATH"
echo "Database size: $DB_SIZE"
echo ""

# Count files analyzed
FILE_COUNT=$(find "$SOURCE_DIR" -name "*.ts" -o -name "*.js" | wc -l | tr -d ' ')
echo "TypeScript/JavaScript files analyzed: $FILE_COUNT"
echo ""
echo "=================================================="
echo "Database Ready for Analysis"
echo "=================================================="
echo ""
echo "Next steps:"
echo "  npm run security:analyze   # Run security analysis"
echo "  npm run security:quick     # Quick scan (custom queries only)"
echo ""
