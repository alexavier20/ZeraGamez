# Site Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Zera GameZ favicon that remains recognizable in light and dark browser tabs.

**Architecture:** Generate one static 512 × 512 PNG from the existing transparent white brand symbol by compositing it over the brand-red background. Declare that public asset in `index.html`; Vite copies it unchanged to the build root, and the Vercel rewrite explicitly excludes the root favicon so it is served as an image instead of the SPA document.

**Tech Stack:** HTML, Vite public assets, Vitest, Node.js `Buffer`, PowerShell `System.Drawing`, Codex in-app Browser

## Global Constraints

- Create `public/favicon.png` at exactly 512 × 512 pixels.
- Use `#e70012` as the solid background color.
- Derive the centered white symbol from `public/assets/images/zera-gamez-z-icon-white-header.png` without deformation.
- Declare `/favicon.png` with `rel="icon"` and `type="image/png"` in `index.html`.
- Do not add a web app manifest, installable-app icons, dependencies, or React changes.
- The Vercel flow must return `/favicon.png` as `200 image/png`, without routing it to the SPA fallback.

---

## File Structure

- Create `public/favicon.png`: final browser favicon, served from the site root and copied unchanged by Vite.
- Create `src/app-metadata.test.ts`: regression coverage for the HTML declaration, PNG signature, and exact dimensions.
- Modify `index.html`: declare the dedicated favicon in the document head.
- Modify `vercel.json`: exclude `/favicon.png` from the SPA fallback rewrite.

### Task 1: Add and verify the dedicated favicon

**Files:**

- Create: `public/favicon.png`
- Create: `src/app-metadata.test.ts`
- Modify: `index.html:3-12`
- Modify: `vercel.json:4-8`

**Interfaces:**

- Consumes: `public/assets/images/zera-gamez-z-icon-white-header.png`, the existing 512 × 512 transparent white symbol.
- Produces: `GET /favicon.png -> 200 image/png`, `<link rel="icon" type="image/png" href="/favicon.png" />`, and a SPA fallback that still handles interface routes.

- [ ] **Step 1: Write the failing metadata and asset tests**

Create `src/app-metadata.test.ts`:

```ts
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('app metadata', () => {
  it('declares the dedicated PNG favicon', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    const document = new DOMParser().parseFromString(html, 'text/html');
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    expect(favicon).not.toBeNull();
    expect(favicon).toHaveAttribute('type', 'image/png');
    expect(favicon).toHaveAttribute('href', '/favicon.png');
  });

  it('ships a 512 pixel square PNG favicon', async () => {
    const favicon = await readFile(new URL('../public/favicon.png', import.meta.url));

    expect([...favicon.subarray(0, 8)]).toEqual(pngSignature);
    expect(favicon.readUInt32BE(16)).toBe(512);
    expect(favicon.readUInt32BE(20)).toBe(512);
  });
});
```

- [ ] **Step 2: Run the targeted test and verify the expected failures**

Run:

```powershell
npm.cmd run test:run -- src/app-metadata.test.ts
```

Expected: FAIL because `index.html` has no `link[rel="icon"]` and `public/favicon.png` does not exist.

- [ ] **Step 3: Generate the branded PNG asset**

Run this PowerShell from the repository root. It composites the existing transparent symbol over the approved red background without changing the canvas size:

```powershell
Add-Type -AssemblyName System.Drawing
$sourcePath = Resolve-Path 'public/assets/images/zera-gamez-z-icon-white-header.png'
$outputPath = Join-Path (Get-Location) 'public/favicon.png'
$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
$faviconBitmap = [System.Drawing.Bitmap]::new(512, 512)
$graphics = [System.Drawing.Graphics]::FromImage($faviconBitmap)

try {
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#e70012'))
  $graphics.DrawImage($sourceImage, 0, 0, 512, 512)
  $faviconBitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $faviconBitmap.Dispose()
  $sourceImage.Dispose()
}
```

Inspect `public/favicon.png` once after generation to confirm a red square with the undistorted white symbol centered on it.

