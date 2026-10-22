//go:build !windowsgui

package main

// setupLogOutput は何もしない。make run・preview・RaspberryPi向けは標準エラー(コンソール)へ出す。
func setupLogOutput(dbPath string) {}
