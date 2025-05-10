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

    print_message "Building macOS binary for $arch..." "\033[0;33m"

    # Build binary
    GOOS=darwin GOARCH=$arch CGO_ENABLED=1 go build -o "dist/$bin_name"

    if [ $? -ne 0 ]; then
        print_message "Binary build failed for macOS $arch." "\033[0;31m"
        return
    fi

    print_message "Binary created at dist/$bin_name" "\033[0;32m"
}

# If "maconly" is passed, only build mac targets
if [ "$1" = "maconly" ]; then
    build_mac_app_bundle "amd64"
    build_mac_app_bundle "arm64"
    exit 0
fi

# Windows
build_for_os "windows" "amd64" "Genius.Play.x64.exe"
build_for_os "windows" "386" "Genius.Play.x86.exe"
# Linux
build_for_os "linux" "amd64" "Genius.Play.x64.Linux"
# build_for_os "linux" "arm64" "Genius.Play.arm64.Linux"
# build_for_os "linux" "386" "Genius.Play.x86.Linux"

print_message "Build process completed." "\033[0;36m"
