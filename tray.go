package main

import (
	_ "embed"
	"fmt"
	"os"

	"github.com/mxmauro/go-systray"
)

//go:embed icon_offline.png
var iconGray []byte

//go:embed icon_online_no_arduino.png
var iconYellow []byte

//go:embed icon_operational.png
var iconGreen []byte

//go:embed icon_offline_operational.png
var iconBlue []byte

var statusText = "Desconhecido"
var statusItemG *systray.MenuItem

func initTray() {
	var status = "Offline"
	systray.Run(func() {
		onReady(&status)
	}, onExit)
}

func onReady(status *string) {
	// Status padrão
	setStatus("Offline")

	statusItem := systray.AddMenuItem("Status: "+statusText, "Mostra o status atual")
	systray.AddSeparator()

	statusItemG = statusItem

	mQuit := systray.AddMenuItem("Sair", "Desligar o Daemon")

	mQuit.Click(func() {
		systray.Quit()

		os.Exit(0)
	})
}

func onExit() {
}

var currentMode string

func setStatus(mode string) {
	if mode == currentMode {
		// Mode is already set, do nothing
		return
	}

	currentMode = mode

	switch mode {
	case "Offline":
		systray.SetIcon(iconGray)
		statusText = "Offline"
	case "Online (Sem Arduino)":
		systray.SetIcon(iconYellow)
		statusText = "Online, sem Arduino"
	case "Online":
		systray.SetIcon(iconGreen)
		statusText = "Operacional"
	case "Offline (Pareado)":
		systray.SetIcon(iconBlue)
		statusText = "Offline, operacional"
	default:
		systray.SetIcon(iconGray)
		statusText = "Desconhecido"
		fmt.Printf("Status desconhecido: %s\n", mode)
	}
}
