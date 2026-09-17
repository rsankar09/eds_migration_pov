#!/usr/bin/env bash
# PreToolUse/Skill hook — inject the EDS block-authoring contract.
#
# Adobe's edge-delivery-services skills are vendored and refreshed on a
# schedule, so this repo's rules cannot live inside them. They live in
# .claude/skills/eds-block-authoring/references/authoring-contract.md and are
# injected here instead, which means:
#   - a vendor refresh cannot drop them,
#   - entering through Adobe's `building-blocks` cannot bypass them,
#   - there is exactly one copy to keep true.
#
# Exits 0 and emits nothing for non-matching skills, so it is inert elsewhere.
set -uo pipefail

CONTRACT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/skills/eds-block-authoring/references/authoring-contract.md"

payload="$(cat)"
skill="$(printf '%s' "$payload" | jq -r '.tool_input.skill // empty' 2>/dev/null)"

# Block-authoring entry points, custom and vendored. Keep in sync with the
# matcher note in .claude/settings.json.
case "$skill" in
  eds-block-authoring | \
  *building-blocks | \
  *content-driven-development | \
  *testing-blocks) ;;
  *) exit 0 ;;
esac

[ -r "$CONTRACT" ] || exit 0

jq -n --rawfile contract "$CONTRACT" --arg skill "$skill" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: ("Repo-owned EDS block-authoring contract, injected for `\($skill)`. These rules are normative for block code in this repository and take precedence over more general guidance in the skill itself.\n\n" + $contract)
  },
  suppressOutput: true
}'
