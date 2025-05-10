//go:build linux

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"golang.org/x/sys/unix"
)

func GetVendorID(port string) (uint16, error) {
	fi, err := os.Stat(port)
	if err != nil {
		return 0, fmt.Errorf("erro ao acessar a porta: %v", err)
	}

	stat, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return 0, fmt.Errorf("erro ao obter device numbers")
	}
	rdev := uint64(stat.Rdev)
	major := unix.Major(rdev)
	minor := unix.Minor(rdev)

	sysPath := filepath.Join("/sys/dev/char", fmt.Sprintf("%d:%d", major, minor))
	devicePath, err := filepath.EvalSymlinks(sysPath)
	if err != nil {
		return 0, fmt.Errorf("não foi possível resolver o caminho do dispositivo: %v", err)
	}

	currentDir := devicePath
	for {
		vendorFile := filepath.Join(currentDir, "idVendor")
		if _, err := os.Stat(vendorFile); err == nil {
			data, err := os.ReadFile(vendorFile)
			if err != nil {
				return 0, fmt.Errorf("erro ao ler arquivo do vendor: %v", err)
			}

			vidStr := strings.TrimSpace(string(data))
			vid, err := strconv.ParseUint(vidStr, 16, 16)
			if err != nil {
				return 0, fmt.Errorf("formato do vendor ID inválido: %s", vidStr)
			}

			return uint16(vid), nil
		}

		parentDir := filepath.Dir(currentDir)
		if parentDir == currentDir {
			break
		}
		currentDir = parentDir
	}

	return 0, fmt.Errorf("vendor ID não encontrado para a porta %s", port)
}
