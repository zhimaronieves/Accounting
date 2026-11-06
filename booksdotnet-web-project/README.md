# booksdotnet complete web project

- `outputs/ledgerflow-dashboard`: V1 Original and V2 Updated (both in this React app).
- `outputs/booksdotnet-v3-mci-alignment`: V3 MCI Alignment, including the latest Banking changes.
- `tmp/v3-layout-protected-files.json` and the original source manifest: fixtures required by V3 integrity tests.
- `outputs/booksdotnet-Product-Requirements-Document.md`: system PRD.

Both apps include source, public assets, components, interactions, mock data, tests, lockfiles, configuration and handoff documentation.

## Run locally
Requires Node.js and npm. In either app folder, run:

```powershell
npm ci
npm run dev
```

V1/V2 uses port 5173; V3 uses port 5183. Avoid starting another server on ports already used by the originals. V3 version-switch links point to V1/V2 on port 5173.

```powershell
npm test
npm run build
```

Dependencies, generated builds, caches, old archives, logs and environment/credential files are excluded. `npm ci` restores dependencies from the lockfile.

The originals and running previews were not moved or modified. Bundled seed/mock data is included. Later browser-local edits remain in that browser's localStorage and are not a separate database in this folder.

`COPY-MANIFEST.json` records SHA-256 hashes for every copied file.
