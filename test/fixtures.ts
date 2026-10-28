import sharp from 'sharp';
const W = 800, H = 600;
function textSvg(rotate = 0, ink = "#111", bg = "#f4f4f4") {
  let lines = '';
  for (let y = 60; y < H - 40; y += 28) {
    for (let x = 50; x < W - 80; x += 70) lines += `<rect x="${x}" y="${y}" width="${40 + ((x * y) % 23)}" height="12" fill="${ink}"/>`;
  }
  return Buffer.from(`<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="${bg}"/><g transform="rotate(${rotate} ${W/2} ${H/2})">${lines}</g></svg>`);
}
export async function fixtures(): Promise<Record<string, Buffer>> {
  const clean = await sharp(textSvg()).png().toBuffer();
  return {
    clean,
    blurry: await sharp(clean).blur(6).png().toBuffer(),
    dark: await sharp(clean).linear(0.15, 0).png().toBuffer(),
    faded: await sharp(textSvg(0, '#b8b8b8', '#d0d0d0')).png().toBuffer(),
    glare: await sharp(clean).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><circle cx="400" cy="300" r="110" fill="white"/></svg>`) }]).png().toBuffer(),
    shadow: await sharp(clean).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}"><rect x="0" y="0" width="${W/2}" height="${H}" fill="black" fill-opacity="0.6"/></svg>`) }]).png().toBuffer(),
    skewed: await sharp(textSvg(9)).png().toBuffer(),
  };
}
