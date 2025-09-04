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

| Software | Required | Notes |
|----------|----------|-------|
| Node.js | Yes | v16 recommended |
| ImageMagick | No | Optional utility |
| 7-Zip | Conditional | Needed on macOS/Linux |
| Git Bash | Conditional | Needed on Windows |

