//go:build windows

package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/StackExchange/wmi"
)

type Win32_PnPEntity struct {
	Name     string
	DeviceID string
}

func GetVendorID(port string) (uint16, error) {
	var devices []Win32_PnPEntity
	query := fmt.Sprintf("SELECT Name, DeviceID FROM Win32_PnPEntity WHERE Name LIKE '%%(%s)'", port)
	err := wmi.Query(query, &devices)
	if err != nil {
		return 0, fmt.Errorf("erro WMI: %v", err)
	}

	if len(devices) == 0 {
		return 0, fmt.Errorf("porta %s não encontrada", port)
	}

	deviceID := devices[0].DeviceID
	vidIndex := strings.Index(deviceID, "VID_")
	if vidIndex == -1 {
		return 0, fmt.Errorf("VID não encontrado em: %s", deviceID)
	}

	vidStr := deviceID[vidIndex+4 : vidIndex+8]
	vid, err := strconv.ParseUint(vidStr, 16, 16)
	if err != nil {
		return 0, fmt.Errorf("VID inválido: %s (DeviceID: %s)", vidStr, deviceID)
	}

	return uint16(vid), nil
}

func ListCOMPorts() []string {
	var ports []string
	var devices []Win32_PnPEntity
	wmi.Query("SELECT Name FROM Win32_PnPEntity WHERE Name LIKE '%(COM%'", &devices)

	for _, dev := range devices {
		ports = append(ports, dev.Name)
	}
	return ports
}
