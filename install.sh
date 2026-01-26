#!/bin/bash

# Installation script for cggit
# Run this on any new laptop

echo "Installing cggit..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Link globally
echo "Linking cggit globally..."
npm link

# Verify installation
if command -v cggit &> /dev/null; then
    echo "✓ cggit installed successfully!"
    echo ""
    echo "Usage:"
    echo "  cggit setup      # Setup GitHub token"
    echo "  cggit hotfix     # Create hotfix branches"
    echo "  cggit pr         # Create pull requests"
    echo ""
    cggit --version
else
    echo "✗ Installation failed"
    exit 1
fi

