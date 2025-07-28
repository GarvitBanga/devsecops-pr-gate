package rules.tags_required

required := {"owner", "env"}

deny[msg] {
  input.tags_missing[name]
  msg := sprintf("Missing required tag: %s on %s", [name, input.address])
} 