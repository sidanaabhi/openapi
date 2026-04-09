package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"

	clusterservice "github.com/envoyproxy/go-control-plane/envoy/service/cluster/v3"
	discoverygrpc "github.com/envoyproxy/go-control-plane/envoy/service/discovery/v3"
	endpointservice "github.com/envoyproxy/go-control-plane/envoy/service/endpoint/v3"
	listenerservice "github.com/envoyproxy/go-control-plane/envoy/service/listener/v3"
	routeservice "github.com/envoyproxy/go-control-plane/envoy/service/route/v3"
	"github.com/envoyproxy/go-control-plane/pkg/cache/types"
	"github.com/envoyproxy/go-control-plane/pkg/cache/v3"
	"github.com/envoyproxy/go-control-plane/pkg/resource/v3"
	"github.com/envoyproxy/go-control-plane/pkg/server/v3"
	"google.golang.org/grpc"
)

func main() {
	xdsPort := getEnv("XDS_PORT", "18000")

	snapshotCache := cache.NewSnapshotCache(false, cache.IDHash{}, nil)

	// Empty snapshot so Envoy gets an immediate ACK
	emptySnapshot, err := cache.NewSnapshot("1", map[resource.Type][]types.Resource{})
	if err != nil {
		log.Fatalf("failed to create empty snapshot: %v", err)
	}
	if err := snapshotCache.SetSnapshot(context.Background(), "envoy-gateway", emptySnapshot); err != nil {
		log.Fatalf("failed to set empty snapshot: %v", err)
	}

	grpcServer := grpc.NewServer()
	xdsSrv := server.NewServer(context.Background(), snapshotCache, nil)
	discoverygrpc.RegisterAggregatedDiscoveryServiceServer(grpcServer, xdsSrv)
	endpointservice.RegisterEndpointDiscoveryServiceServer(grpcServer, xdsSrv)
	clusterservice.RegisterClusterDiscoveryServiceServer(grpcServer, xdsSrv)
	routeservice.RegisterRouteDiscoveryServiceServer(grpcServer, xdsSrv)
	listenerservice.RegisterListenerDiscoveryServiceServer(grpcServer, xdsSrv)

	lis, err := net.Listen("tcp", ":"+xdsPort)
	if err != nil {
		log.Fatalf("failed to listen on xDS port %s: %v", xdsPort, err)
	}
	log.Printf("xDS gRPC server listening on :%s", xdsPort)
	go func() {
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("xDS server error: %v", err)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"status":"ok"}`)
	})
	log.Println("Health server listening on :8081")
	if err := http.ListenAndServe(":8081", mux); err != nil {
		log.Fatalf("health server error: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
