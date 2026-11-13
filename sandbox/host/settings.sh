#!/usr/bin/env bash
# The host's sbx settings and global network policy (ADR 0076, decision 8).
# Run by the owner from WSL; calls sbx.exe. Safe to run again: it only sets
# what differs and prints the settings and policies it ends with.
set -euo pipefail

# Groups of the balanced policy the owner removed (rule IDs from `sbx policy ls --wide`).
REMOVED_GROUPS=()

# Telemetry and cloud metadata hosts that kept asking in PH-48; never approved.
DENIED_HOSTS=(
  http-intake.logs.us5.datadoghq.com
  mobile.events.data.microsoft.com
  default.exp-tas.com
  westus-0.in.applicationinsights.azure.com
  169.254.169.254
  metadata.google.internal
)

sbx() { sbx.exe "$@"; }

sbx settings set telemetry.disabled true
sbx settings set ssh.agentForwardingEnabled false
sbx settings set model.server.enabled false
sbx settings set env.rememberHostCommands false
sbx settings set kit.requireSignature false

# Prints "<id> <decision> <resource>" for every global rule.
global_rules() {
  sbx policy ls --json | python3 -c '
import json, sys
for r in json.load(sys.stdin)["rules"]:
    if r.get("applies_to") == "all":
        for res in r.get("resources", []):
            print(r["id"], r["decision"], res)'
}

rules=$(global_rules)
if ! grep -q '^default-' <<<"$rules"; then
  sbx policy init balanced
  rules=$(global_rules)
fi

for host in "${DENIED_HOSTS[@]}"; do
  grep -q " deny ${host}\$" <<<"$rules" || sbx policy deny network "$host"
done

for group in "${REMOVED_GROUPS[@]}"; do
  if grep -q "^${group} " <<<"$rules"; then sbx policy rm network --id "$group"; fi
done

sbx settings ls
sbx policy ls
