//go:build darwin

package main

import "os/exec"

var statusText = "Desconhecido"
var currentMode string

type dummyMenuItem struct{}

func (d *dummyMenuItem) SetTitle(_ string) {}

var statusItemG = &dummyMenuItem{}

func initTray()              {}
func onReady(status *string) {}
func onExit()                {}
func setStatus(mode string)  {}
func app() {
	exec.Command("open", "http://127.0.0.1:8080").Start()
}
