package main

import (
	_ "embed"
	"fmt"
	"os"

	"fyne.io/systray"
)

//go:embed icon_offline.ico
var iconGrayIco []byte

//go:embed icon_online_no_arduino.ico
var iconYellowIco []byte

//go:embed icon_operational.ico
var iconGreenIco []byte

//go:embed icon_offline_operational.ico
var iconBlueIco []byte
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
	go func() {
		<-mQuit.ClickedCh
		systray.Quit()
		cancel()
		os.Exit(0)
	}()
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
		systray.SetTemplateIcon(iconGrayIco, iconGrayIco)
		statusText = "Offline"
	case "Online (Sem Arduino)":
		systray.SetTemplateIcon(iconYellowIco, iconYellowIco)
		statusText = "Online, sem Arduino"
	case "Online":
		systray.SetTemplateIcon(iconGreenIco, iconGreenIco)
		statusText = "Operacional"
	case "Offline (Pareado)":
		systray.SetTemplateIcon(iconBlueIco, iconBlueIco)
		statusText = "Offline, operacional"
	default:
		systray.SetTemplateIcon(iconGrayIco, iconGrayIco)
		statusText = "Desconhecido"
		fmt.Printf("Status desconhecido: %s\n", mode)
	}
}
