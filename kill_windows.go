//go:build windows

package main

import (
	"os"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var job windows.Handle

func SetupKill() {
	var err error
	job, err = windows.CreateJobObject(nil, nil)
	if err != nil {
		return
	}

	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE

	_, _ = windows.SetInformationJobObject(
		job,
		windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)),
		uint32(unsafe.Sizeof(info)),
	)

	hProc, _ := windows.GetCurrentProcess()
	_ = windows.AssignProcessToJobObject(job, hProc)
}

func DoKill() {
	if job != 0 {
		_ = windows.CloseHandle(job)
	}
	time.Sleep(100 * time.Millisecond)
	os.Exit(0)
}
