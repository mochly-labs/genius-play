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
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in saveCredentials: %v", r)
		}
	}()
	err := keyring.Set("geniusplay", "username", user)
	if err != nil {
		return err
	}
	return keyring.Set("geniusplay", "password", pass)
}

func loadCredentials() (string, string, error) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in loadCredentials: %v", r)
		}
	}()
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
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in setCredentials: %v", r)
		}
	}()
	username, password = user, pass
	if cancel2 != nil {
		cancel2()
	}
	return saveCredentials(user, pass)
}

func initWS() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in initWS: %v", r)
		}
	}()

	username, password, _ = loadCredentials()

	for {
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Recovered in initWS loop: %v", r)
				}
			}()

			ctx2, cancel2 = context.WithTimeout(context.Background(), 5*time.Second)
			conn, _, err := websocket.Dial(ctx2, "wss://geniusplay-server.onrender.com", nil)

			if err != nil {
				time.Sleep(5 * time.Second)
				return
			}
			defer func() {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("Recovered in conn.Close: %v", r)
					}
				}()
				conn.Close(websocket.StatusNormalClosure, "bye")
			}()

			authMsg := map[string]interface{}{
				"type":     "auth",
				"username": username,
				"password": password,
			}

			keepalive := time.NewTimer(30 * time.Second)

			for {
				func() {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("Recovered in main WS read loop: %v", r)
						}
					}()
					var msg map[string]interface{}
					err := wsjson.Read(context.Background(), conn, &msg)
					if err != nil {
						handleDisconnect()
						return
					}

					keepalive.Reset(30 * time.Second)

					switch msg["type"] {
					case "auth":
						if success, _ := msg["success"].(bool); success {
							data, ok := msg["user"].(map[string]interface{})
							if !ok {
								log.Printf("Invalid type assertion for user data: %#v", msg["user"])
								broadcastToWebSocketClients("auth", map[string]interface{}{
									"status": "failed",
									"error":  "Invalid user data received",
								})
								return
							}
							if data != nil {
								userDisplayNameVal, ok1 := data["name"].(string)
								institutionNameVal, ok2 := data["institutionName"].(string)
								institutionShortnameVal, ok3 := data["institutionShortname"].(string)
								if !ok1 || !ok2 || !ok3 {
									log.Printf("Invalid type assertions in user data: %#v", data)
									broadcastToWebSocketClients("auth", map[string]interface{}{
										"status": "failed",
										"error":  "Invalid user data received",
									})
									return
								}
								userDisplayName = userDisplayNameVal
								institutionName = institutionNameVal
								institutionShortname = institutionShortnameVal
							}
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
						ver, ok := msg["version"].(string)
						if ok {
							latestVersion = ver
						}
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
							func() {
								defer func() {
									if r := recover(); r != nil {
										log.Printf("Recovered in wsjson.Write: %v", r)
									}
								}()
								wsjson.Write(context.Background(), conn, authMsg)
							}()
							log.Println("Received UUID:", uuid)
						} else {
							log.Printf("Unknown message: %#v", msg)
						}
					}
				}()
			}
		}()
		time.Sleep(2 * time.Second)
	}
}

func handleDisconnect() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in handleDisconnect: %v", r)
		}
	}()
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
