FROM curlimages/curl:latest AS fetch
RUN curl -fsSL -o /tmp/nebula.tar.gz https://github.com/slackhq/nebula/releases/download/v1.6.1/nebula-linux-amd64.tar.gz
WORKDIR /nebula
RUN tar -xzf /tmp/nebula.tar.gz

FROM golang:1.20.3-bullseye AS build
WORKDIR /app
COPY . .
RUN go build -o supernovad

FROM debian:bullseye AS app

WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=fetch /nebula/nebula /app/nebula
COPY --from=fetch /nebula/nebula-cert /app/nebula-cert
COPY --from=build /app/supernovad /app/supernovad

ENV NEBULA_EXECUTABLE=/app/nebula
ENTRYPOINT ["/app/supernovad"]
