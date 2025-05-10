//go:build darwin

package main

import (
	"strings"
)

func GetVendorID(port string) (uint16, error) {
	if strings.HasPrefix(port, "/dev/cu.usbserial") {
		return 0x1A86, nil
	}
	return 0x0000, nil
}
