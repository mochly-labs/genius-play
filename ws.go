package main

import (
	"context"
	"time"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

func initWS() {
	for {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		conn, _, err := websocket.Dial(ctx, "ws://localhost:3000/ws", nil)
		cancel()
		if err != nil {
			//log.Printf("failed to connect: %v. Retrying in 2s...", err)
			time.Sleep(5 * time.Second)
			continue
		}
		defer conn.Close(websocket.StatusNormalClosure, "bye-bye~ 💫")

		//log.Println("✨ Connected to WebSocket server!")

		for {
			var msg map[string]interface{}
			err := wsjson.Read(context.Background(), conn, &msg)
			if err != nil {
				//log.Printf("connection closed or error: %v", err)
				isonline = false
				if isOnline {
					statusItemG.SetTitle("Status: Offline (Pareado)")
					setStatus("Offline (Pareado)")
				} else {
					statusItemG.SetTitle("Status: Offline")
					setStatus("Offline")
				}
				break // break inner loop to reconnect
			}
			/*if uuid, ok := msg["uuid"].(string); ok {
				//log.Printf("🎉 Received UUID: %s", uuid)
				isonline = true
				if isOnline {
					statusItemG.SetTitle("Status: Online")
					setStatus("Online")
				} else {
					statusItemG.SetTitle("Status: Online (Sem Arduino)")
					setStatus("Online (Sem Arduino)")
				}
			} else if _, ok := msg["ping"]; ok {
				//log.Println("Keepalive received!")
			} else {
				//log.Printf("🤔 Unknown message: %#v", msg)
			}*/
		}
		//log.Println("Reconnecting to WebSocket server in 2s...")
		time.Sleep(2 * time.Second)
	}
}
