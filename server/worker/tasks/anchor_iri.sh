#!/bin/bash

set -o pipefail

# Configure regen.
export REGEN_KEYRING_BACKEND=test
export REGEN_NODE=$REGEN_WORKER_NODE
KEY_NAME=service-key

# First check if already anchored and exit.
regen q data anchor-by-iri $GRAPHILE_WORKER_JOB_KEY && exit 0

# Configure service key.
regen keys show -a $KEY_NAME || echo $REGEN_WORKER_MNEMONIC | regen keys add $KEY_NAME --recover

# Build and sign tx.
TX_SIGNED=$(regen tx data anchor $GRAPHILE_WORKER_JOB_KEY --from $KEY_NAME --gas-prices $REGEN_WORKER_GAS_PRICES --output json --generate-only | regen tx sign --from $KEY_NAME /dev/stdin)
TX_SIGNATURE=$(echo $TX_SIGNED | jq -r '.signatures | first')

# Broadcast tx and check for success. This can catch insufficient funds.
TX_CODE=$(echo $TX_SIGNED | regen tx broadcast /dev/stdin -b sync --output json | jq -r '.code')
test ! $TX_CODE -eq 0 && exit $TX_CODE

# Check for TX_SIGNATURE to be included in a block.
COUNT=0
sleep 2
RESPONSE=$(regen query tx --type signature $TX_SIGNATURE --output json | jq -r '.code')
while [[ $COUNT -lt 10 && $? -ne 0 ]]
do
  echo "retry $COUNT"
  COUNT=$((COUNT + 1))
  sleep 2
  RESPONSE=$(regen query tx --type signature $TX_SIGNATURE --output json | jq -r '.code')
done

# Check that last tx query command was successful.
RESULT=$?
test ! $RESULT -eq 0 && exit $RESULT

# Exit with response code.
exit $RESPONSE