import fs from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const themes = {
  forest: { color: "#075f4c", light: "#1c9a7d", title: "FOREST", index: "01" },
  glacier: {
    color: "#123d67",
    light: "#27699a",
    title: "GLACIER",
    index: "02",
  },
};
function labelSvg(theme, poster = false) {
  const inner = `<defs><radialGradient id="face" cx="35%" cy="25%"><stop stop-color="${theme.light}"/><stop offset="1" stop-color="${theme.color}"/></radialGradient><linearGradient id="rim" x2="1" y2="1"><stop stop-color="#fff6fb"/><stop offset=".35" stop-color="#fbcfe8"/><stop offset=".7" stop-color="#c78eab"/><stop offset="1" stop-color="#f9dbeb"/></linearGradient></defs>
    <circle cx="512" cy="512" r="508" fill="url(#rim)"/><circle cx="512" cy="512" r="482" fill="url(#face)"/>
    <circle cx="512" cy="512" r="452" fill="none" stroke="#fbcfe8" stroke-width="1.5" opacity=".5"/>
    <text x="512" y="240" text-anchor="middle" fill="#fbcfe8" font-family="Arial" font-size="24" letter-spacing="8">OBJECTS IN MOTION</text>
    <text x="505" y="550" text-anchor="middle" fill="#fff9f4" font-family="Georgia" font-style="italic" font-weight="bold" font-size="250" letter-spacing="-18">nord.</text>
    <path d="M280 610 H744" stroke="#fbcfe8" stroke-width="1.2" opacity=".6"/>
    <text x="512" y="677" text-anchor="middle" fill="#fbcfe8" font-family="Arial" font-size="30" letter-spacing="12">${theme.title}</text>
    <text x="512" y="733" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="20" letter-spacing="5" opacity=".7">SNUS · PACKAGING STUDY</text>
    <text x="512" y="845" text-anchor="middle" fill="#fbcfe8" font-family="Arial" font-size="25" letter-spacing="5">№ ${theme.index} / DESIGN CONCEPT</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg>`;
}

const parts = [];
const bodyMaterial = 0,
  rimMaterial = 1,
  labelMaterial = 2,
  seamMaterial = 3;
function add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  geometry.rotateX(rotation[0]);
  geometry.rotateY(rotation[1]);
  geometry.rotateZ(rotation[2]);
  geometry.translate(...position);
  parts.push({ geometry: geometry.toNonIndexed(), material });
}
const profile = [
  [0, -0.17],
  [0.93, -0.17],
  [0.985, -0.15],
  [1, -0.115],
  [1, 0.08],
  [0.992, 0.105],
  [0.95, 0.125],
  [0, 0.125],
].map((p) => new THREE.Vector2(...p));
add(
  new THREE.LatheGeometry(profile, 128),
  bodyMaterial,
  [0, 0, 0],
  [Math.PI / 2, 0, 0],
);
add(
  new THREE.CylinderGeometry(1.025, 1.025, 0.065, 128),
  rimMaterial,
  [0, 0, 0.155],
  [Math.PI / 2, 0, 0],
);
const printedFace = new THREE.CircleGeometry(1.012, 128);
// glTF image coordinates start at the top, unlike Three's CircleGeometry UVs.
for (let i = 0; i < printedFace.attributes.uv.count; i++)
  printedFace.attributes.uv.setY(i, 1 - printedFace.attributes.uv.getY(i));
add(printedFace, labelMaterial, [0, 0, 0.19]);
add(new THREE.TorusGeometry(1.002, 0.011, 8, 128), rimMaterial, [0, 0, 0.196]);
add(new THREE.TorusGeometry(0.998, 0.008, 6, 128), seamMaterial, [0, 0, 0.105]);
// Fine moulded ridges along the lid's circumference.
for (let i = 0; i < 100; i++) {
  const a = (i * Math.PI * 2) / 100;
  add(
    new THREE.BoxGeometry(0.008, 0.014, 0.038),
    rimMaterial,
    [Math.cos(a) * 1.026, Math.sin(a) * 1.026, 0.155],
    [0, 0, a],
  );
}

