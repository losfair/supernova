package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"syscall"
	"time"
)

var nebulaExecPath string
var dashEndpoint string
var deviceName string
var deviceToken string
var configOverride string

func main() {
	nebulaExecPath = mustGetEnv("NEBULA_EXECUTABLE")
	dashEndpoint = mustReadEnvVarOrFile("DASH_ENDPOINT")
	deviceName = mustReadEnvVarOrFile("DEVICE_NAME")
	deviceToken = mustReadEnvVarOrFile("DEVICE_TOKEN")

	configOverride = readEnvVarOrFile("CONFIG_OVERRIDE")

	// Write host.key if provided
	hostKeyBase64 := os.Getenv("HOST_KEY_B64")
	if hostKeyBase64 != "" {
		hostKey, err := base64.StdEncoding.DecodeString(hostKeyBase64)
		if err != nil {
			log.Fatalf("Error decoding HOST_KEY_B64: %s", err)
		}
		if err := os.WriteFile("/tmp/host.key", hostKey, 0600); err != nil {
			log.Fatalf("Error writing host key: %v", err)
		}
	}

	currentConfig := loadConfigUntilSuccess()

	confFile, err := os.CreateTemp("", "supernovad-nebula-*.conf")
	if err != nil {
		log.Fatalf("Error creating temp file: %v", err)
	}
	confFilePath := confFile.Name()
	if err := confFile.Close(); err != nil {
		log.Fatalf("Error closing temp file: %v", err)
	}

	os.WriteFile(confFilePath, []byte(currentConfig), 0644)
	log.Printf("Initial config loaded, path: %s", confFilePath)

	// Run nebula process
	nebulaCmd := exec.Command(nebulaExecPath, "-config", confFilePath)
	nebulaCmd.Stdout = os.Stdout
	nebulaCmd.Stderr = os.Stderr
	if err := nebulaCmd.Start(); err != nil {
		log.Fatalf("Error starting nebula: %v", err)
	}

	// Exit the main process if nebula exits
	go func() {
		err := nebulaCmd.Wait()
		os.Remove(confFilePath)

		if err != nil {
			log.Fatalf("Nebula exited with error: %v", err)
		} else {
			os.Exit(0)
		}
	}()

	// Periodically check config update
	for {
		time.Sleep(71 * time.Second)

		newConfig := loadConfigUntilSuccess()

		if newConfig != currentConfig {
			log.Printf("Config changed, reloading")
			currentConfig = newConfig

			// Directly writing to confFile can corrupt it, but we are fine because it is
			// a temporary file bound to our own lifetime
			os.WriteFile(confFilePath, []byte(currentConfig), 0644)

			nebulaCmd.Process.Signal(syscall.SIGHUP)
		}
	}

}

func loadConfigUntilSuccess() string {
	// Infinitely retry loadConfig until success, with backoff
	backoffMs := 100
	maxBackoffMs := 5000

	for {
		config, err := loadConfig()
		if err == nil {
			return config
		}

		log.Printf("Error loading config: %v, retrying in %d ms", err, backoffMs)

		time.Sleep(time.Duration(backoffMs) * time.Millisecond)
		backoffMs *= 2
		if backoffMs > maxBackoffMs {
			backoffMs = maxBackoffMs
		}
	}
}

func loadConfig() (string, error) {
	body, err := json.Marshal(struct {
		ConfigOverride string `json:"configOverride"`
	}{
		ConfigOverride: configOverride,
	})
	if err != nil {
		return "", err
	}

	client := http.Client{}
	req, err := http.NewRequest(http.MethodPost, dashEndpoint+"/api/device/config", bytes.NewReader(body))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+deviceToken)
	req.Header.Set("X-Device-Name", deviceName)

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}

	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	var respBody struct {
		Config string `json:"config"`
	}

	err = json.NewDecoder(resp.Body).Decode(&respBody)
	if err != nil {
		return "", err
	}

	return respBody.Config, nil
}

func mustGetEnv(name string) string {
	val := os.Getenv(name)
	if val == "" {
		log.Fatalf("Environment variable %s not set", name)
	}
	return val
}

func readEnvVarOrFile(name string) string {
	val := os.Getenv(name)
	if val != "" {
		return val
	}

	file := os.Getenv(name + "_FILE")
	if file == "" {
		return ""
	}

	data, err := os.ReadFile(file)
	if err != nil {
		log.Fatalf("Error reading file %s: %v", file, err)
	}

	return string(data)
}

func mustReadEnvVarOrFile(name string) string {
	val := readEnvVarOrFile(name)
	if val == "" {
		log.Fatalf("Environment variable %s or %s_FILE not set", name, name)
	}
	return val
}
