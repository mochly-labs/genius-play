#!/bin/bash

print_message() {
    local message=$1
    local color=$2
    local timestamp
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${color}[${timestamp}] ${message}\033[0m"
}

build_for_os() {
    local os=$1
    local arch=$2
    local output=$3

    print_message "Building for $os ($arch)..." "\033[0;33m"

    if [ "$os" = "windows" ]; then
        GOOS=$os GOARCH=$arch CGO_ENABLED=1 go build -o "dist/$output" -ldflags="-H=windowsgui"
    else
        GOOS=$os GOARCH=$arch CGO_ENABLED=1 go build -o "dist/$output"
    fi

    if [ $? -eq 0 ]; then
        print_message "Build successful for $os ($arch)!" "\033[0;32m"
    else
        print_message "Build failed for $os ($arch)." "\033[0;31m"
    fi
}


build_mac_app_bundle() {
    local arch=$1
    local bin_name="GeniusPlay-macOS-$arch"
    local app_name="Genius Play!.app"
    local app_path="dist/$app_name"
    local exec_path="$app_path/Contents/MacOS"
    local res_path="$app_path/Contents/Resources"

    print_message "Building macOS .app bundle for $arch..." "\033[0;33m"

    # Build binary
    GOOS=darwin GOARCH=$arch CGO_ENABLED=1 go build -o "$bin_name"

    if [ $? -ne 0 ]; then
        print_message "Binary build failed for macOS $arch." "\033[0;31m"
        return
    fi

    # Create bundle structure
    mkdir -p "$exec_path" "$res_path"

    # Move binary into bundle
    mv "$bin_name" "$exec_path/GeniusPlay"

    # Copy icon (you need to create one!)
    cp "assets/icon.icns" "$res_path/icon.icns"

    # Create Info.plist
    cat > "$app_path/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Genius Play!</string>
  <key>CFBundleExecutable</key>
  <string>GeniusPlay</string>
  <key>CFBundleIconFile</key>
  <string>icon.icns</string>
  <key>CFBundleIdentifier</key>
  <string>me.hiroshi.geniusplay</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
EOF

    create-dmg "dist/Genius-Play-macOS-$arch.app" "dist/Genius-Play-macOS-$arch.dmg" --dmg-title "Genius Play" --volname "Genius Play"
    print_message ".app bundle created at $app_path 🍏✨" "\033[0;32m"
}


# If "maconly" is passed, only build mac targets
if [ "$1" = "maconly" ]; then
    build_mac_app_bundle "amd64"
    build_mac_app_bundle "arm64"
    exit 0
fi

# Windows
build_for_os "windows" "386" "Genius Play! (32-bits).exe"
build_for_os "windows" "amd64" "Genius Play! (64-bits).exe"
# Linux
build_for_os "linux" "amd64" "Genius Play! (64-bits Linux)"
build_for_os "linux" "386" "Genius Play! (32-bits Linux)"
build_for_os "linux" "arm64" "Genius Play! (ARM64 Linux)"
# macOS done in separate job

print_message "Build process completed." "\033[0;36m"
