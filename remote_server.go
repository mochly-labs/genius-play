package main

import (
	"context"
	"log"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/zalando/go-keyring"
)

var (
	username, password, userDisplayName, institutionName, institutionShortname, latestVersion string
	isLoggedIn                                                                                bool
	userData                                                                                  map[string]interface{}
)

func saveCredentials(user, pass string) error {
	err := keyring.Set("geniusplay", "username", user)
	if err != nil {
		return err
	}
	return keyring.Set("geniusplay", "password", pass)
}

func loadCredentials() (string, string, error) {
	user, err := keyring.Get("geniusplay", "username")
	if err != nil {
		return "", "", err
	}
	pass, err := keyring.Get("geniusplay", "password")
	if err != nil {
		return "", "", err
	}
	return user, pass, nil
}

var ctx2 context.Context
var cancel2 context.CancelFunc

func setCredentials(user, pass string) error {
	username, password = user, pass
	cancel2()
	return saveCredentials(user, pass)
}

func initWS() {
	username, password, _ = loadCredentials()

	for {
		ctx2, cancel2 = context.WithTimeout(context.Background(), 5*time.Second)
		conn, _, err := websocket.Dial(ctx2, "wss://geniusplay-server.onrender.com", nil)

		if err != nil {
			time.Sleep(5 * time.Second)
			continue
		}
		defer conn.Close(websocket.StatusNormalClosure, "bye")

		authMsg := map[string]interface{}{
			"type":     "auth",
			"username": username,
			"password": password,
		}

		// Setup keepalive
		keepalive := time.NewTimer(30 * time.Second)

		for {
			var msg map[string]interface{}
			err := wsjson.Read(context.Background(), conn, &msg)
			if err != nil {
				handleDisconnect()
				break
			}

			keepalive.Reset(30 * time.Second)

			switch msg["type"] {
			case "auth":
				if success, _ := msg["success"].(bool); success {
					data := msg["user"].(map[string]interface{})
					userDisplayName = data["name"].(string)
					institutionName = data["institutionName"].(string)
					institutionShortname = data["institutionShortname"].(string)
					log.Printf("Logged in as %s from %s (%s)", userDisplayName, institutionName, institutionShortname)
					isLoggedIn = true
					userData = data
					broadcastToWebSocketClients("auth", map[string]interface{}{
						"status": "success",
						"user":   data,
					})
				} else {
					log.Println("Auth failed:", msg["error"])
					broadcastToWebSocketClients("auth", map[string]interface{}{
						"status": "failed",
						"error":  msg["error"],
					})
				}
			case "version":
				log.Println("Server version:", msg["version"])
				broadcastToWebSocketClients("version", map[string]interface{}{
					"version": msg["version"],
				})
				latestVersion = msg["version"].(string)
			case "ping":
			default:
				if uuid, ok := msg["uuid"].(string); ok {
					isonline = true
					if isOnline {
						statusItemG.SetTitle("Status: Online")
						setStatus("Online")
					} else {
						statusItemG.SetTitle("Status: Online (Sem Arduino)")
						setStatus("Online (Sem Arduino)")
					}
					wsjson.Write(context.Background(), conn, authMsg)
					log.Println("Received UUID:", uuid)
				} else {
					log.Printf("Unknown message: %#v", msg)
				}
			}
		}
		time.Sleep(2 * time.Second)
	}
}

func handleDisconnect() {
	isonline = false
	isLoggedIn = false
	userData = nil
	if isOnline {
		statusItemG.SetTitle("Status: Offline (Pareado)")
		setStatus("Offline (Pareado)")
	} else {
		statusItemG.SetTitle("Status: Offline")
		setStatus("Offline")
	}
}
