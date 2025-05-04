//go:build darwin

package main

import (
	"strings"
)

func GetVendorID(port string) (uint16, error) {
	if strings.HasPrefix(port, "/dev/cu.") {
		return 0x0000, nil
	}
	if strings.HasPrefix(port, "/dev/tty.Bluetooth") {
		return 0x0000, nil
	}

	return 0x1A86, nil
}
