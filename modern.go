package main

import (
	"bufio"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"path/filepath"
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

var pairingConfigFile = filepath.Join(geniusPlayPath, "/pairing_config.json")

type DiscoveredDevice struct {
	UUID string `json:"uuid"`
	Name string `json:"name"`
	IP   string `json:"ip"`
}

type PairedDeviceConfig struct {
	UUID        string `json:"uuid"`
	Name        string `json:"name"`
	PairingCode string `json:"pairing_code"`
	LastSeenIP  string `json:"last_seen_ip"`
}

type State struct {
	DiscoveredDevices map[string]DiscoveredDevice
	PairedDevice      *PairedDeviceConfig
	IsConnected       bool
	IsActive          bool
	Latency           int
}

type GeniusPlay struct {
	sync.Mutex
	discoveredDevices map[string]DiscoveredDevice
	pairedDevice      *PairedDeviceConfig
	activeConnection  net.Conn
	stopAnnouncer     chan bool
	stopListeners     chan bool
	tcpPort           int
	udpPort           int
	myIP              string
	isActive          bool
	tcpListener       net.Listener
	udpListener       *net.UDPConn

	latencyMs int
}

var instance *GeniusPlay
var once sync.Once

var PinConfig = []int{}

func New(tcpPort, udpPort int) *GeniusPlay {
	once.Do(func() {
		instance = &GeniusPlay{
			discoveredDevices: make(map[string]DiscoveredDevice),
			stopAnnouncer:     make(chan bool, 1),
			stopListeners:     make(chan bool, 1),
			tcpPort:           tcpPort,
			udpPort:           udpPort,
			myIP:              localIP(),
			isActive:          false,
		}
		instance.loadPairingConfig()
		log.Printf("Módulo GeniusPlay inicializado. IP Local: %s, TCP: %d, UDP: %d", instance.myIP, instance.tcpPort, instance.udpPort)
	})
	return instance
}

func (gp *GeniusPlay) Start() {
	gp.Lock()
	if gp.isActive {
		gp.Unlock()
		log.Println("O sistema já está ativo.")
		return
	}
	gp.isActive = true
	gp.stopListeners = make(chan bool, 1)
	gp.stopAnnouncer = make(chan bool, 1)

	go gp.udpListenerRoutine()
	go gp.tcpListenerRoutine()

	if gp.pairedDevice == nil {
		go gp.unpairedAnnouncer()
	} else {
		log.Printf("Dispositivo pareado encontrado: %s (%s)", gp.pairedDevice.Name, gp.pairedDevice.UUID)
		go gp.pairedConnectionManager()
	}
	gp.Unlock()
	log.Println("Sistema GeniusPlay ATIVADO.")
}

func (gp *GeniusPlay) Stop() {
	gp.Lock()
	if !gp.isActive {
		gp.Unlock()
		log.Println("O sistema já está inativo.")
		return
	}
	gp.isActive = false

	close(gp.stopListeners)
	close(gp.stopAnnouncer)

	if gp.tcpListener != nil {
		gp.tcpListener.Close()
	}
	if gp.udpListener != nil {
		gp.udpListener.Close()
	}
	if gp.activeConnection != nil {
		gp.activeConnection.Close()
		gp.activeConnection = nil
	}
	gp.Unlock()
	log.Println("Sistema GeniusPlay DESATIVADO (HALT).")
}

func (gp *GeniusPlay) DiscoverDevices() ([]DiscoveredDevice, error) {
	gp.Lock()
	if !gp.isActive {
		gp.Unlock()
		return nil, fmt.Errorf("o sistema não está ativo")
	}
	gp.discoveredDevices = make(map[string]DiscoveredDevice)
	gp.Unlock()

	if err := gp.udpBroadcast([]byte("GENIUS_DISCOVER_REQUEST")); err != nil {
		return nil, fmt.Errorf("erro ao fazer broadcast da descoberta: %w", err)
	}

	time.Sleep(2 * time.Second)
	gp.Lock()
	defer gp.Unlock()
	var devices []DiscoveredDevice
	for _, dev := range gp.discoveredDevices {
		devices = append(devices, dev)
	}
	return devices, nil
}

func (gp *GeniusPlay) PairDevice(uuid string) error {
	gp.Lock()
	if !gp.isActive {
		gp.Unlock()
		return fmt.Errorf("o sistema não está ativo")
	}
	device, found := gp.discoveredDevices[uuid]
	if !found {
		gp.Unlock()
		return fmt.Errorf("dispositivo com UUID %s não encontrado ou a descoberta expirou", uuid)
	}

	newPairingCode := generatePairingCode()
	gp.pairedDevice = &PairedDeviceConfig{
		UUID:        device.UUID,
		Name:        device.Name,
		PairingCode: newPairingCode,
		LastSeenIP:  device.IP,
	}
	gp.Unlock()

	gp.savePairingConfig()

	msg := fmt.Sprintf("GENIUS_PAIR_REQUEST:%s:%s:%s:%d", uuid, newPairingCode, gp.myIP, gp.tcpPort)
	if err := gp.udpBroadcast([]byte(msg)); err != nil {
		return fmt.Errorf("erro ao enviar pedido de pareamento: %w", err)
	}
	log.Printf("Pedido de pareamento enviado para %s (%s)", device.Name, device.UUID)

	select {
	case gp.stopAnnouncer <- true:
		log.Println("Modo de anúncio (não pareado) desativado.")
	default:
	}
	go gp.pairedConnectionManager()
	return nil
}

func (gp *GeniusPlay) GetState() State {
	gp.Lock()
	defer gp.Unlock()

	discoveredCopy := make(map[string]DiscoveredDevice)
	for k, v := range gp.discoveredDevices {
		discoveredCopy[k] = v
	}

	return State{
		DiscoveredDevices: discoveredCopy,
		PairedDevice:      gp.pairedDevice,
		IsConnected:       gp.activeConnection != nil,
		IsActive:          gp.isActive,
		Latency:           gp.latencyMs,
	}
}

func (gp *GeniusPlay) savePairingConfig() {
	gp.Lock()
	defer gp.Unlock()
	if gp.pairedDevice == nil {
		os.Remove(pairingConfigFile)
		return
	}
	data, err := json.MarshalIndent(gp.pairedDevice, "", "  ")
	if err != nil {
		log.Printf("Erro ao converter configuração para JSON: %v", err)
		return
	}
	if err := os.WriteFile(pairingConfigFile, data, 0644); err != nil {
		log.Printf("Erro ao salvar arquivo de configuração: %v", err)
	} else {
		log.Printf("Configuração de pareamento salva em '%s'", pairingConfigFile)
	}
}

func (gp *GeniusPlay) loadPairingConfig() {
	gp.Lock()
	defer gp.Unlock()
	data, err := os.ReadFile(pairingConfigFile)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("Arquivo de configuração '%s' não encontrado. Iniciando sem pareamento.", pairingConfigFile)
		} else {
			log.Printf("Erro ao ler arquivo de configuração: %v", err)
		}
		return
	}
	var config PairedDeviceConfig
	if err := json.Unmarshal(data, &config); err != nil {
		log.Printf("Erro ao interpretar arquivo de configuração JSON: %v", err)
		return
	}
	gp.pairedDevice = &config
}

