//go:build !darwin

package main

import (
	_ "embed"
	"fmt"
	"os"

	"fyne.io/systray"
	_ "github.com/pojntfx/hydrapp/hydrapp/pkg/fixes"
	"github.com/pojntfx/hydrapp/hydrapp/pkg/ui"
)

//go:embed icon_f.ico
var iconGrayIco []byte

//go:embed icon_oo.ico
var iconYellowIco []byte

//go:embed icon_o.ico
var iconGreenIco []byte

//go:embed icon_fo.ico
var iconBlueIco []byte

var statusText = "Desconhecido"
var statusItemG *systray.MenuItem

func initTray() {
	var status = "Offline"
	systray.Run(func() {
		var _ *string = &status
		onReady()
	}, onExit)
}

func onReady() {
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
		DoKill()
	}()
}

func onExit() {
}

var currentMode string

func setStatus(mode string) {
	if mode == currentMode {
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

func app() {
	defer cancel()

	browserState := &ui.BrowserState{}

	ui.LaunchBrowser(
		ctx,

		"http://127.0.0.1:8080",
		"Genius Play",
		"me.mochly.GeniusPlay",

		os.Getenv(ui.EnvBrowser),
		os.Getenv(ui.EnvType),

		ui.ChromiumLikeBrowsers,
		ui.FirefoxLikeBrowsers,
		ui.EpiphanyLikeBrowsers,
		ui.LynxLikeBrowsers,

		browserState,
		ui.ConfigureBrowser,
	)
	os.Exit(0)
}
