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

func main() {
	go initTray()
	setupUploadDir()
	var pairer = NewArduinoPairer()
	go pairer.Pair()
	subFS := setupFilesystem()

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

		// Se for preflight (OPTIONS), responde direto
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	router.Static("/upload", geniusPlayPath)
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
			} else if msg["type"] == "togglepin" {
				pin := int(msg["pin"].(float64))
				state := msg["data"].(bool)

				pairer.setPin(pin, state)
				conn.WriteJSON(map[string]interface{}{"type": "togglepin", "success": true})
			} else if msg["type"] == "delete" {
				fileName := msg["file"].(string)
				filePath := filepath.Join(geniusPlayPath, fileName)

				// Ensure the filePath is within the upload directory
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
	//httpserver.Listen("0.0.0.0:3000", nil)

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
		if msg == "false" {
			isOnline = false
		} else if msg == "true" {
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