func (gp *GeniusPlay) unpairedAnnouncer() {
	log.Println("Iniciado modo de anúncio (não pareado).")
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-gp.stopAnnouncer:
			return
		case <-ticker.C:
			gp.Lock()
			msg := fmt.Sprintf("GENIUS_GOLANG_FRONTEND_PRESENT`:%s:%s", gp.myIP, "GeniusPlayBeta2.1.x")
			active := gp.isActive
			gp.Unlock()
			if active {
				gp.udpBroadcast([]byte(msg))
			}
		}
	}
}

func (gp *GeniusPlay) pairedConnectionManager() {
	log.Println("Iniciado gerenciador de conexão (pareado).")
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for {
		gp.Lock()
		if !gp.isActive {
			gp.Unlock()
			log.Println("Gerenciador de conexão encerrado (sistema inativo).")
			return
		}
		if gp.activeConnection != nil {
			gp.Unlock()
			time.Sleep(1 * time.Second)
			continue
		}
		if gp.pairedDevice == nil {
			gp.Unlock()
			log.Println("Gerenciador de conexão encerrado (dispositivo despareado).")
			if gp.isActive {
				go gp.unpairedAnnouncer()
			}
			return
		}
		log.Printf("Tentando conectar com %s...", gp.pairedDevice.Name)
		msg := fmt.Sprintf("GENIUS_CONNECT_REQUEST:%s:%s:%s:%d",
			gp.pairedDevice.UUID, gp.pairedDevice.PairingCode, gp.myIP, gp.tcpPort)
		gp.Unlock()
		gp.udpBroadcast([]byte(msg))

		select {
		case <-gp.stopListeners:
			return
		case <-ticker.C:
		}
	}
}

