#!/usr/bin/env bash
# Lightweight commit-message check — fast, no deps. Enforces the classic git shape:
#   * a non-empty subject line, <= 72 chars, not ending in a period
#   * a blank line between the subject and any body
# Machine-generated messages (merge / revert / fixup! / squash! / amend!) are skipped.
set -euo pipefail

msg_file="${1:?usage: check_commit_msg.sh <commit-msg-file>}"

awk '
  function fail(m) { printf("commit-msg: %s\n", m) > "/dev/stderr"; exit 1 }
  /^#/ { next }                                    # ignore comment lines
  !have_subject && $0 ~ /^[[:space:]]*$/ { next }  # skip leading blank lines
  !have_subject {
    have_subject = 1
    if ($0 ~ /^(Merge |Revert |fixup!|squash!|amend!)/) { skip = 1; exit 0 }
    if (length($0) > 72) fail("subject is " length($0) " chars (max 72): " $0)
    if ($0 ~ /\.$/)      fail("subject should not end with a period")
    next
  }
  have_subject && body_line++ == 0 {               # first line after the subject
    if ($0 !~ /^[[:space:]]*$/) fail("leave a blank line between the subject and the body")
  }
  END {
    if (!have_subject && !skip) fail("empty commit message")
  }
' "$msg_file"
