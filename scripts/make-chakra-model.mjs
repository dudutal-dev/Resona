/**
 * Writes `public/models/chakra_model.glb`.
 *
 *   node scripts/make-chakra-model.mjs
 *
 * The 3D scene wants a rigged, animated GLB, and there wasn't one — so rather
 * than ship a component that loads a file that does not exist, the file is
 * generated here. glTF is JSON plus one binary blob, and GLB is those two
 * concatenated behind a twelve byte header, so a model of this shape is a
 * reasonable thing to write by hand: no exporter, no download, no dependency,
 * and the geometry is described by the same code that explains it.
 *
 * What it contains: a column of light with seven chakra spheres up it, each with
 * its own emissive colour, inside a large aura sphere. One animation clip, `idle`,
 * scales the body and the aura against each other on a four second loop, which is
 * the breathing `useAnimations` plays. Everything is one sphere mesh and one
 * cylinder mesh reused by node transforms, so the whole file is a few kilobytes.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../public/models/chakra_model.glb')

/** Root, sacral, solar plexus, heart, throat, brow, crown — bottom to top. */
const CHAKRAS = [
  { name: 'muladhara', y: -1.25, colour: [0.9, 0.11, 0.14] },
  { name: 'svadhisthana', y: -0.83, colour: [0.95, 0.42, 0.05] },
  { name: 'manipura', y: -0.42, colour: [0.98, 0.82, 0.09] },
  { name: 'anahata', y: 0, colour: [0.16, 0.85, 0.35] },
  { name: 'vishuddha', y: 0.42, colour: [0.15, 0.6, 0.95] },
  { name: 'ajna', y: 0.83, colour: [0.29, 0.24, 0.86] },
  { name: 'sahasrara', y: 1.25, colour: [0.65, 0.3, 0.95] },
]

// ------------------------------------------------------------------ geometry
/** A UV sphere of radius 1, centred on the origin. */
function sphere(segments = 32, rings = 24) {
  const position = []
  const normal = []
  const index = []
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2
      const x = Math.sin(phi) * Math.cos(theta)
      const y = Math.cos(phi)
      const z = Math.sin(phi) * Math.sin(theta)
      position.push(x, y, z)
      normal.push(x, y, z)
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s
      const b = a + segments + 1
      index.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  return { position, normal, index }
}

/** An open tube of radius 1 and height 1, centred on the origin. */
function column(segments = 24) {
  const position = []
  const normal = []
  const index = []
  for (let s = 0; s <= segments; s++) {
    const theta = (s / segments) * Math.PI * 2
    const x = Math.cos(theta)
    const z = Math.sin(theta)
    position.push(x, -0.5, z, x, 0.5, z)
    normal.push(x, 0, z, x, 0, z)
  }
  for (let s = 0; s < segments; s++) {
    const a = s * 2
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  return { position, normal, index }
}

// --------------------------------------------------------------- glTF buffer
const chunks = []
let offset = 0
const bufferViews = []
const accessors = []

function pad4(length) {
  return (4 - (length % 4)) % 4
}

/** Appends typed data to the binary blob and returns its accessor index. */
function push(values, { type, componentType, target }) {
  const isIndex = componentType === 5123
  const array = isIndex ? new Uint16Array(values) : new Float32Array(values)
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
  const padding = pad4(bytes.length)
  chunks.push(bytes, Buffer.alloc(padding))
  bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target ? { target } : {}) })
  offset += bytes.length + padding

  const stride = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type]
  const count = values.length / stride
  const accessor = {
    bufferView: bufferViews.length - 1,
    componentType,
    count,
    type,
  }
  // POSITION is the one accessor the spec requires bounds on, and loaders use
  // them for frustum culling, so give them to everything float and vector.
  if (type === 'VEC3' || type === 'SCALAR') {
    const min = new Array(stride).fill(Infinity)
    const max = new Array(stride).fill(-Infinity)
    for (let i = 0; i < values.length; i++) {
      const slot = i % stride
      if (values[i] < min[slot]) min[slot] = values[i]
      if (values[i] > max[slot]) max[slot] = values[i]
    }
    accessor.min = min
    accessor.max = max
  }
  accessors.push(accessor)
  return accessors.length - 1
}

const FLOAT = 5126
const USHORT = 5123
const ARRAY_BUFFER = 34962
const ELEMENT_ARRAY_BUFFER = 34963

const sphereGeometry = sphere()
const columnGeometry = column()

/**
 * Vertex data is uploaded once per shape and shared by every mesh that uses it.
 * Nine meshes each carrying their own copy of the same sphere came to 237KB;
 * pointing them all at one set of accessors and letting the node transforms and
 * materials do the differing brings the file to a tenth of that. Reusing
 * accessors across primitives is exactly what glTF indexes them for.
 */
function upload(geometry) {
  return {
    POSITION: push(geometry.position, { type: 'VEC3', componentType: FLOAT, target: ARRAY_BUFFER }),
    NORMAL: push(geometry.normal, { type: 'VEC3', componentType: FLOAT, target: ARRAY_BUFFER }),
    indices: push(geometry.index, {
      type: 'SCALAR',
      componentType: USHORT,
      target: ELEMENT_ARRAY_BUFFER,
    }),
  }
}

const meshes = []
function addMesh(name, uploaded, material) {
  const { indices, ...attributes } = uploaded
  meshes.push({ name, primitives: [{ attributes, indices, material }] })
  return meshes.length - 1
}

