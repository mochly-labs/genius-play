package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"math/rand/v2"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

//go:embed public/*
var publicFS embed.FS

var (
	islegacy         = true
	isOnline         = false
	wsClients        = make(map[*websocket.Conn]bool)
	wsClientsMutex   = &sync.Mutex{}
	currentStatus    = &DeviceStatus{Online: false}
	ctx, cancel      = context.WithCancel(context.Background())
	userHome, _      = os.UserHomeDir()
	geniusPlayPath   = filepath.Join(userHome, "GeniusPlay")
	geniusPlayDataPath = filepath.Join(geniusPlayPath, "data")
)

type LogMessage struct {
	Level   string `json:"level"`
	Message string `json:"message"`
	Time    string `json:"time"`
}

type DeviceStatus struct {
	Online bool `json:"online"`
}

func main() {
	SetupKill()
	go initTray()
	setupUploadDir()
	var pairer = NewArduinoPairer()
	go pairer.Pair()
	setupFilesystem()
	gp := New(8001, 44444)

	dataJsonPath := filepath.Join(geniusPlayPath, "data.json")
	NoPanic()

	loadLegacyStatus(dataJsonPath)

	if !islegacy {
		gp.Start()
	}

	go saveLegacyStatusPeriodically(dataJsonPath)

	router := setupRouter(gp, pairer)
	go startHTTPServer(router)

	log.Println("[Pareamento] [v2] Sistema de pareamento OK!")
	go app()
	go initWS()
	select {}
}

func loadLegacyStatus(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	var data struct {
		IsLegacy bool `json:"isLegacy"`
	}
	if json.NewDecoder(file).Decode(&data) == nil {
		islegacy = data.IsLegacy
	}
}

func saveLegacyStatusPeriodically(path string) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		saveLegacyStatus(path)
	}
}

func saveLegacyStatus(path string) {
	file, err := os.Create(path)
	if err != nil {
		log.Printf("Error creating data.json: %v", err)
		return
	}
	defer file.Close()
	data := struct {
		IsLegacy bool `json:"isLegacy"`
	}{IsLegacy: islegacy}
	json.NewEncoder(file).Encode(data)
}

func setupRouter(gp *GeniusPlay, pairer *ArduinoPairer) *gin.Engine {
	router := gin.Default()
	router.Use(corsMiddleware())

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	router.Static("/upload", geniusPlayDataPath)
	router.GET("/ws", func(c *gin.Context) {
		handleWebSocket(c.Writer, c.Request, &upgrader, gp, pairer)
	})

	router.NoRoute(func(c *gin.Context) {
		subFS, err := fs.Sub(publicFS, "public")
		if err != nil {
			log.Fatal(err)
		}
		c.FileFromFS(c.Request.URL.Path, http.FS(subFS))
	})
	setupAPIRoutes(router)
	return router
}

func handleWebSocket(w http.ResponseWriter, r *http.Request, upgrader *websocket.Upgrader, gp *GeniusPlay, pairer *ArduinoPairer) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error upgrading to WebSocket:", err)
		return
	}
	defer conn.Close()

	addClient(conn)
	defer removeClient(conn)

	if err := sendInitialData(conn, gp); err != nil {
		return
	}

	go keepAlive(conn)

	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error reading WebSocket message: %v", err)
			}
			break
		}
		handleWebSocketMessage(conn, msg, gp, pairer)
	}
}
func addClient(conn *websocket.Conn) {
	wsClientsMutex.Lock()
	defer wsClientsMutex.Unlock()
	wsClients[conn] = true
}

func removeClient(conn *websocket.Conn) {
	wsClientsMutex.Lock()
	defer wsClientsMutex.Unlock()
	delete(wsClients, conn)
}

func sendInitialData(conn *websocket.Conn, gp *GeniusPlay) error {
	if err := conn.WriteJSON(map[string]string{"type": "uuid", "uuid": uuid.New().String()}); err != nil {
		return err
	}
	return conn.WriteJSON(map[string]interface{}{"type": "state", "data": gp.GetState()})
}

