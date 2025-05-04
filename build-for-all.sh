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
        GOOS=$os GOARCH=$arch CGO_ENABLED=0 go build -o "dist/$output" -ldflags="-H=windowsgui"
    else
        GOOS=$os GOARCH=$arch CGO_ENABLED=0 go build -o "dist/$output"
    fi

    if [ $? -eq 0 ]; then
        print_message "Build successful for $os ($arch)!" "\033[0;32m"
    else
        print_message "Build failed for $os ($arch)." "\033[0;31m"
    fi
}

# If "maconly" is passed, only build mac targets
if [ "$1" = "maconly" ]; then
    build_for_os "darwin" "amd64" "Genius Play! (64-bits macOS)"
    build_for_os "darwin" "arm64" "Genius Play! (ARM64 macOS)"
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
