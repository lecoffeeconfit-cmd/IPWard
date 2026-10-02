const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (distance, radius = 1.4) => clamp(0.5 - distance / radius);

function roundedRect(x, y, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(x - cx) - halfW + radius;
  const qy = Math.abs(y - cy) - halfH + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}
function ellipseStroke(x, y, cx, cy, a, b, angle, width) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const dx = x - cx, dy = y - cy;
  const xr = c * dx + s * dy, yr = -s * dx + c * dy;
  return smooth(Math.abs(Math.hypot(xr / a, yr / b) - 1) * b - width / 2);
}
function segment(x, y, x1, y1, x2, y2, width) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy));
  return smooth(Math.hypot(x - x1 - t * dx, y - y1 - t * dy) - width / 2);
}
function overlay(pixel, color, amount) {
  const a = clamp(amount);
  pixel[0] = mix(pixel[0], color[0], a);
  pixel[1] = mix(pixel[1], color[1], a);
  pixel[2] = mix(pixel[2], color[2], a);
}

function render(size) {
  const png = new PNG({ width: size, height: size });
  const blue = [151, 185, 255], cyan = [136, 227, 216];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) / size * 1024, y = (py + 0.5) / size * 1024;
      const dx = x - 512, dy = y - 512, distance = Math.hypot(dx, dy);
      const glow = clamp(1 - distance / 700);
      const p = [mix(9, 23, glow), mix(13, 37, glow), mix(23, 63, glow)];
      overlay(p, blue, clamp(1 - distance / 450) * 0.08);
      const ring = smooth(Math.abs(distance - 358) - 0.8);
      overlay(p, blue, ring * 0.22);
      overlay(p, blue, ellipseStroke(x, y, 512, 512, 320, 177, -0.57, 1.8) * 0.40);
      overlay(p, cyan, ellipseStroke(x, y, 512, 512, 320, 177, 0.64, 1.8) * 0.30);
      overlay(p, blue, ellipseStroke(x, y, 512, 512, 318, 183, 1.57, 1.2) * 0.16);
      const dots = [[226, 372, blue], [796, 454, cyan], [641, 765, blue], [270, 670, cyan], [710, 265, cyan]];
      for (const [sx, sy, color] of dots) {
        const d = Math.hypot(x - sx, y - sy);
        overlay(p, color, clamp(1 - d / 32) * 0.12);
        overlay(p, color, smooth(d - 5.5) * 0.95);
      }
      const core = roundedRect(x, y, 512, 512, 170, 200, 75);
      overlay(p, [23, 38, 64], smooth(core) * 0.98);
      overlay(p, blue, smooth(Math.abs(core) - 1.6) * 0.35);
      const phone = roundedRect(x, y, 512, 512, 91, 141, 25);
      overlay(p, blue, smooth(Math.abs(phone) - 3.8) * 0.95);
      overlay(p, [18, 33, 57], smooth(phone) * 0.90);
      overlay(p, blue, segment(x, y, 490, 397, 534, 397, 5.5) * 0.8);
      overlay(p, blue, segment(x, y, 490, 627, 534, 627, 5.5) * 0.65);
      const pulse = [[456, 520], [486, 520], [499, 487], [517, 546], [531, 508], [560, 508]];
      let stroke = 0;
      for (let i = 0; i < pulse.length - 1; i++) stroke = Math.max(stroke, segment(x, y, ...pulse[i], ...pulse[i + 1], 8));
      overlay(p, cyan, stroke * 0.98);
      const offset = (py * size + px) * 4;
      png.data[offset] = Math.round(p[0]);
      png.data[offset + 1] = Math.round(p[1]);
      png.data[offset + 2] = Math.round(p[2]);
      png.data[offset + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

fs.writeFileSync(path.join(root, 'assets', 'icon.png'), render(1024));
fs.writeFileSync(path.join(root, 'assets', 'favicon.png'), render(128));