func keepAlive(conn *websocket.Conn) {
	ticker := time.NewTicker(10 * time.Second) // Increased interval for efficiency
	defer ticker.Stop()
	for range ticker.C {
		wsClientsMutex.Lock()
		// Check if connection still exists before writing
		if _, ok := wsClients[conn]; !ok {
			wsClientsMutex.Unlock()
			return
		}
		err := conn.WriteJSON(map[string]string{"type": "keepalive"})
		wsClientsMutex.Unlock()
		if err != nil {
			log.Println("Error sending keepalive:", err)
			return
		}
	}
}

func handleWebSocketMessage(conn *websocket.Conn, msg map[string]interface{}, gp *GeniusPlay, pairer *ArduinoPairer) {
	msgType, ok := msg["type"].(string)
	if !ok {
		log.Println("Invalid message format: type is not a string")
		return
	}

	switch msgType {
	case "list-questionaries":
		questionaries, err := readQuestionaries()
		if err != nil {
			log.Println("Error reading questionnaires:", err)
			return
		}
		conn.WriteJSON(map[string]interface{}{"type": "questionary", "data": questionaries})
	case "upload":
		handleUpload(conn, msg)
	case "handshake":
		conn.WriteJSON(map[string]interface{}{"type": "handshake", "status": isOnline})
		if isLoggedIn {
			conn.WriteJSON(map[string]interface{}{"type": "auth", "data": map[string]interface{}{
				"user":   userData,
				"status": "success",
			}})
		}
		if latestVersion != "" {
			conn.WriteJSON(map[string]interface{}{"type": "version", "data": map[string]interface{}{"version": latestVersion}})
		}
	case "togglepin":
		if pin, ok := msg["pin"].(float64); ok {
			if state, ok := msg["data"].(bool); ok {
				pairer.setPin(int(pin), state)
				conn.WriteJSON(map[string]interface{}{"type": "togglepin", "success": true})
			}
		}
	case "shutdown":
		DoKill()
	case "mode":
		handleModeChange(msg, gp)
	case "scan":
		handleScan(conn, gp)
	case "pair":
		handlePair(conn, msg, gp)
	case "state":
		conn.WriteJSON(map[string]any{"type": "state", "data": gp.GetState()})
	case "config":
		handleConfig(msg, gp)
	case "keepalive":
	case "unpair":
		gp.UnpairDevice()
	case "delete":
		handleDelete(conn, msg)
	case "login":
		if username, ok := msg["username"].(string); ok {
			if password, ok := msg["password"].(string); ok {
				setCredentials(username, password)
			}
		}
	default:
		log.Printf("Unknown message type received: %s\n", msgType)
	}
}
func handleUpload(conn *websocket.Conn, msg map[string]interface{}) {
	data, ok := msg["data"].(string)
	if !ok {
		conn.WriteJSON(map[string]interface{}{"type": "upload", "success": false, "error": "Invalid data format"})
		return
	}

	filename := fmt.Sprintf("%x.json", rand.Uint32())
	filePath := filepath.Join(geniusPlayDataPath, filename)

	if err := os.WriteFile(filePath, []byte(data), 0644); err != nil {
		log.Println("Error saving file:", err)
		conn.WriteJSON(map[string]interface{}{"type": "upload", "success": false})
		return
	}

	conn.WriteJSON(map[string]interface{}{"type": "upload", "success": true, "file": filename})
}

func handleModeChange(msg map[string]interface{}, gp *GeniusPlay) {
	mode, ok := msg["mode"].(string)
	if !ok {
		return
	}
	switch mode {
	case "modern":
		gp.Start()
		log.Println("Modern: ON")
		islegacy = false
		EmitAll("status", "false")
	case "legacy":
		gp.Stop()
		log.Println("Modern: OFF")
		islegacy = true
		EmitAll("status", "false")
	}
}

