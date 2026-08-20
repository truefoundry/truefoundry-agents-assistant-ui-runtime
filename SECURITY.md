# Security Policy

## Supported versions

Security fixes are applied to the latest published release of
[`@truefoundry/assistant-ui-runtime`](https://www.npmjs.com/package/@truefoundry/assistant-ui-runtime)
on the current minor line. Older minors are not routinely patched.

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/truefoundry/truefoundry-agents-assistant-ui-runtime/security/advisories/new)
for this repository.

Do **not** open a public issue for security reports.

Include:

- Affected package version(s)
- A clear description of the issue and impact
- Steps to reproduce (PoC if available)

We will acknowledge reports as soon as practical and coordinate a fix and
disclosure window.

## Demo credentials and browser keys

Example apps may document `VITE_TFY_*` (or similar) env vars for local demos.
Those keys are **not** for production. In production, keep API keys on a
server-side proxy and never ship long-lived credentials in browser bundles.
See the package [QuickStart](packages/truefoundry-agents-assistant-ui-runtime/QuickStart.md)
for the proxy pattern.
