import * as T from "three";

// Low-frequency noise is baked once, avoiding a raymarch or per-pixel noise every frame.
export function cloudLayer(scene: T.Scene) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const data = ctx.createImageData(512, 512);
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const fx = x - ix,
      fy = y - iy;
    const u = fx * fx * (3 - 2 * fx),
      v = fy * fy * (3 - 2 * fy);
    return T.MathUtils.lerp(
      T.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
      T.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u),
      v,
    );
  };
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      const u = x / 512,
        v = y / 512;
      const n =
        noise(u * 4, v * 9) * 0.6 +
        noise(u * 9, v * 18) * 0.28 +
        noise(u * 22, v * 35) * 0.12;
      const edge = Math.pow(Math.sin(u * Math.PI) * Math.sin(v * Math.PI), 0.7);
      const density = T.MathUtils.smoothstep(n, 0.47, 0.78) * edge;
      const i = (y * 512 + x) * 4;
      data.data[i] = 221 + n * 28;
      data.data[i + 1] = 220 + n * 25;
      data.data[i + 2] = 205 + n * 30;
      data.data[i + 3] = density * 190;
    }
  ctx.putImageData(data, 0, 0);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  const clouds = new T.Mesh(
    new T.PlaneGeometry(150, 100),
    new T.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
      side: T.DoubleSide,
      fog: false,
    }),
  );
  clouds.rotation.x = -Math.PI / 2;
  clouds.position.set(-12, 28, -30);
  scene.add(clouds);
  return clouds;
}
