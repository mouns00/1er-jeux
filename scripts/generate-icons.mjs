// Génère les icônes PNG et les écrans de démarrage iOS à partir du SVG.
// Usage : node scripts/generate-icons.mjs  (nécessite Playwright + Chromium)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Playwright local au projet, ou installé globalement.
const { chromium } = require(require.resolve("playwright", { paths: [process.cwd(), ...(process.env.NODE_PATH ?? "").split(":")] }));
import { readFile, writeFile } from "node:fs/promises";

const svg = await readFile("public/icons/icon.svg", "utf8");
const svgMaskable = await readFile("public/icons/icon-maskable.svg", "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();

async function rendre(html, width, height, out) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><html><head><style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}</style></head><body>${html}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await writeFile(out, await page.screenshot({ type: "png", omitBackground: true }));
  console.log("✓", out);
}

const img = (s, size) =>
  `<div style="width:${size}px;height:${size}px">${s.replace("<svg ", `<svg width="${size}" height="${size}" `)}</div>`;

for (const size of [192, 512]) await rendre(img(svg, size), size, size, `public/icons/icon-${size}.png`);
await rendre(img(svgMaskable, 512), 512, 512, "public/icons/icon-maskable-512.png");
await rendre(img(svgMaskable, 180), 180, 180, "public/icons/apple-touch-icon.png");

const splashs = [
  [1170, 2532], [1179, 2556], [1290, 2796], [1125, 2436], [750, 1334],
];
for (const [w, h] of splashs) {
  const icone = Math.round(w * 0.28);
  await rendre(
    `<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&display=block" rel="stylesheet">
     <div style="width:${w}px;height:${h}px;background:#f6f1e9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(w * 0.06)}px;font-family:'Bricolage Grotesque',system-ui,sans-serif;color:#1c1917">
       <div style="border-radius:${Math.round(icone * 0.22)}px;overflow:hidden">${img(svg, icone)}</div>
       <div style="font-size:${Math.round(w * 0.07)}px;font-weight:700;letter-spacing:-0.02em">Le Jumeau de décision</div>
     </div>`,
    w, h, `public/splash/splash-${w}x${h}.png`,
  );
}
await browser.close();
