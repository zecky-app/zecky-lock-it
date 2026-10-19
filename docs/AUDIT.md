# Zecky Lock it: audit preparation

Start with [THREAT_MODEL.md](THREAT_MODEL.md): it is what an auditor asks for
first. Notes as of October 2026.

## Shortlist (hardening checklist a4)

| Firm | Why | Evidence |
| --- | --- | --- |
| **Least Authority** | Zcash Ecosystem Security Lead since March 2024 (funded by Zcash Community Grants). Reviewed Zingo and Zwallet, lightwalletd, Zebra, the Keystone hardware wallet for Zcash and the Swift payment-URI library; also audited a mobile wallet. Offers short threat-model consultations. | [role](https://leastauthority.com/?p=8920), [ZCG audits](https://leastauthority.com/blog/tag/zcg/), [Keystone](https://leastauthority.com/blog/audit-of-keystone-hardware-wallet-for-zcash/), [mobile wallet](https://leastauthority.com/?p=8359) |
| **Cure53** | App and mobile-wallet pentests (Exodus, Tangem, Bifrost). Strongest on the iOS side: Keychain, screens, local storage. Less Zcash-specific. | [Exodus](https://cure53.de/pentest-report_exodus.pdf), [Tangem](https://tangem.com/en-GB/blog/post/mobile-wallet-audit/) |
| **Hacken** | Audited the Zcash MetaMask Snap (WebZjs, May 2025), so knows the Zcash wallet libraries. | [report](https://hacken.io/audits/zcash/dapp-zcash-snap-may2025/) |

First contact: Least Authority (consulting@leastauthority.com, or the Zcash
forum). Ask whether a review or a threat-model consultation fits under the
ecosystem role.

## Scope to ask for

- `src/` (wallet logic, Keychain use, send flow, fresh-install and erase).
- `patches/react-native-zcash+0.13.5.patch` (native additions: rotating
  addresses, Tor, wipe, private-node TLS rule, wallet file names, network
  monitor, undelivered-payment codes).
- `ios/Zecky` (AppDelegate: keyboard restriction, privacy cover;
  Info.plist).
- Out of scope: the Zcash SDK and protocol themselves.

## Funding routes (hardening checklist a5)

1. **Least Authority's ecosystem role**: a review or consultation under it,
   if possible. Cheapest route.
2. **Zcash Community Grants**: funds independent teams in the ecosystem;
   applications through the Zcash forum. Check first what identity or entity
   the committee needs. [ZecHub](https://zechub.wiki/zcash-organizations/zcash-community-grants)
3. **Coinholder-directed retroactive grants**: rewards work after the fact;
   relevant once Lock it is public.
   [ZecHub](https://zechub.wiki/zcash-organizations/coinholder-directed-retroactive-grants)
4. **A partner**: later.

## Before the audit

- Freeze and tag an audit version (checklist a2).
- Run `npm run check:deps`, `npx tsc --noEmit`, `npx eslint App.tsx src __tests__`, `npx jest`.
- Make sure How it works matches the build being audited.
