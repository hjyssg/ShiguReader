# Dev Environment Setup

## Quick Start

```bash
npm install
npm run start
```

## Full Setup

1. Install Node.js (16+ recommended).
2. Optional tools:
   - [ImageMagick](https://imagemagick.org)
   - 7-Zip (required on macOS/Linux, included on Windows)
   - Git Bash for Windows (CMD may not work)
3. Clone the repository and configure paths:

```bash
git clone https://github.com/hjyssg/ShiguReader
cd ShiguReader
# edit config-path.ini and config-etc.ini
```

4. Install dependencies:

```bash
npm install
# In China:
npm install -g cnpm --registry=https://registry.npm.taobao.org
cnpm install
```

5. Start the development server:

```bash
npm run start
```

6. Open the URL printed in the terminal.

### Frontend project layout

The React app lives under `packages/frontend/src`. The key entry files are:

- `main.jsx`: bootstraps the React root with `createRoot`.
- `App.jsx`: hosts the router and top-level layout.
- Folder breakdown:
  - `assets/`: co-located static resources bundled at build time.
  - `components/`: reusable UI widgets (shared sub-components live in `components/common/`).
  - `pages/`: route-level screens rendered by the router.
  - `context/`, `services/`, `styles/`, `utils/`: state, API wrappers, styling helpers, and utility modules.
  - Legacy shared helpers required by the backend remain in `common/` and `name-parser/` for compatibility.

### Sync frontend assets into the backend build

Run `packages/backend/etc/sync_frontend_assets_to_backend.py` to compile the frontend and copy the fresh build artifacts into the backend package. The script executes `npm run build` for you and then mirrors the generated `dist` files plus the shared modules in `src/common` and `src/name-parser`, ensuring the backend bundles stay aligned with the reorganized frontend structure.

| Software | Required | Notes |
|----------|----------|-------|
| Node.js | Yes | v16 recommended |
| ImageMagick | No | Optional utility |
| 7-Zip | Conditional | Needed on macOS/Linux |
| Git Bash | Conditional | Needed on Windows |

