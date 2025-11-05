// main.go
package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"math/rand/v2"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"context"
	"os"
)

//go:embed public/*
var publicFS embed.FS

var isonline = false
var islegacy = true

type LogMessage struct {
	Level   string `json:"level"`
	Message string `json:"message"`
	Time    string `json:"time"`
}

type DeviceStatus struct {
	Online bool `json:"online"`
}

var wsClients = make(map[*websocket.Conn]bool)
var wsClientsMutex = &sync.Mutex{}

var isOnline = false
var (
	currentStatus = &DeviceStatus{Online: false}
)

var ctx, cancel = context.WithCancel(context.Background())

var userHome, _ = os.UserHomeDir()
var geniusPlayPath = filepath.Join(userHome, "GeniusPlay")
var geniusPlayDataPath = filepath.Join(geniusPlayPath, "data")

func main() {
	SetupKill()
	go initTray()
	setupUploadDir()
	var pairer = NewArduinoPairer()
	go pairer.Pair()
	subFS := setupFilesystem()
	gp := New(8001, 44444)

	dataJsonPath := filepath.Join(geniusPlayPath, "data.json")

	func() {
		file, err := os.Open(dataJsonPath)
		if err == nil {
			defer file.Close()
			type legacyData struct {
				IsLegacy bool `json:"isLegacy"`
			}
			var data legacyData
			decoder := json.NewDecoder(file)
			if decoder.Decode(&data) == nil {
				islegacy = data.IsLegacy
			}
		}
	}()

	if !islegacy {
		gp.Start()
	}

	go func() {
		for {
			func() {
				type legacyData struct {
					IsLegacy bool `json:"isLegacy"`
				}
				file, err := os.Create(dataJsonPath)
				if err != nil {
					return
				}
				defer file.Close()
				data := legacyData{IsLegacy: islegacy}
				encoder := json.NewEncoder(file)
				encoder.Encode(data)
			}()
			time.Sleep(2 * time.Second)
		}
	}()


	router := gin.Default()
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	router.Static("/upload", geniusPlayDataPath)
	router.GET("/ws", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Println("Erro ao atualizar para WebSocket:", err)
			return
		}
		defer conn.Close()

		wsClientsMutex.Lock()
		wsClients[conn] = true
		wsClientsMutex.Unlock()

		defer func() {
			wsClientsMutex.Lock()
			delete(wsClients, conn)
			wsClientsMutex.Unlock()
			conn.Close()
		}()

		keepAliveTicker := time.NewTicker(1 * time.Second)
		defer keepAliveTicker.Stop()
		uuid := fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", rand.Uint32(), rand.Uint32()&0xFFFF, (rand.Uint32()&0x0FFF)|0x4000, (rand.Uint32()&0x3FFF)|0x8000, rand.Uint64()&0xFFFFFFFFFFFF)
		conn.WriteJSON(map[string]string{"type": "uuid", "uuid": uuid})

		conn.WriteJSON(map[string]interface{}{
			"type": "state",
			"data": gp.GetState(),
		})

		go func() {
			for range keepAliveTicker.C {
				if err := conn.WriteJSON(map[string]string{"type": "keepalive"}); err != nil {
					log.Println("Erro ao enviar keepalive:", err)
					return
				}
			}
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("Erro ao ler mensagem do WebSocket:", err)
				break
			}

			var msg map[string]interface{}
			if err := json.Unmarshal(message, &msg); err != nil {
				log.Println("Erro ao decodificar mensagem JSON:", err)
				continue
			}

			if msg["type"] == "list-questionaries" {
				questionaries, err := readQuestionaries()
				if err != nil {
					log.Println("Erro ao ler questionários:", err)
					continue
				}
				conn.WriteJSON(map[string]interface{}{"type": "questionary", "data": questionaries})
			} else if msg["type"] == "upload" {
				data := fmt.Sprintf("%v", msg["data"])
				filename := fmt.Sprintf("%x.json", rand.Uint32())
				fileName := filepath.Join(geniusPlayPath, filename)

				file, err := os.Create(fileName)
				if err != nil {
					log.Println("Erro ao salvar arquivo:", err)
					conn.WriteJSON(map[string]interface{}{"type": "upload", "success": false})
					continue
				}

				_, err = file.WriteString(data)
				if err != nil {
					log.Println("Erro ao salvar arquivo:", err)
					conn.WriteJSON(map[string]interface{}{"type": "upload", "success": false})
					continue
				}

				conn.WriteJSON(map[string]interface{}{"type": "upload", "success": true, "file": filename})
			} else if msg["type"] == "handshake" {
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
			} else if msg["type"] == "togglepin" {
				pin := int(msg["pin"].(float64))
				state := msg["data"].(bool)

				pairer.setPin(pin, state)
				conn.WriteJSON(map[string]interface{}{"type": "togglepin", "success": true})
			} else if msg["type"] == "shutdown" {
				DoKill()
			} else if msg["type"] == "mode" {
				switch msg["mode"] {
				case "modern":
					gp.Start()
					log.Printf("Modern: ON")
					islegacy = false
				case "legacy":
					gp.Stop()
					log.Printf("Modern: OFF")
					islegacy = true
				}
			} else if msg["type"] == "scan" {

				log.Println("Comando recebido: discover")
				devices, err := gp.DiscoverDevices()
				if err != nil {
					log.Printf("Erro ao descobrir dispositivos: %v", err)
					continue
				}
				if len(devices) == 0 {
					log.Println("Nenhum dispositivo encontrado.")
					continue
				}
				log.Println("--- Dispositivos Descobertos ---")
				for i, dev := range devices {
					fmt.Printf("[%d] Nome: %s, UUID: %s, IP: %s\n", i, dev.Name, dev.UUID, dev.IP)
				}
				log.Println("---------------------------------")

				conn.WriteJSON(map[string]interface{}{
					"type": "scanresult",
					"data": devices,
				})
			} else if msg["type"] == "pair" {
				uuid, ok := msg["uuid"]
				if !ok {
					conn.WriteJSON(map[string]interface{}{
						"type": "error",
						"data": "UUID not found or is invalid",
					})
					return
				}
				uuidStr, ok := uuid.(string)
				if !ok {
					conn.WriteJSON(map[string]interface{}{
						"type": "error",
						"data": "UUID not found or is invalid",
					})
				}

				if err := gp.PairDevice(uuidStr); err != nil {
					log.Printf("Erro ao parear dispositivo: %v", err)
				} else {
					log.Printf("Pedido de pareamento enviado para o UUID: %s", uuid)
				}
			} else if msg["type"] == "state" {
				currentState := gp.GetState()
				conn.WriteJSON(map[string]any{
					"type": "state",
					"data": currentState,
				})
			} else if msg["type"] == "config" {

				if data, ok := msg["data"].([]interface{}); ok {
					ints := make([]int, len(data))
					for i, v := range data {
						ints[i] = int(v.(float64))
					}
					PinConfig = ints
					if gp.activeConnection != nil {
						sendBase64Json(gp.activeConnection, map[string]interface{}{"type": "config", "pins": ints})
					}
				}
			} else if msg["type"] == "keepalive" {
			} else if msg["type"] == "unpair" {
				gp.UnpairDevice()
			} else if msg["type"] == "delete" {
				fileName := msg["file"].(string)
				filePath := filepath.Join(geniusPlayPath, fileName)

				absUploadDir, err := filepath.Abs(geniusPlayPath)
				if err != nil {
					log.Println("Erro ao obter caminho absoluto do diretório upload:", err)
					conn.WriteJSON(map[string]interface{}{"type": "delete", "success": false})
					continue
				}

				absFilePath, err := filepath.Abs(filePath)
				if err != nil || !strings.HasPrefix(filepath.Clean(absFilePath), filepath.Clean(absUploadDir)) {
					log.Println("Tentativa de acessar arquivo fora do diretório permitido:", err)
					conn.WriteJSON(map[string]interface{}{"type": "delete", "success": false})
					continue
				}

				err = os.Remove(absFilePath)
				if err != nil {
					log.Println("Erro ao remover arquivo:", err)
					conn.WriteJSON(map[string]interface{}{"type": "delete", "success": false})
					continue
				}
				conn.WriteJSON(map[string]interface{}{"type": "delete", "success": true})
			} else if msg["type"] == "login" {
				username := msg["username"].(string)
				password := msg["password"].(string)
				setCredentials(username, password)
			} else {
				fmt.Printf("Mensagem recebida: %s\n", msg["type"])
			}
		}
	})

	router.NoRoute(func(c *gin.Context) {
		c.FileFromFS(c.Request.URL.Path, http.FS(subFS))
	})
	setupAPIRoutes(router)
	go startHTTPServer(router)

	time.Sleep(1 * time.Second)
	log.Println("[Pareamento] [v2] Sistema de pareamento OK!")

	go app()
	go initWS()
	select {}
}

func setupUploadDir() {
	if err := os.MkdirAll(geniusPlayPath, 0755); err != nil {
		log.Fatal("Erro ao criar diretório upload:", err)
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
		file, _ := c.FormFile("file")
		if file == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Nenhum arquivo enviado"})
			return
		}

		dst := filepath.Join("upload", file.Filename)
		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "Arquivo recebido"})
	})
}

func startHTTPServer(router *gin.Engine) {
	if err := router.Run(":8080"); err != nil {
		log.Fatal("Erro ao iniciar servidor HTTP:", err)
	}
}

func EmitAll(event, msg string) {
	if event == "status" {
		switch msg {
		case "false":
			isOnline = false
		case "true":
			isOnline = true
		}
	}
	broadcastToWebSocketClients(event, msg)
}

func broadcastToWebSocketClients(event string, data interface{}) {
	wsClientsMutex.Lock()
	defer wsClientsMutex.Unlock()

	for client := range wsClients {
		err := client.WriteJSON(map[string]interface{}{"type": event, "data": data})
		if err != nil {
			log.Println("Erro ao enviar mensagem para cliente WebSocket:", err)
			client.Close()
			delete(wsClients, client)
		}
	}
}
