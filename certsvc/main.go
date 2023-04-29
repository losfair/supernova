package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	ddb_types "github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/google/uuid"
)

const certTTLSecs = 86400
const certGracePeriod = 86400 * 2

const caCrtPath = "/tmp/ca.crt"
const caKeyPath = "/tmp/ca.key"

var awsConfig aws.Config
var dynamodbDevicesTable string

type MinimalRequest struct {
	Action string `json:"action"`
}

type CertificateRequest struct {
	PublicKey    string   `json:"public_key"`
	Name         string   `json:"name"`
	Groups       []string `json:"groups"`
	IP           string   `json:"ip"`
	DurationSecs int64    `json:"duration_secs"`
}

type CertificateResponse struct {
	Crt         string `json:"crt"`
	RenewableAt int64  `json:"renewable_at"`
}

type PeriodicRenewResponse struct {
	Count int64 `json:"count"`
}

func HandleCertRequest(certReq CertificateRequest) (*CertificateResponse, error) {
	// Generate a random UUID for the certificate and key files
	uuid := uuid.New().String()
	certPath := fmt.Sprintf("/tmp/%s.crt", uuid)
	pubkeyPath := fmt.Sprintf("/tmp/%s.pub", uuid)
	defer os.Remove(certPath)
	defer os.Remove(pubkeyPath)

	err := os.WriteFile(pubkeyPath, []byte(certReq.PublicKey), 0644)
	if err != nil {
		return nil, fmt.Errorf("error writing public key to %s: %v", pubkeyPath, err)
	}

	ttlSecs := int64(certTTLSecs)
	if certReq.DurationSecs != 0 {
		ttlSecs = certReq.DurationSecs
	}

	ttlSecsWithGracePeriod := ttlSecs + certGracePeriod

	// Run the nebula-cert command to generate the certificate and key files
	nebulaCmd := exec.Command("./nebula-cert", "sign",
		"-name", certReq.Name,
		"-ip", certReq.IP,
		"-groups", strings.Join(certReq.Groups, ","),
		"-ca-crt", caCrtPath,
		"-ca-key", caKeyPath,
		"-out-crt", certPath,
		"-in-pub", pubkeyPath,
		"-duration", fmt.Sprintf("%ds", ttlSecsWithGracePeriod),
	)
	output, err := nebulaCmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("error running nebula-cert: %v: %s", err, output)
	}

	// Read the certificate and key files
	certBytes, err := os.ReadFile(certPath)
	if err != nil {
		return nil, fmt.Errorf("error reading certificate file: %v", err)
	}

	// Construct the response
	return &CertificateResponse{
		Crt:         string(certBytes),
		RenewableAt: time.Now().Unix() + ttlSecs,
	}, nil
}

func HandlePeriodicRenewRequest(ctx context.Context) (*PeriodicRenewResponse, error) {
	currentTimeSecs := time.Now().Unix()
	client := dynamodb.NewFromConfig(awsConfig, func(o *dynamodb.Options) {
		ddbEndpoint := os.Getenv("DYNAMODB_ENDPOINT")
		if ddbEndpoint != "" {
			o.EndpointResolver = dynamodb.EndpointResolverFromURL(ddbEndpoint)
		}
	})
	output, err := client.Scan(ctx, &dynamodb.ScanInput{
		TableName: &dynamodbDevicesTable,

		// Only select entries where renewableAt < currentTimeSecs
		FilterExpression: aws.String("renewableAt < :currentTimeSecs"),
		ExpressionAttributeValues: map[string]ddb_types.AttributeValue{
			":currentTimeSecs": &ddb_types.AttributeValueMemberN{
				Value: fmt.Sprintf("%d", currentTimeSecs),
			},
		},
	})
	if err != nil {
		return nil, err
	}

	var count int64

	// Loop through the results and renew each certificate
	for _, item := range output.Items {
		req := CertificateRequest{
			PublicKey: item["publicKey"].(*ddb_types.AttributeValueMemberS).Value,
			Name:      item["deviceName"].(*ddb_types.AttributeValueMemberS).Value,
			Groups:    item["groups"].(*ddb_types.AttributeValueMemberSS).Value,
			IP:        item["ip"].(*ddb_types.AttributeValueMemberS).Value,
		}
		res, err := HandleCertRequest(req)
		if err != nil {
			log.Printf("Error signing new certificate for device %s: %v", req.Name, err)
			continue
		}

		// Update the renewableAt field in the database
		_, err = client.UpdateItem(ctx, &dynamodb.UpdateItemInput{
			TableName: &dynamodbDevicesTable,
			Key: map[string]ddb_types.AttributeValue{
				"deviceName": &ddb_types.AttributeValueMemberS{
					Value: req.Name,
				},
			},

			// This check is not strictly correct when there is clock drift - but it's fine
			ConditionExpression: aws.String("renewableAt = :oldRenewableAt"),

			UpdateExpression: aws.String("SET renewableAt = :renewableAt, crt = :crt"),
			ExpressionAttributeValues: map[string]ddb_types.AttributeValue{
				":oldRenewableAt": item["renewableAt"].(*ddb_types.AttributeValueMemberN),
				":renewableAt": &ddb_types.AttributeValueMemberN{
					Value: fmt.Sprintf("%d", res.RenewableAt),
				},
				":crt": &ddb_types.AttributeValueMemberS{
					Value: res.Crt,
				},
			},
		})

		if err != nil {
			log.Printf("Error updating cert for device %s: %v", req.Name, err)
			continue
		}

		log.Printf("Successfully renewed certificate for device %s", req.Name)
		count++
	}
	return &PeriodicRenewResponse{Count: count}, nil
}

func HandleRequest(ctx context.Context, req json.RawMessage) (interface{}, error) {
	reqBytes, err := req.MarshalJSON()
	if err != nil {
		return nil, err
	}

	var minReq MinimalRequest
	err = json.Unmarshal(reqBytes, &minReq)
	if err != nil {
		return nil, err
	}

	switch minReq.Action {
	case "sign":
		var certReq CertificateRequest
		err = json.Unmarshal(reqBytes, &certReq)
		if err != nil {
			return nil, err
		}
		return HandleCertRequest(certReq)
	case "periodic_renew":
		return HandlePeriodicRenewRequest(ctx)
	default:
		return nil, fmt.Errorf("invalid action: %s", minReq.Action)
	}
}

func main() {
	var err error

	awsConfig, err = config.LoadDefaultConfig(context.Background())
	if err != nil {
		log.Fatal(err)
	}

	// Decode the environment variables
	caCrtBase64 := os.Getenv("NEBULA_CA_CRT_B64")
	caKeyBase64 := os.Getenv("NEBULA_CA_KEY_B64")
	caCrt, err := base64.StdEncoding.DecodeString(caCrtBase64)
	if err != nil {
		log.Fatalf("Error decoding NEBULA_CA_CRT_B64: %s", err)
	}
	caKey, err := base64.StdEncoding.DecodeString(caKeyBase64)
	if err != nil {
		log.Fatalf("Error decoding NEBULA_CA_KEY_B64: %s", err)
	}

	dynamodbDevicesTable = os.Getenv("DYNAMODB_DEVICES_TABLE")

	// Save the certificate authority files to /tmp/
	err = os.WriteFile(caCrtPath, caCrt, 0644)
	if err != nil {
		log.Fatalf("Error writing CA certificate to %s: %s", caCrtPath, err)
	}
	err = os.WriteFile(caKeyPath, caKey, 0644)
	if err != nil {
		log.Fatalf("Error writing CA key to %s: %s", caKeyPath, err)
	}

	lambda.Start(HandleRequest)
}
