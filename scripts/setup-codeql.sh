#!/bin/bash
# Setup script for CodeQL CLI installation
# Installs CodeQL CLI using Homebrew (preferred) or manual download (fallback)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CODEQL_DIR="$PROJECT_ROOT/tools/codeql"
CODEQL_VERSION="2.24.1"  # Latest stable version as of Feb 2025
CODEQL_ZIP="codeql-osx64.zip"
DOWNLOAD_URL="https://github.com/github/codeql-cli-binaries/releases/download/v${CODEQL_VERSION}/${CODEQL_ZIP}"

echo "=================================================="
echo "CodeQL CLI Setup for Routomil Security Analysis"
echo "=================================================="
echo ""

# Check if already installed
if [ -f "$CODEQL_DIR/codeql" ]; then
    echo "✓ CodeQL CLI already installed at $CODEQL_DIR"
    INSTALLED_VERSION=$("$CODEQL_DIR/codeql" version --format=text | head -n1 || echo "unknown")
    echo "  Installed version: $INSTALLED_VERSION"
    echo ""
    read -p "Do you want to reinstall? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
    echo "Removing existing installation..."
    rm -rf "$CODEQL_DIR"/*
fi

# Create tools directory
mkdir -p "$CODEQL_DIR"

# Method 1: Try Homebrew (preferred - fast and reliable)
if command -v brew &> /dev/null; then
    echo "Method: Homebrew (recommended)"
    echo ""
    echo "Installing CodeQL CLI via Homebrew..."
    echo "This will install to Homebrew's Cellar and symlink the binary."
    echo ""

    # Install via Homebrew
    brew install codeql

    # Find where Homebrew installed it
    BREW_CODEQL_PATH=$(brew --prefix codeql)/bin/codeql

    if [ -f "$BREW_CODEQL_PATH" ]; then
        # Create symlink to project tools directory
        ln -sf "$BREW_CODEQL_PATH" "$CODEQL_DIR/codeql"

        echo ""
        echo "✓ CodeQL CLI installed successfully via Homebrew!"
        echo ""

        # Verify installation
        VERSION_INFO=$("$CODEQL_DIR/codeql" version --format=text)
        echo "Installed version:"
        echo "$VERSION_INFO"
        echo ""
        echo "Installation location: $BREW_CODEQL_PATH (symlinked to $CODEQL_DIR)"
        echo ""
        echo "=================================================="
        echo "Setup Complete!"
        echo "=================================================="
        echo ""
        echo "Next steps:"
        echo "  1. Run: npm run security:db       (create database)"
        echo "  2. Run: npm run security:analyze  (run analysis)"
        echo "  3. Run: npm run security:view     (view results)"
        echo ""
        exit 0
    else
        echo "Warning: Homebrew installation succeeded but binary not found."
        echo "Falling back to manual download..."
        echo ""
    fi
else
    echo "Homebrew not found. Using manual download method."
    echo ""
fi

# Method 2: Manual download (fallback)
echo "Method: Manual download from GitHub releases"
echo ""
echo "Downloading CodeQL CLI v${CODEQL_VERSION}..."
echo "URL: $DOWNLOAD_URL"
echo "Size: ~400MB (this may take a few minutes)"
echo ""

cd "$CODEQL_DIR"

# Download with progress bar
if command -v curl &> /dev/null; then
    curl -L -# -o "$CODEQL_ZIP" "$DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
    wget --show-progress -O "$CODEQL_ZIP" "$DOWNLOAD_URL"
else
    echo "Error: Neither curl nor wget found. Please install one of them."
    exit 1
fi

# Check if download was successful (file should be large)
FILE_SIZE=$(stat -f%z "$CODEQL_ZIP" 2>/dev/null || stat -c%s "$CODEQL_ZIP" 2>/dev/null || echo "0")
if [ "$FILE_SIZE" -lt 1000000 ]; then
    echo ""
    echo "Error: Download failed or file too small ($FILE_SIZE bytes)"
    echo "File contents:"
    head -n 5 "$CODEQL_ZIP"
    echo ""
    echo "Please check:"
    echo "  1. Internet connection"
    echo "  2. GitHub releases page: https://github.com/github/codeql-cli-binaries/releases"
    echo "  3. Download URL: $DOWNLOAD_URL"
    rm -f "$CODEQL_ZIP"
    exit 1
fi

echo ""
echo "Extracting CodeQL bundle..."
unzip -q "$CODEQL_ZIP"

# Move contents up one level (extract creates a 'codeql' subdirectory)
if [ -d "codeql" ]; then
    mv codeql/* .
    rmdir codeql
fi

# Clean up zip file
rm "$CODEQL_ZIP"

echo ""
echo "✓ CodeQL CLI installed successfully!"
echo ""

# Verify installation
if [ -f "$CODEQL_DIR/codeql" ]; then
    VERSION_INFO=$("$CODEQL_DIR/codeql" version --format=text)
    echo "Installed version:"
    echo "$VERSION_INFO"
    echo ""
    echo "Installation location: $CODEQL_DIR"
    echo ""
    echo "=================================================="
    echo "Setup Complete!"
    echo "=================================================="
    echo ""
    echo "Next steps:"
    echo "  1. Run: npm run security:db       (create database)"
    echo "  2. Run: npm run security:analyze  (run analysis)"
    echo "  3. Run: npm run security:view     (view results)"
    echo ""
else
    echo "Error: Installation failed. CodeQL binary not found."
    exit 1
fi