// ------------------------------------------------------------- materials
const materials = [
  {
    name: 'aura',
    pbrMetallicRoughness: { baseColorFactor: [0.4, 0.6, 1, 0.08], metallicFactor: 0, roughnessFactor: 1 },
    emissiveFactor: [0.15, 0.25, 0.5],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  {
    name: 'column',
    pbrMetallicRoughness: { baseColorFactor: [0.8, 0.9, 1, 0.35], metallicFactor: 0, roughnessFactor: 0.4 },
    emissiveFactor: [0.5, 0.7, 1],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  ...CHAKRAS.map((c) => ({
    name: c.name,
    pbrMetallicRoughness: {
      baseColorFactor: [...c.colour, 1],
      metallicFactor: 0,
      roughnessFactor: 0.25,
    },
    emissiveFactor: c.colour,
  })),
]

const sphereData = upload(sphereGeometry)
const columnData = upload(columnGeometry)
const auraMesh = addMesh('aura', sphereData, 0)
const columnMesh = addMesh('column', columnData, 1)
const chakraMeshes = CHAKRAS.map((c, i) => addMesh(c.name, sphereData, 2 + i))

// ----------------------------------------------------------------- nodes
const nodes = []
const bodyChildren = []
for (let i = 0; i < CHAKRAS.length; i++) {
  const c = CHAKRAS[i]
  // The crown and the root read as the ends of the column, so they are a little
  // larger; the rest taper toward the middle.
  const radius = 0.16 + Math.abs(c.y) * 0.03
  nodes.push({
    name: `chakra_${c.name}`,
    mesh: chakraMeshes[i],
    translation: [0, c.y, 0],
    scale: [radius, radius, radius],
  })
  bodyChildren.push(nodes.length - 1)
}
nodes.push({ name: 'column', mesh: columnMesh, scale: [0.035, 2.9, 0.035] })
bodyChildren.push(nodes.length - 1)

const bodyNode = nodes.length
nodes.push({ name: 'body', children: bodyChildren, scale: [1, 1, 1] })

const auraNode = nodes.length
nodes.push({ name: 'aura', mesh: auraMesh, scale: [1.6, 2.1, 1.6] })

const rootNode = nodes.length
nodes.push({ name: 'chakra_root', children: [bodyNode, auraNode] })

// ------------------------------------------------------------- animation
/**
 * `idle`: four seconds, looping. The body swells and settles while the aura
 * expands against it slightly out of phase, which reads as breath rather than as
 * a pulse. Keyframes are LINEAR at eight per cycle — the shape is a sine and this
 * many samples of it is smooth at any playback rate a loader will use.
 */
const FRAMES = 8
const DURATION = 4
const times = []
const bodyScales = []
const auraScales = []
for (let i = 0; i <= FRAMES; i++) {
  const t = (i / FRAMES) * DURATION
  const phase = (i / FRAMES) * Math.PI * 2
  times.push(t)
  const breath = 1 + Math.sin(phase) * 0.035
  bodyScales.push(breath, 1 + Math.sin(phase) * 0.02, breath)
  const swell = 1 + Math.sin(phase - Math.PI / 3) * 0.06
  auraScales.push(1.6 * swell, 2.1 * swell, 1.6 * swell)
}

const timeAccessor = push(times, { type: 'SCALAR', componentType: FLOAT })
const bodyAccessor = push(bodyScales, { type: 'VEC3', componentType: FLOAT })
const auraAccessor = push(auraScales, { type: 'VEC3', componentType: FLOAT })

const animations = [
  {
    name: 'idle',
    samplers: [
      { input: timeAccessor, output: bodyAccessor, interpolation: 'LINEAR' },
      { input: timeAccessor, output: auraAccessor, interpolation: 'LINEAR' },
    ],
    channels: [
      { sampler: 0, target: { node: bodyNode, path: 'scale' } },
      { sampler: 1, target: { node: auraNode, path: 'scale' } },
    ],
  },
]

// -------------------------------------------------------------- assembly
const binary = Buffer.concat(chunks)
const gltf = {
  asset: { version: '2.0', generator: 'scripts/make-chakra-model.mjs' },
  scene: 0,
  scenes: [{ nodes: [rootNode] }],
  nodes,
  meshes,
  materials,
  animations,
  accessors,
  bufferViews,
  buffers: [{ byteLength: binary.length }],
}

const json = Buffer.from(JSON.stringify(gltf), 'utf8')
const jsonPadded = Buffer.concat([json, Buffer.alloc(pad4(json.length), 0x20)])
const binPadded = Buffer.concat([binary, Buffer.alloc(pad4(binary.length))])

const header = Buffer.alloc(12)
header.write('glTF', 0, 'ascii')
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8)

const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(jsonPadded.length, 0)
jsonHeader.writeUInt32LE(0x4e4f534a, 4)

const binHeader = Buffer.alloc(8)
binHeader.writeUInt32LE(binPadded.length, 0)
binHeader.writeUInt32LE(0x004e4942, 4)

const glb = Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded])
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, glb)

console.log(
  `chakra_model.glb: ${nodes.length} nodes, ${meshes.length} meshes, ` +
    `${materials.length} materials, ${animations.length} clip (${DURATION}s) — ` +
    `${(glb.length / 1024).toFixed(1)}KB`,
)