Verify the exact background pixel while the image library is loaded:

```powershell
$faviconCheck = [System.Drawing.Bitmap]::new((Resolve-Path 'public/favicon.png'))
try {
  $corner = $faviconCheck.GetPixel(0, 0)
  if ($corner.R -ne 231 -or $corner.G -ne 0 -or $corner.B -ne 18 -or $corner.A -ne 255) {
    throw "Unexpected favicon background: $($corner.R),$($corner.G),$($corner.B),$($corner.A)"
  }
} finally {
  $faviconCheck.Dispose()
}
```

Expected: no thrown error; the corner pixel is opaque `#e70012` (`231,0,18,255`).

- [ ] **Step 4: Declare the favicon in the document head**

Add this line immediately after the theme-color metadata in `index.html`:

```html
<link rel="icon" type="image/png" href="/favicon.png" />
```

- [ ] **Step 5: Run the targeted test and verify it passes**

Run:

```powershell
npm.cmd run test:run -- src/app-metadata.test.ts
```

Expected: PASS with 1 test file and 2 tests passing.

- [ ] **Step 6: Reproduce the Vercel rewrite failure before changing its configuration**

Start the real local project flow:

```powershell
npm.cmd run dev -- --listen 127.0.0.1:3000
```

In a second PowerShell process, run:

```powershell
$faviconResponse = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/favicon.png'
if ($faviconResponse.Headers.'Content-Type' -notlike 'image/png*') {
  throw "Expected image/png but received $($faviconResponse.Headers.'Content-Type')"
}
```

Expected: FAIL with `Expected image/png but received text/html`, proving that the current SPA rewrite catches the root favicon.

- [ ] **Step 7: Exclude the root favicon from the SPA fallback**

In `vercel.json`, change the rewrite source to:

```json
"source": "/((?!api/|assets/|favicon\\.png$|@|src/|shared/|node_modules/|__vite).*)"
```

This is the smallest routing change: `/favicon.png` becomes a static response while UI routes still fall back to `index.html`.

- [ ] **Step 8: Verify the Vercel response and rendered page**

Repeat the PowerShell request from Step 6.

Expected: PASS with status `200`, content type `image/png`, and no thrown error. Also confirm the response bytes start with `89-50-4E-47-0D-0A-1A-0A`.

Then use the Codex in-app Browser for this target flow:

`http://127.0.0.1:3000/ loads -> the document declares /favicon.png -> the favicon response is a valid image -> navigation to /lancamentos keeps the same favicon declaration.`

Record these checks:

- Page URL is `http://127.0.0.1:3000/` and title is `Zera GameZ`.
- The DOM snapshot contains meaningful application content and no framework overlay.
- `document.querySelector('link[rel="icon"]')` reports `type="image/png"` and an absolute `href` ending in `/favicon.png`.
- The console has no relevant errors or warnings.
- A screenshot shows the application rendered normally.
- Clicking `Lançamentos` reaches `/lancamentos`, where the same favicon declaration remains present.

- [ ] **Step 9: Run the project verification suite**

Run:

```powershell
npm.cmd run test:run -- --exclude ".worktrees/**"
npm.cmd run typecheck
npm.cmd run build
npm.cmd exec prettier -- --check index.html src/app-metadata.test.ts vercel.json
```

Expected: every command exits with code 0. Prove Vite copied the verified asset to the production root unchanged:

```powershell
$publicHash = (Get-FileHash 'public/favicon.png' -Algorithm SHA256).Hash
$distHash = (Get-FileHash 'dist/favicon.png' -Algorithm SHA256).Hash
if ($publicHash -ne $distHash) {
  throw 'dist/favicon.png differs from public/favicon.png'
}
```

Expected: no thrown error; both files have the same SHA-256 hash.

- [ ] **Step 10: Commit the implementation**

```powershell
git add public/favicon.png index.html src/app-metadata.test.ts vercel.json
git commit -m "feat: add branded site favicon"
```
