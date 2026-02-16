#!/bin/bash
# Views CodeQL analysis results in formatted terminal output

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$PROJECT_ROOT/codeql-results"
CSV_FILE="$RESULTS_DIR/custom-security.csv"

echo "=================================================="
echo "CodeQL Security Analysis Results"
echo "=================================================="
echo ""

# Check if results exist
if [ ! -f "$CSV_FILE" ]; then
    echo "No results found at $CSV_FILE"
    echo ""
    echo "Please run analysis first:"
    echo "  npm run security        # Full analysis"
    echo "  npm run security:quick  # Quick scan"
    echo ""
    exit 1
fi

# Count total issues
TOTAL_ISSUES=$(tail -n +2 "$CSV_FILE" 2>/dev/null | wc -l | tr -d ' ')

if [ "$TOTAL_ISSUES" -eq 0 ]; then
    echo "✓ No security issues found!"
    echo ""
    exit 0
fi

echo "Total issues found: $TOTAL_ISSUES"
echo ""

# Display issues grouped by severity
echo "Issues by severity:"
echo ""

# Function to display issues for a given severity level
display_severity_group() {
    local severity=$1
    local label=$2
    local color=$3

    # Count issues for this severity
    COUNT=$(tail -n +2 "$CSV_FILE" | grep -i "\"$severity\"" | wc -l | tr -d ' ')

    if [ "$COUNT" -gt 0 ]; then
        echo "$color$label: $COUNT issue(s)\033[0m"
        echo "----------------------------------------"

        # Display each issue
        tail -n +2 "$CSV_FILE" | grep -i "\"$severity\"" | while IFS=',' read -r name description severity file line col; do
            # Clean up quoted fields
            name=$(echo "$name" | sed 's/^"//;s/"$//')
            description=$(echo "$description" | sed 's/^"//;s/"$//')
            file=$(echo "$file" | sed 's/^"//;s/"$//')
            line=$(echo "$line" | sed 's/^"//;s/"$//')

            # Extract just the filename
            filename=$(basename "$file")

            echo "  📍 $filename:$line"
            echo "     $description"
            echo ""
        done
    fi
}

# Display by severity (error, warning, recommendation)
display_severity_group "error" "🔴 ERRORS" "\033[1;31m"
display_severity_group "warning" "🟡 WARNINGS" "\033[1;33m"
display_severity_group "recommendation" "🔵 RECOMMENDATIONS" "\033[1;36m"

echo "=================================================="
echo ""

# Show available SARIF files
echo "Detailed results (SARIF format):"
if [ -d "$RESULTS_DIR" ]; then
    find "$RESULTS_DIR" -name "*.sarif" -type f | while read -r sarif; do
        filename=$(basename "$sarif")
        filesize=$(du -h "$sarif" | cut -f1)
        echo "  - $filename ($filesize)"
    done
fi
echo ""

echo "View detailed results:"
echo "  cat $CSV_FILE"
echo "  # Or open SARIF files in VS Code with CodeQL extension"
echo ""
