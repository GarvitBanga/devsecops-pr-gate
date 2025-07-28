package main

required := {"owner","env"}

deny[msg] {
  some rtype, name
  res := input.resource[rtype][name]
  missing := {k | k := required[_]; not res.tags[k]}
  count(missing) > 0
  msg := sprintf("Missing required tags %v on %s.%s", [missing, rtype, name])
} 