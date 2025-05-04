// serial.go
package main

import (
	"bufio"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	serial "go.bug.st/serial"
)

type ArduinoPairer struct {
	scanner     *ArduinoScanner
	currentPort serial.Port
	portAddress string
	connected   bool
	connMutex   sync.RWMutex
}

var lastPing = time.Now()

func NewArduinoPairer() *ArduinoPairer {
	return &ArduinoPairer{
		scanner:   NewArduinoScanner(),
		connected: false,
	}
}

func (p *ArduinoPairer) Pair() {
	for {
		ports, err := p.scanner.Scan()
		if err != nil {
			time.Sleep(10 * time.Millisecond)
			continue
		}

		if len(ports) == 0 {
			time.Sleep(10 * time.Millisecond)
			continue
		}

		for _, port := range ports {
			if err := p.connect(port); err != nil {
				continue
			}
			p.monitorConnection()
		}
	}
}
func (p *ArduinoPairer) connect(portAddress string) error {
	port, err := serial.Open(portAddress, &serial.Mode{BaudRate: 115200})
	if err != nil {
		return err
	}

	p.currentPort = port
	p.portAddress = portAddress

	p.connected = true
	currentStatus.Online = true

	go p.keepAlive()
	go p.readMessages()

	return nil
}

func (p *ArduinoPairer) keepAlive() {
	ticker := time.NewTicker(2500 * time.Millisecond)
	defer ticker.Stop()

	for p.connected {
		for range ticker.C {
			if _, err := p.currentPort.Write([]byte("Ke\n")); err != nil {
				println(err)
				p.disconnect()
				return
			}
		}
	}
}

func (p *ArduinoPairer) setPin(pin int, enabled bool) {
	if p.connected {
		var pinmsg = ""
		if enabled {
			pinmsg = "PINON(" + string(pin) + ")"
		} else {
			pinmsg = "PINOFF(" + string(pin) + ")"

		}
		if _, err := p.currentPort.Write([]byte(pinmsg + "\n")); err != nil {
			println(err)
			p.disconnect()
			return
		}

	}
}

func (p *ArduinoPairer) readMessages() {
	reader := bufio.NewReader(p.currentPort)
	for p.connected {
		message, err := reader.ReadString('\n')
		if err != nil {
			p.disconnect()
			return
		}

		msg := strings.TrimSpace(message)
		switch {
		case msg == "Re":
			lastPing = time.Now()
			EmitAll("status", "true")
			go func() {
				if isonline {
					statusItemG.SetTitle("Status: Online")
					setStatus("Online")
				} else {
					statusItemG.SetTitle("Status: Offline (Pareado)")
					setStatus("Offline (Pareado)")
				}
			}()
		default:
			fmt.Println(msg)
			EmitAll("button", msg)
		}
	}
}

func (p *ArduinoPairer) disconnect() {
	if p.connected {
		p.currentPort.Close()
		p.connected = false
		currentStatus.Online = false
		EmitAll("status", "false")
		setStatus("Offline")
		if isonline {
			statusItemG.SetTitle("Status: Online (Sem Arduino)")
			setStatus("Online (Sem Arduino)")
		} else {
			statusItemG.SetTitle("Status: Offline")
			setStatus("Offline")
		}
		lastPing = time.Now()
	}
}

func (p *ArduinoPairer) monitorConnection() {
	for p.connected {
		time.Sleep(100 * time.Millisecond)
		if time.Since(lastPing) > time.Second*5 {
			log.Default().Println("[Pareamento] [v2] (⭍ THUNDERBOLT) Timed out")
			p.disconnect()
		}
	}
}

type ArduinoScanner struct {
	vendorIDs map[string]bool
}

func NewArduinoScanner() *ArduinoScanner {
	return &ArduinoScanner{
		vendorIDs: map[string]bool{
			"2341": true,
			"1a86": true,
			"0403": true,
			"10c4": true,
			"2e8a": true,
			"16c0": true,
			"1b4f": true,
			"239a": true,
			"0483": true,
			"03eb": true,
			"04d8": true,
			"04b4": true,
			"1366": true,
		},
	}
}

func (s *ArduinoScanner) Scan() ([]string, error) {
	ports, err := serial.GetPortsList()
	if err != nil {
		return nil, err
	}

	var validPorts []string
	for _, portName := range ports {
		vid := getPortIdentifiers(portName)
		if s.vendorIDs[vid] {
			validPorts = append(validPorts, portName)
		}
	}

	return validPorts, nil
}

func getPortIdentifiers(port string) string {
	portVendor, err := GetVendorID(port)
	if err != nil {
		return ""
	}
	finalVendor := VendorIDToString(portVendor)

	return finalVendor
}
