# Security Policy

## Supported Versions

Perch is currently in active pre-1.0 development. Only the latest commit on the
`live` branch is supported with security fixes. Once tagged releases begin,
this table will be updated to reflect which versions receive patches.

| Version          | Supported          |
| ---------------- | ------------------ |
| `live` (latest)  | :white_check_mark: |
| older / tagged   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in Perch, please **do not open a
public issue**. Instead, report it privately using one of the following:

- **GitHub Private Vulnerability Reporting**: open the "Security" tab on this
  repository and click "Report a vulnerability"
- **Email**: me@lxghtblvee.dev

Please include as much detail as possible: the affected component (hub, agent,
or web frontend), steps to reproduce, and the potential impact (e.g. auth
bypass, credential exposure, RCE).

### What to expect

- I'll acknowledge your report within a few days
- I'll keep you updated as I investigate and work on a fix
- Once a fix is released, I'll credit you in the release notes (unless you'd
  prefer to remain anonymous)

Given Perch handles sensitive data (session tokens, OAuth credentials, hub
auth tokens, container/host metrics), reports involving authentication,
authorization, or credential handling are treated as high priority.
