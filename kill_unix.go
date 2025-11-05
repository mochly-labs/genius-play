//go:build !windows

package main

import (
	"os"
	"syscall"
	"time"
)

func SetupKill() {
	_ = syscall.Setpgid(0, 0)
}

func DoKill() {
	_ = syscall.Kill(0, syscall.SIGTERM)
	time.Sleep(200 * time.Millisecond)

	_ = syscall.Kill(0, syscall.SIGKILL)

	os.Exit(0)
}
