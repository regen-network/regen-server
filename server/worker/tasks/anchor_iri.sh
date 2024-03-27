#!/bin/bash

# Configure regen.
regen keys show -a service-key --keyring-backend test || regen keys add service-key --no-backup --keyring-backend test

# Anchor data and store response code.
RESPONSE=$(regen tx data anchor $GRAPHILE_WORKER_JOB_KEY \
  --from $(regen keys show -a service-key --keyring-backend test) \
  --keyring-backend test \
  --yes \
  --broadcast-mode block \
  --chain-id $REGEN_CHAIN_ID \
  --node $LEDGER_TENDERMINT_RPC \
  --output json \
  | grep -Po '(?<="code"\:)\d+'
)

# Check the command was successful and got a response code.
test $? -eq 0 && test ! -z $RESPONSE
# Return response code.
exit $RESPONSE