function makeGlb(png, theme) {
  const buffers = [];
  let length = 0;
  const gltf = {
    asset: {
      version: "2.0",
      generator: "Nord original procedural packaging study",
    },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    buffers: [{ byteLength: 0 }],
    bufferViews: [],
    accessors: [],
    materials: [
      {
        name: "Shell",
        pbrMetallicRoughness: {
          baseColorFactor:
            theme.index === "01"
              ? [0.035, 0.17, 0.13, 1]
              : [0.028, 0.085, 0.16, 1],
          metallicFactor: 0.15,
          roughnessFactor: 0.32,
        },
      },
      {
        name: "Pink rim",
        pbrMetallicRoughness: {
          baseColorFactor: [0.96, 0.7, 0.82, 1],
          metallicFactor: 0.3,
          roughnessFactor: 0.25,
        },
      },
      {
        name: "Printed lid",
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0.1,
          roughnessFactor: 0.42,
        },
      },
      {
        name: "Seam",
        pbrMetallicRoughness: {
          baseColorFactor: [0.005, 0.018, 0.014, 1],
          metallicFactor: 0,
          roughnessFactor: 0.5,
        },
      },
    ],
    textures: [{ source: 0 }],
    images: [],
  };
  const append = (data, target) => {
    const buffer = Buffer.from(
      data.buffer ?? data,
      data.byteOffset ?? 0,
      data.byteLength ?? data.length,
    );
    const index = gltf.bufferViews.length;
    gltf.bufferViews.push({
      buffer: 0,
      byteOffset: length,
      byteLength: buffer.length,
      ...(target ? { target } : {}),
    });
    buffers.push(buffer);
    length += buffer.length;
    const pad = (4 - (length % 4)) % 4;
    if (pad) {
      buffers.push(Buffer.alloc(pad));
      length += pad;
    }
    return index;
  };
  for (const part of parts) {
    const attributes = {};
    for (const [key, attr] of Object.entries(part.geometry.attributes)) {
      if (!["position", "normal", "uv"].includes(key)) continue;
      const accessor = {
        bufferView: append(attr.array, 34962),
        componentType: 5126,
        count: attr.count,
        type: attr.itemSize === 2 ? "VEC2" : "VEC3",
      };
      if (key === "position") {
        part.geometry.computeBoundingBox();
        accessor.min = part.geometry.boundingBox.min.toArray();
        accessor.max = part.geometry.boundingBox.max.toArray();
      }
      attributes[
        { position: "POSITION", normal: "NORMAL", uv: "TEXCOORD_0" }[key]
      ] = gltf.accessors.length;
      gltf.accessors.push(accessor);
    }
    const mesh = gltf.meshes.length;
    gltf.meshes.push({ primitives: [{ attributes, material: part.material }] });
    gltf.scenes[0].nodes.push(gltf.nodes.length);
    gltf.nodes.push({ mesh });
  }
  gltf.images.push({ bufferView: append(png), mimeType: "image/png" });
  gltf.buffers[0].byteLength = length;
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const binary = Buffer.concat(buffers);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + binary.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(json.length);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(binary.length);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, json, bh, binary]);
}
for (const [name, theme] of Object.entries(themes)) {
  const svg = labelSvg(theme);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(path.join(root, "assets/textures", `${name}.png`), png);
  await fs.writeFile(path.join(root, "assets", `${name}.svg`), svg);
  await sharp(png)
    .resize(600)
    .webp({ quality: 90 })
    .toFile(path.join(root, "assets", `${name}.webp`));
  await fs.writeFile(
    path.join(root, "assets/models", `${name}.glb`),
    makeGlb(png, theme),
  );
}
console.log("Created original Forest / Glacier models, textures and posters.");
