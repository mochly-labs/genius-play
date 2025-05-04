//go:build darwin

package main

import (
	"fmt"
	"runtime"

	"fyne.io/systray"
)

var statusText = "Desconhecido"
var statusItemG *systray.MenuItem

func initTray() {
	var status = "Offline"
	systray.Run(func() {
		onReady(&status)
	}, onExit)
}

func onReady(status *string) {
	statusItem := systray.AddMenuItem("Status: "+statusText, "Mostra o status atual")
	systray.AddSeparator()

	statusItemG = statusItem
	mQuit := systray.AddMenuItem("Sair", "Fecha o Genius Play e suas aplicações.")
	go func() {
		<-mQuit.ClickedCh
		systray.Quit()
		cancel()
		runtime.Goexit()
	}()
}

func onExit() {
	// clean up here
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
		systray.(iconGray)
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
