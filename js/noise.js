/* ================================================================
   确定性噪声：hash + valueNoise + fbm（2D / 3D）
================================================================ */
export function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
export function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 144667981;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}
export function valueNoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz);
  const c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz);
  const e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1);
  const g = hash3(ix, iy + 1, iz + 1), h = hash3(ix + 1, iy + 1, iz + 1);
  return lerp(lerp(lerp(a, b, fx), lerp(c, d, fx), fy),
              lerp(lerp(e, f, fx), lerp(g, h, fx), fy), fz);
}
export function fbm(x, y, oct) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += valueNoise(x * freq, y * freq) * amp; norm += amp; amp *= 0.5; freq *= 2; }
  return sum / norm;
}
export function fbm3(x, y, z, oct) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += valueNoise3(x * freq, y * freq, z * freq) * amp; norm += amp; amp *= 0.5; freq *= 2; }
  return sum / norm;
}
