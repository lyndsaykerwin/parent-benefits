# Bundle

Helps new parents find, check and match benefits and deals. Guest-only (no sign-in).

Started from the MIT-licensed VibeCode template (commit 6af369a); see the first git commit.

```
npm install
npm run dev      # http://localhost:5000, API health at /api/health
npm test
npm run check    # type check
```

Settings are read from `../.secrets/bundle.env.local`, then `.env.local` and `.env`. See `.env.example`.
