# Accounts and keys: where everything lives

No secrets in this file. The secrets themselves are in `.secrets/` (private to your Mac account, outside any code repo) and `setup/zetaris-getting-started/.env.local`.

| Service | What it's for | Status (Oct 22) | Where the keys are |
|---|---|---|---|
| **Zetaris** (AWS cluster) | The data door: one question across many sources | ✅ Connected, sample query passed | `setup/zetaris-getting-started/.env.local`; details in setup/zetaris-aws-setup-notes.md |
| **Neon** (project `parent-benefits`, AWS US East 2, Ohio) | Database: accounts, families, feedback, program rules | ✅ Connected (PostgreSQL 18.6) | `.secrets/bundle.env.local` (`DATABASE_URL`) |
| **Firebase** (project `parent-benefits`) | Sign-in (email + Google) | ⬜ Check Email/Password and Google sign-in are switched on. Storage deliberately **off** (needs the paid plan). | Web config in `.secrets/bundle.env.local`; server key in `.secrets/firebase-admin-key.json` |
| **NVIDIA** | The AI brains (Nemotron models) | ⬜ Claim credits (HackOS → Resources → NVIDIA), then get the key at build.nvidia.com | (not yet) |
| **GitHub** | Public code repo for judging | ⬜ Create during build | (not yet) |
| **Hosting** (Render or Replit) | Live link for the demo | ⬜ Decide | (not yet) |

## After the hackathon: retire keys that were shared in chat

- Zetaris API key: delete it in Gateway → Management → API Tokens.
- Neon password: Neon → project → Roles → reset the `neondb_owner` password.
- Firebase server key: Project settings → Service accounts → manage keys → delete the key ending `cdd734cbc5`. (This one never went through chat; delete it anyway if the project ends.)