func (gp *GeniusPlay) udpListenerRoutine() {
	conn, err := net.ListenUDP("udp4", &net.UDPAddr{IP: net.IPv4zero, Port: gp.udpPort})
	if err != nil {
		log.Printf("Erro fatal no listener UDP: %v", err)
		return
	}
	gp.udpListener = conn
	defer conn.Close()
	buffer := make([]byte, 1024)

	for {
		select {
		case <-gp.stopListeners:
			return
		default:
		}

		conn.SetReadDeadline(time.Now().Add(1 * time.Second))
		n, addr, err := conn.ReadFromUDP(buffer)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			log.Printf("Erro de leitura no UDP: %v", err)
			return
		}

		gp.Lock()
		if !gp.isActive {
			gp.Unlock()
			continue
		}
		gp.Unlock()

		msg := string(buffer[:n])
		if strings.HasPrefix(msg, "GENIUS_DISCOVER_RESPONSE:") {
			jsonPart := strings.TrimPrefix(msg, "GENIUS_DISCOVER_RESPONSE:")
			var dev DiscoveredDevice
			if err := json.Unmarshal([]byte(jsonPart), &dev); err == nil {
				dev.IP = addr.IP.String()
				gp.Lock()
				gp.discoveredDevices[dev.UUID] = dev
				log.Printf("Dispositivo descoberto: %s (%s) em %s", dev.Name, dev.UUID, dev.IP)
				gp.Unlock()
			}
		} else if strings.HasPrefix(msg, "GENIUS_DEVICE_ANNOUNCE:") {
			jsonPart := strings.TrimPrefix(msg, "GENIUS_DEVICE_ANNOUNCE:")
			var dev DiscoveredDevice
			if err := json.Unmarshal([]byte(jsonPart), &dev); err == nil {
				gp.Lock()
				if gp.pairedDevice != nil && gp.pairedDevice.UUID == dev.UUID {
					gp.pairedDevice.LastSeenIP = addr.IP.String()
					log.Printf("Anúncio do dispositivo pareado %s. IP atualizado para %s.", dev.Name, addr.IP.String())
				}
				gp.Unlock()
			}
		}
	}
}

func (gp *GeniusPlay) tcpListenerRoutine() {
	ln, err := net.Listen("tcp", ":"+strconv.Itoa(gp.tcpPort))
	if err != nil {
		log.Printf("Erro fatal no listener TCP: %v", err)
		return
	}
	gp.tcpListener = ln
	defer ln.Close()

	for {
		select {
		case <-gp.stopListeners:
			return
		default:
		}

		conn, err := ln.Accept()
		if err != nil {
			gp.Lock()
			if !gp.isActive {
				gp.Unlock()
				return
			}
			gp.Unlock()
			log.Println("Erro ao aceitar conexão TCP:", err)
			continue
		}
		go gp.handleClient(conn)
	}
}

