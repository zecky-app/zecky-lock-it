# Security

Zecky Lock it is a self-custody Zcash wallet. If you find a security
problem, please tell us privately first.

## Reporting a problem

- Email **dev@zecky.app**, or use GitHub's private vulnerability reporting
  on this repository.
- Please do not open a public issue for a security problem.
- Describe what you found and how to reproduce it. A rough note is fine.
- Never send anyone's recovery phrase, including your own. We will never
  ask for it.

We will confirm we received your report and keep you informed while we
fix it. Please give us reasonable time before telling others.

## Scope

The iPhone app in this repository: how it creates and stores the recovery
phrase, guards the lock (Keys to the lock), handles addresses and payments,
and talks to servers. See `docs/THREAT_MODEL.md` for what the app protects
against and its known limits.

This is early software in testing and has not had an independent security
review yet.