func handleScan(conn *websocket.Conn, gp *GeniusPlay) {
	log.Println("Command received: discover")
	devices, err := gp.DiscoverDevices()
	if err != nil {
		log.Printf("Error discovering devices: %v", err)
		return
	}

	if len(devices) == 0 {
		log.Println("No devices found.")
	} else {
		log.Println("--- Discovered Devices ---")
		for i, dev := range devices {
			fmt.Printf("[%d] Name: %s, UUID: %s, IP: %s\n", i, dev.Name, dev.UUID, dev.IP)
		}
		log.Println("--------------------------")
	}

	conn.WriteJSON(map[string]interface{}{"type": "scanresult", "data": devices})
}
func handlePair(conn *websocket.Conn, msg map[string]interface{}, gp *GeniusPlay) {
	uuid, ok := msg["uuid"].(string)
	if !ok {
		conn.WriteJSON(map[string]interface{}{"type": "error", "data": "UUID not found or is invalid"})
		return
	}

	if err := gp.PairDevice(uuid); err != nil {
		log.Printf("Error pairing device: %v", err)
	} else {
		log.Printf("Pairing request sent to UUID: %s", uuid)
	}
}

func handleConfig(msg map[string]interface{}, gp *GeniusPlay) {
	if data, ok := msg["data"].([]interface{}); ok {
		ints := make([]int, len(data))
		for i, v := range data {
			if val, ok := v.(float64); ok {
				ints[i] = int(val)
			}
		}
		PinConfig = ints
		if gp.activeConnection != nil {
			sendBase64Json(gp.activeConnection, map[string]interface{}{"type": "config", "pins": ints})
		}
	}
}
func handleDelete(conn *websocket.Conn, msg map[string]interface{}) {
	fileName, ok := msg["file"].(string)
	if !ok {
		conn.WriteJSON(map[string]interface{}{"type": "delete", "success": false, "error": "Invalid filename"})
		return
	}

	filePath := filepath.Join(geniusPlayDataPath, fileName)

	absUploadDir, err := filepath.Abs(geniusPlayDataPath)
	if err != nil {
		log.Println("Error getting absolute path for upload directory:", err)
		conn.WriteJSON(map[string]interface{}{"type": "delete", "success": false})
		return
	}

	absFilePath, err := filepath.Abs(filePath)
	if err != nil || !strings.HasPrefix(filepath.Clean(absFilePath), filepath.Clean(absUploadDir)) {
		log.Println("Attempt to access file outside the allowed directory:", err)
		conn.WriteJSON(map[string]interface{}{"type": "delete", "success": false})
		return
	}

	if err := os.Remove(absFilePath); err != nil {
		log.Println("Error removing file:", err)
		conn.WriteJSON(map[string]interface{}{"type": "delete", "success": false})
		return
	}
	conn.WriteJSON(map[string]interface{}{"type": "delete", "success": true})
}
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
func setupUploadDir() {
	if err := os.MkdirAll(geniusPlayDataPath, 0755); err != nil {
		log.Fatalf("Error creating upload directory: %v", err) // Use Fatalf for critical errors
	}
}

func setupFilesystem() fs.FS {
	subFS, err := fs.Sub(publicFS, "public")
	if err != nil {
		log.Fatal(err)
	}
	return subFS
}

func setupAPIRoutes(router *gin.Engine) {
	router.POST("/upload", func(c *gin.Context) {
		file, err := c.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file sent"})
			return
		}

		dst := filepath.Join(geniusPlayDataPath, file.Filename)
		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "File received"})
	})
}

func startHTTPServer(router *gin.Engine) {
	if err := router.Run(":8080"); err != nil {
		log.Fatal("Error starting HTTP server:", err)
	}
}
func EmitAll(event, msg string) {
	log.Printf("status %s\n", msg)
	broadcastToWebSocketClients(event, msg)
}

func broadcastToWebSocketClients(event string, data interface{}) {
	wsClientsMutex.Lock()
	defer wsClientsMutex.Unlock()

	message := map[string]interface{}{"type": event, "data": data}
	for client := range wsClients {
		if err := client.WriteJSON(message); err != nil {
			log.Println("Error sending message to WebSocket client:", err)
			client.Close()
			delete(wsClients, client)
		}
	}
}

func NoPanic() {
	go func() {
		if r := recover(); r != nil {
			logfile, err := os.OpenFile("gppanic.txt", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
			if err == nil {
				defer logfile.Close()
				logLine := fmt.Sprintf("[%s] PANIC: %v\n%s\n", time.Now().Format(time.RFC3339), r, getStack())
				logfile.WriteString(logLine)
			}
			log.Printf("[PANIC] %v\n%s\n", r, getStack())
		}
	}()
}

func getStack() string {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, true)
	return string(buf[:n])
}