import { readFileSync, writeFileSync } from "node:fs";

// 沿用个人网站的字符集、两层单纯形噪声、流场扭曲与文字时间常数。
// SVG 以声明式位移和明暗变化表达流动，不嵌入脚本、字体或逐帧位图。
const width = 854, height = 300;
const fract = (x: number) => x - Math.floor(x);
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash(x: number, y: number): [number, number] {
  return [2 * fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123) - 1,
    2 * fract(Math.sin(x * 269.5 + y * 183.3) * 43758.5453123) - 1];
}
function simplex(x: number, y: number) {
  const s = (x + y) * .366025404, ix = Math.floor(x + s), iy = Math.floor(y + s);
  const u = (ix + iy) * .211324865, ax = x - ix + u, ay = y - iy + u;
  const cx = ax > ay ? 1 : 0, cy = 1 - cx;
  const corners: [number, number, number, number][] = [[ax, ay, ix, iy],
    [ax - cx + .211324865, ay - cy + .211324865, ix + cx, iy + cy],
    [ax - 1 + .42264973, ay - 1 + .42264973, ix + 1, iy + 1]];
  return corners.reduce((sum, [dx, dy, gx, gy]) => {
    const w = Math.max(0, .5 - dx * dx - dy * dy), g = hash(gx, gy);
    return sum + w ** 4 * (dx * g[0] + dy * g[1]);
  }, 0) * 70;
}
const fbm = (x: number, y: number) => (.62 * simplex(x, y) + .2976 * simplex(x * 2, y * 2)) * .5 + .5;
function field(phase: number) {
  const lines: string[] = [];
  for (let row = 0; row < 44; row++) {
    let line = "";
    for (let col = 0; col < 164; col++) {
      const x = col / 154, y = row / 38;
      const wx = fbm(x * .54, y * .54 + phase * .18), wy = fbm(x * .54 + 1.2, y * .54 - phase * .26);
      const fluid = fbm((x - (wx - .5) * .88 * .034) * .58 + wx * 2.65,
        (y - (wy - .5) * 2.64 * .034) * .58 + wy * 2.65);
      const bright = smooth(.30, .82, fluid), threshold = .625 - fract(Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) * .1;
      const density = Math.pow(smooth(threshold, 1, bright), .52);
      const level = bright > threshold ? Math.min(7, Math.floor(density * 7) + 1) : 0;
      line += " .:-=+*#%@"[level];
    }
    line = line.trimEnd();
    if (line.trim()) lines.push(`<text x="-24" y="${row * 8 - 20}" class="row r${row % 4}">${line}</text>`);
  }
  return lines.join("");
}
const logo = readFileSync(new URL("../assets/logo.svg", import.meta.url), "utf8").match(/ d="([^"]+)"/)?.[1];
if (!logo) throw new Error("缺少个人网站的原始 Logo 路径");
const xml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
function reveal(width: number, chars: number, delay: number, step: number) {
  const duration = delay + chars * step;
  const values = Array.from({length: chars + 1}, (_, i) => width * i / chars).join(";");
  const times = Array.from({length: chars + 1}, (_, i) => i === 0 ? 0 : (delay + i * step) / duration).join(";");
  return `<animate attributeName="width" values="${values}" keyTimes="${times}" calcMode="discrete" dur="${duration}s" begin="0s" fill="freeze"/>`;
}
function banner(footer: boolean) {
  const title = footer ? "END" : "HELLO WORLD";
  const identity = footer ? "Curiosity makes knowledge a game." : "I'm Lang Tan";
  const font = 72, glyph = font * .6, tw = title.length * glyph;
  const subFont = footer ? 32 : 36, subWidth = identity.length * subFont * .6;
  const titleX = (width - tw) / 2, baseline = footer ? 218 : 127;
  const subBaseline = footer ? 119 : 192;
  const revealAt = .38, identityAt = revealAt + title.length * .1 + .4;
  const text = `<g font-family="Consolas,'Liberation Mono',monospace" fill="#f6f6f6">
    <svg x="${titleX}" y="${baseline - font}" width="${tw + 18}" height="${font * 1.5}" overflow="hidden" class="title"><defs><clipPath id="titleReveal"><rect width="${tw + 18}" height="${font * 1.5}">${reveal(tw, title.length, revealAt, .1)}</rect></clipPath></defs><text clip-path="url(#titleReveal)" y="${font}" font-size="${font}" textLength="${tw}" lengthAdjust="spacingAndGlyphs">${title}</text></svg>
    <svg x="${(width - subWidth) / 2}" y="${subBaseline - subFont}" width="${subWidth + 14}" height="${subFont * 1.5}" overflow="hidden" class="identity"><defs><clipPath id="subtitleReveal"><rect width="${subWidth + 14}" height="${subFont * 1.5}">${reveal(subWidth, identity.length, identityAt, .11)}</rect></clipPath></defs><text clip-path="url(#subtitleReveal)" y="${subFont}" font-size="${subFont}" fill="#c8cbd5" textLength="${subWidth}" lengthAdjust="spacingAndGlyphs">${identity}</text></svg>
    <rect x="${titleX}" y="${baseline - font + 3}" width="${glyph * .3}" height="${font}" fill="#bfc7dc" class="cursor"/>
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="854" height="300" viewBox="0 0 854 300" role="img" aria-labelledby="title desc">
<title id="title">${footer ? "Lang Tan / Akira · ASCII Logo" : "Lang Tan / Akira · ASCII"}</title>
<desc id="desc">${xml(title)} / ${xml(identity)}. ${footer ? "个人网站原始标志随字符流明暗显现。" : "无标志的字符流。"} 文字依次打出，背景为轻量矢量动画。</desc>
<style>
.row{font:9px Consolas,'Liberation Mono',monospace;white-space:pre;fill:#e6e8ed}
.flow{animation:drift 18s ease-in-out infinite alternate}
.r0{opacity:.55;animation:grain 8s ease-in-out infinite alternate}.r1{opacity:.3;animation:grain 11s -4s ease-in-out infinite alternate}.r2{opacity:.45;animation:grain 9s -7s ease-in-out infinite alternate}.r3{opacity:.35;animation:grain 13s -2s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate(-5px,-4px)}to{transform:translate(17px,12px)}}
@keyframes grain{from{opacity:.2}to{opacity:.65}}
.cursor{opacity:0;animation:travel ${title.length * .1}s steps(${title.length},end) ${revealAt}s both,blink .85s step-end ${revealAt}s infinite}
@keyframes travel{from{transform:translateX(0)}to{transform:translateX(${tw + 3}px)}}
@keyframes blink{0%,100%{opacity:.7}50%{opacity:0}}
.logo{animation:presence 12s ease-in-out infinite alternate}
@keyframes presence{0%,100%{opacity:.12}45%{opacity:.38}75%{opacity:.2}}
@media(prefers-reduced-motion:reduce){.flow,.row,.logo{animation:none}.title text,.identity text{clip-path:none}.cursor{display:none}.logo{opacity:.25}}
</style>
<defs>
 <linearGradient id="edgeX"><stop stop-color="white" stop-opacity="0"/><stop offset=".08" stop-color="white"/><stop offset=".92" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
 <linearGradient id="edgeY" x2="0" y2="1"><stop stop-color="white" stop-opacity="0"/><stop offset=".12" stop-color="white"/><stop offset=".88" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
 <mask id="horizontal"><rect width="854" height="300" fill="url(#edgeX)"/></mask>
 <mask id="vertical"><rect width="854" height="300" fill="url(#edgeY)"/></mask>
 <radialGradient id="quiet"><stop stop-color="#050607" stop-opacity=".94"/><stop offset=".7" stop-color="#050607" stop-opacity=".78"/><stop offset="1" stop-color="#050607" stop-opacity="0"/></radialGradient>
 <linearGradient id="logoInk" x2=".5" y2="1"><stop stop-color="#ffdef1"/><stop offset="1" stop-color="#dbefff"/></linearGradient>
</defs>
<rect width="854" height="300" rx="4" fill="#050607"/>
${footer ? `<g class="logo" opacity=".2" transform="translate(291,-8) scale(1.68)"><path fill="url(#logoInk)" d="${logo}"/></g>` : ""}
<g mask="url(#horizontal)"><g mask="url(#vertical)"><g class="flow" xml:space="preserve">${field(footer ? 3.7 : 1.8)}</g></g></g>
<ellipse cx="427" cy="150" rx="390" ry="110" fill="url(#quiet)"/>
${text}
</svg>`;
}
for (const footer of [false, true]) {
  const name = footer ? "footer" : "header", svg = banner(footer);
  writeFileSync(new URL(`../assets/ascii-${name}.svg`, import.meta.url), svg);
  console.log(`${name}: ${Buffer.byteLength(svg)} bytes · ${width} × ${height}`);
}
