BINARY := kondate-supporter

.PHONY: build build-rpi run fmt clean

build:
	go build -o bin/$(BINARY) ./cmd/server

build-rpi:
	GOOS=linux GOARCH=arm GOARM=6 CGO_ENABLED=0 go build -o bin/$(BINARY)-armv6 ./cmd/server

run:
	go run ./cmd/server

fmt:
	go fmt ./...

clean:
	rm -rf bin
