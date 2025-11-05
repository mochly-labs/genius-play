package main

import (
	"context"
	"errors"
	"log"
	"math"
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

const (
	wsURL              = "wss://geniusplay-server.onrender.com"
	dialTimeout        = 10 * time.Second
	pingInterval       = 25 * time.Second
	readTimeout        = 40 * time.Second
	baseReconnectDelay = 1 * time.Second
	maxReconnectDelay  = 3 * time.Minute
)

var connectionCancel context.CancelFunc

func setCredentials(user, pass string) error {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in setCredentials: %v", r)
		}
	}()
	username, password = user, pass

	if connectionCancel != nil {
		log.Println("Novas credenciais definidas, forçando reconexão...")
		connectionCancel()
	}

	return saveCredentials(user, pass)
}

func initWS() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in initWS (manager): %v", r)
		}
	}()

	username, password, _ = loadCredentials()
	reconnectAttempts := 0

	for {
		ctx, cancel := context.WithCancel(context.Background())
		connectionCancel = cancel

		log.Println("Iniciando nova tentativa de conexão WebSocket...")
		err := manageSingleConnection(ctx)

		cancel()

		if err == nil {
			log.Println("Conexão fechada normalmente.")
			reconnectAttempts = 0
		} else {
			log.Printf("Erro na conexão: %v", err)
			handleDisconnect()
			reconnectAttempts++
		}

		delay := time.Duration(math.Pow(2, float64(reconnectAttempts))) * baseReconnectDelay
		if delay > maxReconnectDelay {
			delay = maxReconnectDelay
		}

		log.Printf("Aguardando %v antes de tentar reconectar.", delay)
		time.Sleep(delay)
	}
}

func manageSingleConnection(ctx context.Context) error {
	dialCtx, cancelDial := context.WithTimeout(ctx, dialTimeout)
	defer cancelDial()

	conn, _, err := websocket.Dial(dialCtx, wsURL, nil)
	if err != nil {
		return err
	}
	defer conn.Close(websocket.StatusNormalClosure, "Encerrando sessão")

	log.Println("Conexão WebSocket estabelecida.")

	authMsg := map[string]interface{}{"type": "auth", "username": username, "password": password}
	if err := wsjson.Write(ctx, conn, authMsg); err != nil {
		return err
	}

	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				pingCtx, pingCancel := context.WithTimeout(ctx, 5*time.Second)
				if err := conn.Ping(pingCtx); err != nil {
					log.Printf("Falha ao enviar ping: %v", err)
					pingCancel()
					return
				}
				pingCancel()
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		readCtx, cancelRead := context.WithTimeout(ctx, readTimeout)
		var msg map[string]interface{}
		err := wsjson.Read(readCtx, conn, &msg)
		cancelRead()

		if err != nil {
			var closeErr websocket.CloseError
			if errors.As(err, &closeErr) {
				log.Printf("Conexão fechada pelo servidor: Código %d, Razão: %s", closeErr.Code, closeErr.Reason)
				if closeErr.Code == websocket.StatusNormalClosure || closeErr.Code == websocket.StatusGoingAway {
					return nil
				}
			}
			return err
		}

		processMessage(msg)
	}
}

func processMessage(msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		log.Printf("Mensagem recebida sem tipo definido: %#v", msg)
		return
	}

	switch msgType {
	case "auth":
		if success, _ := msg["success"].(bool); success {
			data, ok := msg["user"].(map[string]interface{})
			if !ok {
				log.Printf("Dados do usuário inválidos recebidos: %#v", msg["user"])
				broadcastToWebSocketClients("auth", map[string]interface{}{"status": "failed", "error": "Dados do usuário inválidos"})
				return
			}
			if data != nil {
				userDisplayName, _ = data["name"].(string)
				institutionName, _ = data["institutionName"].(string)
				institutionShortname, _ = data["institutionShortname"].(string)
			}
			log.Printf("Autenticado com sucesso como %s", userDisplayName)
			isLoggedIn = true
			userData = data
			broadcastToWebSocketClients("auth", map[string]interface{}{"status": "success", "user": data})
		} else {
			log.Println("Falha na autenticação:", msg["error"])
			broadcastToWebSocketClients("auth", map[string]interface{}{"status": "failed", "error": msg["error"]})
		}

	case "version":
		log.Println("Versão do servidor:", msg["version"])
		broadcastToWebSocketClients("version", map[string]interface{}{"version": msg["version"]})
		if ver, ok := msg["version"].(string); ok {
			latestVersion = ver
		}

	case "ping":
		break

	default:
		if uuid, ok := msg["uuid"].(string); ok {
			isOnline = true
			if isOnline {
				setStatus("Online")
			} else {
				setStatus("Online (Sem Arduino)")
			}
			log.Println("UUID recebido:", uuid)
		} else {
			log.Printf("Mensagem de tipo desconhecido: %#v", msg)
		}
	}
}

func handleDisconnect() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered in handleDisconnect: %v", r)
		}
	}()

	if !isLoggedIn && !isOnline {
		return
	}

	log.Println("Conexão perdida. Atualizando status para offline.")

	isOnline = false
	isLoggedIn = false
	userData = nil

	if isOnline {
		setStatus("Offline (Pareado)")
	} else {
		setStatus("Offline")
	}
}
