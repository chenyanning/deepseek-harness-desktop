/**
 * Render the DeepSeek whale mark (build/icon.svg, reproduced from the
 * harness's own favicon.svg) onto a 512x512 rounded blue tile, producing
 * build/icon.png. Uses sharp (libvips SVG rasterizer) so the logo renders
 * pixel-accurately with its real nonzero fill-rule.
 *
 * Usage: npm i -D sharp && node scripts/render-icon.mjs
 */

import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SVG_SRC = path.join(ROOT, 'build', 'icon.svg')
const OUT = path.join(ROOT, 'build', 'icon.png')
const SIZE = 512

const svg = fs.readFileSync(SVG_SRC, 'utf8')
const m = svg.match(/<path[^>]*d="([^"]+)"/s)
if (!m) throw new Error('could not extract whale path from build/icon.svg')
const d = m[1]

// whale spans roughly x∈[0.5,49.4], y∈[6.9,43.6] in a 50x50 viewBox.
// scale 6.2 → ~304px wide, then center on the 512px tile.
const SCALE = 6.2
const TX = 256 - 25 * SCALE
const TY = 256 - 25.25 * SCALE

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b7cfa"/>
      <stop offset="0.55" stop-color="#3b5bfd"/>
      <stop offset="1" stop-color="#2f3fd8"/>
    </linearGradient>
  </defs>
  <rect x="32" y="32" width="${SIZE - 64}" height="${SIZE - 64}" rx="116" fill="url(#bg)"/>
  <g transform="translate(${TX.toFixed(2)} ${TY.toFixed(2)}) scale(${SCALE})">
    <path d="${d}" fill="#ffffff" fill-rule="nonzero"/>
  </g>
</svg>`

const png = await sharp(Buffer.from(iconSvg), { density: 144 })
  .resize(SIZE, SIZE)
  .png()
  .toBuffer()

fs.writeFileSync(OUT, png)
console.log('wrote', OUT, '(' + png.length + ' bytes)')
