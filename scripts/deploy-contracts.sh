#!/bin/bash

# Monte Contract Deployment Script
# This script deploys Soroban smart contracts to the Stellar testnet

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NETWORK="${STELLAR_NETWORK:-testnet}"
RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
SECRET_KEY="${SOROBAN_SECRET_KEY}"

# Contract paths
CONTRACTS_DIR="smartcontracts/contracts"
PAYMENT_REGISTRY_WASM="${CONTRACTS_DIR}/payment_registry_contract/target/wasm32-unknown-unknown/release/payment_registry_contract.wasm"
MERCHANT_VAULT_WASM="${CONTRACTS_DIR}/merchant_vault_contract/target/wasm32-unknown-unknown/release/merchant_vault_contract.wasm"
ESCROW_WASM="${CONTRACTS_DIR}/escrow_contract/target/wasm32-unknown-unknown/release/escrow_contract.wasm"

# Output file for contract IDs
CONTRACT_IDS_FILE=".contract_ids"

echo -e "${GREEN}=== Monte Contract Deployment Script ===${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v soroban &> /dev/null; then
    echo -e "${RED}Error: soroban CLI not found. Please install it first.${NC}"
    echo "Visit: https://soroban.stellar.org/docs/getting-started/setup"
    exit 1
fi

if [ -z "$SECRET_KEY" ]; then
    echo -e "${RED}Error: SOROBAN_SECRET_KEY environment variable not set.${NC}"
    echo "Please set it in your .env file or export it before running this script."
    exit 1
fi

# Check if WASM files exist
echo -e "${YELLOW}Checking WASM files...${NC}"
for wasm in "$PAYMENT_REGISTRY_WASM" "$MERCHANT_VAULT_WASM" "$ESCROW_WASM"; do
    if [ ! -f "$wasm" ]; then
        echo -e "${RED}Error: WASM file not found: $wasm${NC}"
        echo "Please build the contracts first with: cargo build --target wasm32-unknown-unknown --release"
        exit 1
    fi
done

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Function to deploy a contract
deploy_contract() {
    local contract_name=$1
    local wasm_path=$2
    local init_args=$3

    echo -e "${YELLOW}Deploying $contract_name...${NC}"
    
    # Upload the contract
    echo "Uploading $contract_name WASM..."
    WASM_HASH=$(soroban contract upload \
        --wasm "$wasm_path" \
        --rpc-url "$RPC_URL" \
        --secret-key "$SECRET_KEY" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --quiet)
    
    echo "WASM Hash: $WASM_HASH"
    
    # Deploy the contract
    echo "Deploying $contract_name..."
    CONTRACT_ID=$(soroban contract deploy \
        --wasm-hash "$WASM_HASH" \
        --rpc-url "$RPC_URL" \
        --secret-key "$SECRET_KEY" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        --quiet)
    
    echo -e "${GREEN}✓ $contract_name deployed${NC}"
    echo "Contract ID: $CONTRACT_ID"
    
    # Initialize if arguments provided
    if [ -n "$init_args" ]; then
        echo "Initializing $contract_name..."
        soroban contract invoke \
            --id "$CONTRACT_ID" \
            --rpc-url "$RPC_URL" \
            --secret-key "$SECRET_KEY" \
            --network-passphrase "$NETWORK_PASSPHRASE" \
            $init_args
        echo -e "${GREEN}✓ $contract_name initialized${NC}"
    fi
    
    echo ""
    echo "$CONTRACT_ID"
}

# Deploy contracts
echo -e "${GREEN}=== Starting Deployment ===${NC}"
echo ""

# Deploy Payment Registry
echo "=== Payment Registry Contract ==="
PAYMENT_REGISTRY_ID=$(deploy_contract "Payment Registry" "$PAYMENT_REGISTRY_WASM" "")

# Deploy Merchant Vault
echo "=== Merchant Vault Contract ==="
# Get the admin address from the secret key
ADMIN_ADDRESS=$(soroban keys address --secret-key "$SECRET_KEY")
MERCHANT_VAULT_ID=$(deploy_contract "Merchant Vault" "$MERCHANT_VAULT_WASM" "-- initialize --admin $ADMIN_ADDRESS")

# Deploy Escrow
echo "=== Escrow Contract ==="
ESCROW_ID=$(deploy_contract "Escrow" "$ESCROW_WASM" "-- initialize --admin $ADMIN_ADDRESS")

# Save contract IDs
echo -e "${GREEN}=== Saving Contract IDs ===${NC}"
cat > "$CONTRACT_IDS_FILE" << EOF
# Monte Contract IDs
# Generated on: $(date)

PAYMENT_REGISTRY_CONTRACT_ID=$PAYMENT_REGISTRY_ID
MERCHANT_VAULT_CONTRACT_ID=$MERCHANT_VAULT_ID
ESCROW_CONTRACT_ID=$ESCROW_ID

# Stellar Configuration
STELLAR_NETWORK=$NETWORK
STELLAR_RPC_URL=$RPC_URL
STELLAR_NETWORK_PASSPHRASE="$NETWORK_PASSPHRASE"
EOF

echo -e "${GREEN}✓ Contract IDs saved to $CONTRACT_IDS_FILE${NC}"
echo ""

# Summary
echo -e "${GREEN}=== Deployment Summary ===${NC}"
echo ""
echo "Payment Registry Contract ID: $PAYMENT_REGISTRY_ID"
echo "Merchant Vault Contract ID: $MERCHANT_VAULT_ID"
echo "Escrow Contract ID: $ESCROW_ID"
echo ""
echo -e "${GREEN}✓ All contracts deployed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Add the contract IDs to your .env file"
echo "2. Source the contract IDs file: source $CONTRACT_IDS_FILE"
echo "3. Update your frontend to use the deployed contracts"