func (gp *GeniusPlay) handleClient(conn net.Conn) {
	defer func() {
		conn.Close()
		gp.Lock()
		if gp.activeConnection == conn {
			gp.activeConnection = nil
		}
		gp.Unlock()
		log.Println("Conexão com o cliente encerrada.")
	}()

	reader := bufio.NewReader(conn)
	line, err := reader.ReadString('\n')
	if err != nil {
		log.Printf("Erro ao ler handshake: %v", err)
		return
	}

	b, err := base64.StdEncoding.DecodeString(strings.TrimSpace(line))
	if err != nil {
		return
	}
	var hs map[string]string
	if json.Unmarshal(b, &hs) != nil || hs["type"] != "handshake" {
		return
	}
	uuid := hs["uuid"]

	gp.Lock()
	if gp.pairedDevice != nil && gp.pairedDevice.UUID == uuid {
		gp.activeConnection = conn
		log.Printf("Conexão estabelecida e validada com %s (%s)", gp.pairedDevice.Name, uuid)
		sendBase64Json(conn, map[string]string{"status": "ok"})
		sendBase64Json(conn, map[string]interface{}{"type": "config", "pins": PinConfig})
		EmitAll("status", "true")
	} else {
		sendBase64Json(conn, map[string]string{"status": "error", "reason": "not_paired"})
		EmitAll("status", "false")
		log.Printf("Conexão de UUID inesperado (%s) rejeitada.", uuid)
		gp.Unlock()
		return
	}
	gp.Unlock()

	var (
		keepaliveCh  = make(chan struct{}, 1)
		latencyCh    = make(chan time.Duration, 1)
		lastPingTime time.Time
	)

	keepaliveTimer := time.AfterFunc(6*time.Second, func() {
		log.Println("Keepalive (pong) not received in 6 seconds, closing connection from", uuid)
		conn.Close()
	})
	defer keepaliveTimer.Stop()

	go func() {
		for range keepaliveCh {
			keepaliveTimer.Reset(6 * time.Second)
		}
	}()

	go func(conn net.Conn) {
		ticker := time.NewTicker(300 * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			lastPingTime = time.Now()
			_, err := conn.Write([]byte("genius.message.keepalive\n"))
			if err != nil {
				return
			}
		}
	}(conn)

	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			EmitAll("status", "false")
			break
		}

		trimmedLine := strings.TrimSpace(line)

		if strings.Contains(trimmedLine, "genius.client.pong") {
			latency := time.Since(lastPingTime)
			select {
			case keepaliveCh <- struct{}{}:
			default:
			}
			select {
			case latencyCh <- latency:
			default:
			}

			gp.latencyMs = int(latency.Milliseconds())
			continue
		}

		b, err := base64.StdEncoding.DecodeString(trimmedLine)
		if err != nil {
			continue
		}
		var msg map[string]interface{}
		if err := json.Unmarshal(b, &msg); err != nil {
			continue
		}

		gp.Lock()
		isActive := gp.isActive
		gp.Unlock()

		if isActive {
			log.Printf("Evento recebido de %s: %v\n", uuid, msg)
			broadcastToWebSocketClients("modernBtn", msg)
		} else {
			log.Println("Sistema inativo. Evento ignorado.")
		}
	}
}

func (gp *GeniusPlay) udpBroadcast(msg []byte) error {
	conn, err := net.DialUDP("udp4", nil, &net.UDPAddr{IP: net.IPv4bcast, Port: gp.udpPort})
	if err != nil {
		log.Println("Erro ao criar conexão para broadcast:", err)
		return err
	}
	defer conn.Close()
	_, err = conn.Write(msg)
	return err
}

func sendBase64Json(conn net.Conn, v interface{}) {
	j, _ := json.Marshal(v)
	b64 := base64.StdEncoding.EncodeToString(j)
	conn.Write([]byte(b64 + "\n"))
}

func generatePairingCode() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func localIP() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}
	for _, i := range ifaces {
		if i.Flags&net.FlagLoopback != 0 || i.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := i.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			if ipnet, ok := addr.(*net.IPNet); ok {
				ip = ipnet.IP
			}
			if ip != nil && ip.To4() != nil {
				return ip.String()
			}
		}
	}
	return "127.0.0.1"
}

func (gp *GeniusPlay) UnpairDevice() error {
	gp.Lock()

	if gp.pairedDevice == nil {
		log.Println("Nenhum dispositivo para desparear.")
		gp.Unlock()
		return nil
	}

	log.Printf("Iniciando despareamento do dispositivo: %s (%s)", gp.pairedDevice.Name, gp.pairedDevice.UUID)
	msg := fmt.Sprintf("GENIUS_UNPAIR_NOTICE:%s", gp.pairedDevice.UUID)
	gp.udpBroadcast([]byte(msg))

	if gp.activeConnection != nil {
		gp.activeConnection.Close()
		gp.activeConnection = nil
	}

	gp.pairedDevice = nil

	gp.Unlock()
	gp.savePairingConfig()

	log.Println("Dispositivo despareado com sucesso.")
	return nil
}
