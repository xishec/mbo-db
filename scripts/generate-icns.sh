#!/bin/bash

# This script generates .icns file for macOS from PNG
# Requires macOS with iconutil

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PUBLIC_DIR="$SCRIPT_DIR/../public"

# Create temporary iconset directory
ICONSET_DIR="$PUBLIC_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# Generate all required sizes from icon-1024.png
sips -z 16 16     "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32     "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32     "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64     "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128   "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256   "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256   "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512   "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512   "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 "$PUBLIC_DIR/icon-1024.png" --out "$ICONSET_DIR/icon_512x512@2x.png"

# Convert to .icns
iconutil -c icns "$ICONSET_DIR" -o "$PUBLIC_DIR/icon.icns"

# Clean up
rm -rf "$ICONSET_DIR"

echo "✓ Generated icon.icns"
