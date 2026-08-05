import * as THREE from "./vendor/three/three.module.min.js";

const canvas = document.getElementById("plannerMachineCanvas");
const foregroundCanvas = document.getElementById("plannerMachineForegroundCanvas");
const viewport = document.getElementById("plannerMachineViewport");

// Product Design QA needs lossless, same-viewport evidence from this exact
// renderer. The normal scene intentionally keeps gears and sparks alive, but
// that continuous GPU work can starve browser capture on a 1,500+ mesh frame.
// An explicit audit URL freezes one deterministic mechanical instant after a
// full-quality render. Ordinary visitors never enter this branch.
const auditParameters = new URLSearchParams(window.location.search);
const auditFrameEnabled = auditParameters.get("timetableAuditFrame") === "1";
const parsedAuditTime = Number(auditParameters.get("timetableAuditTime"));
let auditFrameTime = auditFrameEnabled
  && auditParameters.has("timetableAuditTime")
  && Number.isFinite(parsedAuditTime)
  ? Math.max(0, parsedAuditTime)
  : 0;
const parsedAuditResultBlend = Number(auditParameters.get("timetableAuditResultBlend"));
let auditResultBlend = auditFrameEnabled
  && auditParameters.has("timetableAuditResultBlend")
  && Number.isFinite(parsedAuditResultBlend)
  ? Math.min(1, Math.max(0, parsedAuditResultBlend))
  : null;

const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const smoothstep = (edge0, edge1, value) => {
  const normalized = clamp((value - edge0) / Math.max(.0001, edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
};
const windowedPhase = (value, enterStart, enterEnd, leaveStart, leaveEnd) => (
  smoothstep(enterStart, enterEnd, value) * (1 - smoothstep(leaveStart, leaveEnd, value))
);

let renderer = null;
let scene = null;
let foregroundRenderer = null;
let foregroundScene = null;
let camera = null;
let cameraPath = null;
let currentProgress = 0;
let isActive = false;
let isDisposed = false;
let isContextLost = false;
let isForegroundContextLost = false;
let renderFrame = 0;
let renderDelayTimer = 0;
let programWarmupRequest = 0;
let programWarmupRequestType = "";
let programWarmupGeneration = 0;
let programWarmupComplete = false;
let lastAnimationTimestamp = 0;
let settledRenderDeadline = 0;
let settledRenderRate = 0;
let machineRunTime = auditFrameTime;
let sparkRunTime = auditFrameTime;
let viewportWidth = 1;
let viewportHeight = 1;
let projectionDirty = true;
let lastRequestedProgress = Number.NaN;
let courseCarrier = null;
let meetingCarrier = null;
let priorityCarrier = null;
let courseHinge = null;
let courseExtract = null;
let courseLatch = null;
let meetingHinge = null;
let meetingExtract = null;
let priorityHinge = null;
let priorityExtract = null;
let priorityLock = null;
let resultCarrier = null;
let resultLift = null;
const resultLeadScrews = [];
let resultSparkDriverGear = null;
let resultSparkDrivenGear = null;
let resultModeTarget = 0;
let resultModeBlend = 0;
let gearDrive = null;
let secondaryGear = null;
let sparkPoints = null;
let sparkMaterial = null;
let sparkLight = null;
let sparkTrails = null;
let sparkTrailMaterial = null;
let sparkSeeds = [];
let sparkDriverGear = null;
let sparkDrivenGear = null;
let frontKey = null;
let frontFill = null;
let frontEdge = null;
let exteriorLeftRim = null;
let exteriorRightRim = null;
let thresholdLight = null;
let ambientLight = null;
let plenumLight = null;
let plenumRimLight = null;
let plenumEntryLight = null;
let plenumContinuationLight = null;
let ductFillLight = null;
let ductWallLight = null;
let ductExitLight = null;
let cameraInspectionLight = null;
let terminalKeyLight = null;
let terminalFillLight = null;
let terminalRimLight = null;
let terminalLowerFillLight = null;
let terminalLeftServiceLight = null;
let terminalLeftSoftbox = null;
let terminalRightSoftbox = null;
let terminalTopSoftbox = null;
let terminalLeftPortalLight = null;
let terminalRightPortalLight = null;
let terminalTopPortalLight = null;
let terminalBottomPortalLight = null;
let terminalFrontWash = null;
let studioEnvironment = null;
const continuousGearTrains = [];
const panelSpillLights = new Map();
const routePhaseLights = [];
const foregroundCarrierOverlays = [];
const foregroundTerminalLights = [];

const DEVICE = Object.freeze({
  groupZ: 8.7,
  projectionWidth: 16,
  projectionHeight: 16 / 1.5,
  projectionCenterY: (.7525 - .5) * (16 / 1.5),
  faceZ: 3,
  outerWidth: 13,
  outerHeight: 7.58,
  outerCenterY: 2.95,
  screenWidth: 11.664,
  screenHeight: 5.797,
  screenCenterY: 3.2,
  ventWidth: 11.92,
  ventHeight: .56,
  ventDepth: .44,
  ventHoleRadius: .048,
  ventColumnPitch: .188,
  ventRowPitch: .178
});

// The competition hero frame keeps the full FAN-T111 at roughly 85% of a
// landscape viewport. The presentation offset aligns the optical axis with the
// complete chassis silhouette (including its feet), leaving balanced black air
// above and below at 16:9. This offset releases before the descent, so the
// selected vent and every later station retain their authored coaxial path.
const EXTERIOR_PRESENTATION = Object.freeze({
  baseFov: 45.8,
  verticalCameraOffset: .13,
  releaseStart: .04,
  releaseEnd: .18
});

// The generated timetable is a fourth, full-width physical display. It lives
// on a lift in front of the three editing carriers, so the old trays can close
// into their bays before this larger screen crosses the terminal opening.
// These datums deliberately leave the result carrier behind the camera but in
// front of the foremost portal hardware; see createResultTerminalLift().
const RESULT_TERMINAL = Object.freeze({
  width: 10.9,
  height: 7.2,
  worldZ: -24.56,
  stowedY: -9.3,
  dockedY: -.08,
  guideX: 5.82,
  screwX: 6.13,
  guideCenterY: -3.9,
  guideHeight: 18.3,
  screwLead: .22,
  screwRootRadius: .058,
  screwOuterRadius: .074
});

// Industrial connector banks arrive in serviceable clusters rather than a
// perfectly even decorative grid. The same physical layout is reused by the
// front ferrules and the rear manifold plumbing so every visible port belongs
// to a causal mechanical chain.
const TERMINAL_CONNECTOR_CLUSTERS = Object.freeze({
  left: Object.freeze([
    Object.freeze([-2.82, -2.42, -2.08]),
    Object.freeze([-.74, -.26]),
    Object.freeze([1.54, 1.92, 2.28])
  ]),
  right: Object.freeze([
    Object.freeze([-2.72, -2.34, -1.98]),
    Object.freeze([.02, .5]),
    Object.freeze([1.78, 2.16, 2.52])
  ])
});

const anchors = new Map();
const geometryCache = new Map();
const disposableMaterials = new Set();
const worldPosition = new THREE.Vector3();
const projectedPosition = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const sparkHotColor = new THREE.Color(0xfff3d2);
const sparkCoolColor = new THREE.Color(0xc56d17);
const sparkColorScratch = new THREE.Color();
const sparkDriverCenter = new THREE.Vector3();
const sparkDrivenCenter = new THREE.Vector3();
const sparkContactPoint = new THREE.Vector3();
const entranceCenter = new THREE.Vector3(
  0,
  DEVICE.projectionCenterY,
  DEVICE.groupZ + DEVICE.faceZ + .01
);
const entranceCorners = [
  new THREE.Vector3(-DEVICE.projectionWidth * .5, entranceCenter.y + DEVICE.projectionHeight * .5, entranceCenter.z),
  new THREE.Vector3(DEVICE.projectionWidth * .5, entranceCenter.y + DEVICE.projectionHeight * .5, entranceCenter.z),
  new THREE.Vector3(DEVICE.projectionWidth * .5, entranceCenter.y - DEVICE.projectionHeight * .5, entranceCenter.z),
  new THREE.Vector3(-DEVICE.projectionWidth * .5, entranceCenter.y - DEVICE.projectionHeight * .5, entranceCenter.z)
];
const entranceProjectedCorners = entranceCorners.map(() => new THREE.Vector3());
const entranceDelta = new THREE.Vector3();
const surfaceEdgeA = new THREE.Vector3();
const surfaceEdgeB = new THREE.Vector3();
const surfaceNormal = new THREE.Vector3();
const surfaceToCamera = new THREE.Vector3();

// The palette stays deliberately neutral. Warm work lights are the only chromatic
// note; there are no blue emitters hidden in the dark values.
const graphite = material({ color: 0x1a1a19, roughness: .5, metalness: .84 });
const deepGraphite = material({ color: 0x0b0b0a, roughness: .62, metalness: .72 });
const machinedMetal = material({ color: 0x3c3c3a, roughness: .26, metalness: .95 });
const edgeMetal = material({ color: 0x5a5956, roughness: .21, metalness: .96 });
// Entrance-only finishes keep the outer appliance legible without lifting the
// black level of the interior machinery that reuses graphite and edgeMetal.
const exteriorShell = material({ color: 0x24221f, roughness: .43, metalness: .82 });
const exteriorTrim = material({ color: 0x6b655c, roughness: .3, metalness: .96 });
const brushedAluminum = material({ color: 0x817a6e, roughness: .29, metalness: .98 });
const agedGunmetal = material({ color: 0x292928, roughness: .57, metalness: .88 });
const darkPolymer = material({ color: 0x0b0b0a, roughness: .82, metalness: .16 });
const cableMaterial = material({ color: 0x060605, roughness: .94, metalness: .06 });
const braidedCable = material({ color: 0x11100e, roughness: .78, metalness: .2 });
const pcbSubstrate = material({ color: 0x1a1914, roughness: .72, metalness: .25 });
const copperContact = material({ color: 0x72502d, roughness: .42, metalness: .88 });
const blackOxideSteel = material({ color: 0x20201f, roughness: .46, metalness: .88 });
// Nickel is reserved for fastener heads, ferrules and short witness edges.
// A tighter lobe lifts only those sub-centimetre details into the softbox
// reflection, closing the reference render's local P95 gap without raising the
// exposure or turning broad graphite panels silver.
const nickelSteel = material({ color: 0x595956, roughness: .31, metalness: .96 });
const phosphorBronze = material({ color: 0x665039, roughness: .5, metalness: .88 });
const turnedSteel = physicalMaterial({
  color: 0x64635f,
  roughness: .24,
  metalness: 1,
  anisotropy: .68,
  anisotropyRotation: Math.PI * .5,
  clearcoat: .1,
  clearcoatRoughness: .32
});
const milledBlackSteel = physicalMaterial({
  color: 0x191918,
  roughness: .43,
  metalness: .96,
  anisotropy: .18,
  clearcoat: .08,
  clearcoatRoughness: .46
});
const serviceFrameSteel = physicalMaterial({
  color: 0x343330,
  roughness: .53,
  metalness: .94,
  clearcoat: .06,
  clearcoatRoughness: .68
});
const greasedBronze = physicalMaterial({
  color: 0x58432f,
  roughness: .46,
  metalness: .9,
  anisotropy: .28,
  clearcoat: .16,
  clearcoatRoughness: .42
});
const gasketRubber = material({ color: 0x070706, roughness: .96, metalness: .02 });
const ventWallMetal = material({
  color: 0x090908,
  roughness: .86,
  metalness: .58,
  side: THREE.DoubleSide
});
const plenumDuctSurface = material({
  color: 0x0d0e0d,
  roughness: .7,
  metalness: .88,
  emissive: 0x030302,
  emissiveIntensity: .008,
  envMapIntensity: .19,
  vertexColors: true,
  dithering: true,
  side: THREE.DoubleSide
});
const entranceDuctSurface = material({
  color: 0x141513,
  roughness: .68,
  metalness: .87,
  emissive: 0x030201,
  emissiveIntensity: .008,
  envMapIntensity: .22,
  vertexColors: true,
  dithering: true,
  side: THREE.DoubleSide
});
// Retaining hardware stays in the same dark value family as the liner. Narrow
// differences in roughness, rather than bright silver rings, separate each
// serviceable joint when the maintenance grazers pass across it.
const ductHoopMetal = physicalMaterial({
  color: 0x242523,
  roughness: .54,
  metalness: .96,
  envMapIntensity: .22,
  clearcoat: .04,
  clearcoatRoughness: .7
});
const ductHoopWear = physicalMaterial({
  color: 0x30312e,
  roughness: .47,
  metalness: .97,
  envMapIntensity: .25,
  clearcoat: .05,
  clearcoatRoughness: .64
});
const ductSeamMetal = material({
  color: 0x1c1d1b,
  roughness: .61,
  metalness: .93,
  envMapIntensity: .18
});
const matteCeramic = material({ color: 0xaaa292, roughness: .68, metalness: .08 });
const grimeSurface = material({
  color: 0x17130d,
  roughness: .92,
  metalness: .08,
  transparent: true,
  opacity: .32,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1
});
const oilFilm = physicalMaterial({
  color: 0x15120c,
  roughness: .22,
  metalness: .45,
  transparent: true,
  opacity: .42,
  depthWrite: false,
  clearcoat: .82,
  clearcoatRoughness: .18
});
const wornEdge = material({
  color: 0x827b6f,
  roughness: .68,
  metalness: .75,
  transparent: true,
  opacity: .28,
  depthWrite: false
});
const smokedGlass = physicalMaterial({
  color: 0x292722,
  roughness: .34,
  metalness: .18,
  transmission: .03,
  transparent: true,
  opacity: .74,
  thickness: .3,
  clearcoat: .4,
  clearcoatRoughness: .3
});
const screenBacking = physicalMaterial({
  color: 0x10100f,
  // The live DOM display sits in front of this physical backing on the entry
  // frame. Once the camera drops toward the grille the backing must read as a
  // dead LCD cavity, not as a polished plate that can produce a white hot-spot.
  roughness: .76,
  metalness: .08,
  clearcoat: .08,
  clearcoatRoughness: .72
});
const inspectionGlass = physicalMaterial({
  color: 0x211f1a,
  roughness: .18,
  metalness: .08,
  transmission: .08,
  transparent: true,
  opacity: .24,
  thickness: .18,
  clearcoat: .9,
  clearcoatRoughness: .12,
  depthWrite: false
});
const whiteDiagnostic = material({
  color: 0x8f8b82,
  roughness: .32,
  metalness: .35,
  emissive: 0xd6cdbb,
  emissiveIntensity: .002
});
const amberDiagnostic = material({
  color: 0x9a5f17,
  roughness: .3,
  metalness: .42,
  emissive: 0xd47e17,
  emissiveIntensity: .85
});
const serviceLampLens = physicalMaterial({
  color: 0xcbbda6,
  roughness: .22,
  metalness: .06,
  emissive: 0xffddb0,
  emissiveIntensity: 1.65,
  clearcoat: .72,
  clearcoatRoughness: .18
});

// Reference-grade metals need more than a constant roughness scalar. This
// shared shader adds a small, continuous object-space machining field to the
// existing PBR response: no image texture, no repeating UV tile, and one
// cached program shared by every treated material. The amplitude stays below
// the silhouette threshold; it changes reflected light, not part geometry.
function applyProceduralMicroSurface(surface, {
  scale = 110,
  normalStrength = .014,
  roughnessVariation = .035,
  direction = [1, .17, .04]
} = {}) {
  surface.userData.microSurface = {
    scale,
    normalStrength,
    roughnessVariation,
    direction: new THREE.Vector3(...direction).normalize()
  };
  surface.onBeforeCompile = (shader) => {
    const settings = surface.userData.microSurface;
    shader.uniforms.uConcourseMicroScale = { value: settings.scale };
    shader.uniforms.uConcourseMicroNormal = { value: settings.normalStrength };
    shader.uniforms.uConcourseMicroRoughness = { value: settings.roughnessVariation };
    shader.uniforms.uConcourseMicroDirection = { value: settings.direction };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vConcourseObjectPosition;"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvConcourseObjectPosition = transformed;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vConcourseObjectPosition;
uniform float uConcourseMicroScale;
uniform float uConcourseMicroNormal;
uniform float uConcourseMicroRoughness;
uniform vec3 uConcourseMicroDirection;

float concourseFilterAttenuation(float phase) {
  float footprint = fwidth(phase);
  return 1.0 - smoothstep(0.75, 3.14159265, footprint);
}

void concourseMachiningSamples(
  vec3 point,
  vec3 direction,
  out vec3 rawSamples,
  out vec3 filteredSamples,
  out vec3 attenuation
) {
  vec3 p = point * uConcourseMicroScale;
  float directionalPhase = dot(p, direction * vec3(1.0, 1.31, 1.73));
  float crossCutPhase = dot(p, vec3(-direction.y, direction.x, direction.z + 0.37)) * 0.43 + 1.7;
  // Fine machining follows the unfiltered cut. Feeding an fwidth-filtered
  // value back into another fwidth calculation creates undefined second-order
  // screen derivatives on several WebGL drivers.
  float rawDirectional = sin(directionalPhase);
  float fineCutPhase = dot(p, vec3(0.37, 0.79, -0.53)) * 1.91 + rawDirectional * 0.24;
  rawSamples = vec3(rawDirectional, sin(crossCutPhase), sin(fineCutPhase));
  attenuation = vec3(
    concourseFilterAttenuation(directionalPhase),
    concourseFilterAttenuation(crossCutPhase),
    concourseFilterAttenuation(fineCutPhase)
  );
  filteredSamples = rawSamples * attenuation;
}

vec3 concoursePerturbNormalArb(
  vec3 surfacePosition,
  vec3 surfaceNormal,
  vec2 heightDerivative,
  float faceDirection
) {
  // Preserve derivative magnitude. Normalizing these vectors makes the bump
  // response change with camera distance and device pixel ratio.
  vec3 sigmaX = dFdx(surfacePosition);
  vec3 sigmaY = dFdy(surfacePosition);
  vec3 r1 = cross(sigmaY, surfaceNormal);
  vec3 r2 = cross(surfaceNormal, sigmaX);
  float determinant = dot(sigmaX, r1) * faceDirection;
  vec3 gradient = sign(determinant)
    * (heightDerivative.x * r1 + heightDerivative.y * r2);
  return normalize(abs(determinant) * surfaceNormal - gradient);
}`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
vec3 concourseMicroRawSamples;
vec3 concourseMicroFilteredSamples;
vec3 concourseMicroAttenuation;
concourseMachiningSamples(
  vConcourseObjectPosition,
  uConcourseMicroDirection,
  concourseMicroRawSamples,
  concourseMicroFilteredSamples,
  concourseMicroAttenuation
);
vec3 concourseMicroWeights = vec3(0.48, 0.31, 0.21);
float concourseMicroField = dot(concourseMicroFilteredSamples, concourseMicroWeights);
roughnessFactor = clamp(roughnessFactor + concourseMicroField * uConcourseMicroRoughness, 0.055, 1.0);`
      );
    if (settings.normalStrength > 0) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
vec2 concourseMicroSlope = vec2(
  dot(dFdx(concourseMicroRawSamples) * concourseMicroAttenuation, concourseMicroWeights),
  dot(dFdy(concourseMicroRawSamples) * concourseMicroAttenuation, concourseMicroWeights)
) * uConcourseMicroNormal;
normal = concoursePerturbNormalArb(
  -vViewPosition,
  normal,
  concourseMicroSlope,
  faceDirection
);`
      );
    }
  };
  surface.customProgramCacheKey = () => (
    `concourse-procedural-micro-surface-v3-${surface.userData.microSurface.normalStrength > 0 ? "normal" : "roughness"}`
  );
  surface.needsUpdate = true;
  return surface;
}

[
  [turnedSteel, { scale: 178, normalStrength: .009, roughnessVariation: .028, direction: [0, 1, .08] }],
  [milledBlackSteel, { scale: 92, normalStrength: .012, roughnessVariation: .045, direction: [1, .12, .04] }],
  [serviceFrameSteel, { scale: 66, normalStrength: .013, roughnessVariation: .052, direction: [.8, .23, .11] }],
  [greasedBronze, { scale: 124, normalStrength: .01, roughnessVariation: .038, direction: [.2, 1, .06] }],
  [exteriorShell, { scale: 54, normalStrength: 0, roughnessVariation: .028, direction: [1, .08, .03] }],
  [blackOxideSteel, { scale: 118, normalStrength: 0, roughnessVariation: .036, direction: [.9, .31, .07] }],
  [nickelSteel, { scale: 190, normalStrength: 0, roughnessVariation: .02, direction: [.15, 1, .06] }],
  [brushedAluminum, { scale: 164, normalStrength: 0, roughnessVariation: .026, direction: [1, .04, .02] }]
].forEach(([surface, settings]) => applyProceduralMicroSurface(surface, settings));

function material(options) {
  const instance = new THREE.MeshStandardMaterial(options);
  disposableMaterials.add(instance);
  return instance;
}

function physicalMaterial(options) {
  const instance = new THREE.MeshPhysicalMaterial(options);
  disposableMaterials.add(instance);
  return instance;
}

function createProceduralStudioEnvironment() {
  // Metals need a reflected room to read as metal. This tiny six-face studio
  // probe is generated in memory from six unique softbox gradients: it is not
  // a repeated surface texture, image asset or patterned material map.
  const faceDefinitions = [
    { axis: "x", base: "#090908", band: "#58554f", position: .28, width: .12 },
    { axis: "x", base: "#070706", band: "#3f3d38", position: .72, width: .16 },
    { axis: "y", base: "#11100f", band: "#77736c", position: .44, width: .22 },
    { axis: "y", base: "#050504", band: "#24221f", position: .68, width: .18 },
    { axis: "x", base: "#080807", band: "#494640", position: .52, width: .1 },
    { axis: "y", base: "#060605", band: "#302e2a", position: .34, width: .14 }
  ];
  const faces = faceDefinitions.map((definition, faceIndex) => {
    const face = document.createElement("canvas");
    face.width = face.height = 256;
    const context = face.getContext("2d");
    const gradient = definition.axis === "x"
      ? context.createLinearGradient(0, 0, face.width, 0)
      : context.createLinearGradient(0, 0, 0, face.height);
    const edge0 = clamp(definition.position - definition.width, 0, 1);
    const edge1 = clamp(definition.position + definition.width, 0, 1);
    gradient.addColorStop(0, definition.base);
    gradient.addColorStop(edge0, definition.base);
    gradient.addColorStop(definition.position, definition.band);
    gradient.addColorStop(edge1, definition.base);
    gradient.addColorStop(1, definition.base);
    context.fillStyle = gradient;
    context.fillRect(0, 0, face.width, face.height);
    const falloff = context.createRadialGradient(
      face.width * (.35 + faceIndex * .047),
      face.height * (.42 + (faceIndex % 2) * .12),
      2,
      face.width * .5,
      face.height * .5,
      face.width * .72
    );
    falloff.addColorStop(0, "rgba(255,255,255,.075)");
    falloff.addColorStop(1, "rgba(0,0,0,.34)");
    context.fillStyle = falloff;
    context.fillRect(0, 0, face.width, face.height);
    return face;
  });
  studioEnvironment = new THREE.CubeTexture(faces);
  studioEnvironment.colorSpace = THREE.SRGBColorSpace;
  studioEnvironment.mapping = THREE.CubeReflectionMapping;
  studioEnvironment.minFilter = THREE.LinearMipmapLinearFilter;
  studioEnvironment.magFilter = THREE.LinearFilter;
  studioEnvironment.generateMipmaps = true;
  studioEnvironment.needsUpdate = true;
  scene.environment = studioEnvironment;
}

function initializeForegroundRenderer() {
  if (!foregroundCanvas) return;
  try {
    foregroundRenderer = new THREE.WebGLRenderer({
      canvas: foregroundCanvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false
    });
  } catch (error) {
    foregroundRenderer = null;
    foregroundCanvas.dataset.rendererState = "unavailable";
    return;
  }
  foregroundRenderer.outputColorSpace = THREE.SRGBColorSpace;
  foregroundRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  foregroundRenderer.toneMappingExposure = .97;
  foregroundRenderer.shadowMap.enabled = false;
  foregroundRenderer.setClearColor(0x000000, 0);
  foregroundCanvas.dataset.rendererState = "ready";
}

function createForegroundCompositeScene() {
  if (!foregroundRenderer) return;
  foregroundScene = new THREE.Scene();
  // This pass must remain optically empty except for the hardware itself.
  // A background or fog value here would composite as a black sheet over the
  // accessible DOM controls between the two WebGL layers.
  foregroundScene.background = null;
  foregroundScene.fog = null;
  foregroundScene.environment = studioEnvironment;

  const ambient = new THREE.HemisphereLight(0xd6d3cd, 0x030302, 0);
  foregroundScene.add(ambient);
  foregroundTerminalLights.push({ light: ambient, peak: .44 });

  const leftGrazer = new THREE.RectAreaLight(0xd4d1ca, 0, 5.8, 5.2);
  leftGrazer.position.set(-4.9, 1.1, -20.7);
  leftGrazer.lookAt(-2.4, .45, -26.25);
  foregroundScene.add(leftGrazer);
  foregroundTerminalLights.push({ light: leftGrazer, peak: 34 });

  const rightGrazer = new THREE.RectAreaLight(0xc3c0b9, 0, 4.8, 5.8);
  rightGrazer.position.set(5.15, -.2, -21.15);
  rightGrazer.lookAt(3.1, -.55, -26.35);
  foregroundScene.add(rightGrazer);
  foregroundTerminalLights.push({ light: rightGrazer, peak: 30 });

  const topGrazer = new THREE.RectAreaLight(0xddd9d1, 0, 8.6, .72);
  topGrazer.position.set(0, 4.92, -21.5);
  topGrazer.lookAt(0, 3.6, -26.4);
  foregroundScene.add(topGrazer);
  foregroundTerminalLights.push({ light: topGrazer, peak: 17 });

  const clampKey = new THREE.SpotLight(0xe7e3dc, 0, 16, .5, .9, 1.9);
  clampKey.position.set(-4.8, 3.8, -19.4);
  clampKey.target.position.set(-.7, .4, -26.1);
  foregroundScene.add(clampKey, clampKey.target);
  foregroundTerminalLights.push({ light: clampKey, peak: 54 });
}

function mountForegroundCanvas(mode) {
  if (!foregroundCanvas) return;
  const plannerHost = document.querySelector("#plannerScrollJourney > .planner-journey-sticky");
  const nextHost = mode === "result" ? document.body : plannerHost;
  if (nextHost && foregroundCanvas.parentNode !== nextHost) nextHost.appendChild(foregroundCanvas);
}

function updateForegroundComposite(progress) {
  const reveal = smoothstep(.67, .82, progress);
  foregroundTerminalLights.forEach(({ light, peak }) => {
    light.intensity = peak * reveal;
  });
}

function syncForegroundCarrierOverlays() {
  if (!foregroundRenderer || !foregroundScene || !camera || isForegroundContextLost) return;
  foregroundCarrierOverlays.forEach((entry) => {
    const frame = anchors.get(entry.name);
    const validProjection = Boolean(frame?.output?.visible && frame.output.quad);
    const preserveResultPose = entry.name === "result"
      && entry.hasSafePose
      && document.body.classList.contains("schedule-terminal-projected");
    if (validProjection) {
      entry.overlay.matrix.copy(entry.source.matrixWorld);
      entry.overlay.matrixWorldNeedsUpdate = true;
      entry.overlay.visible = true;
      entry.hasSafePose = true;
    } else {
      // The result DOM intentionally freezes its last safe homography for a
      // short projection-loss grace period. Preserve the matching clamp pose
      // for that same interval instead of letting the two layers swim apart.
      entry.overlay.visible = preserveResultPose;
    }
  });
  foregroundRenderer.toneMappingExposure = renderer?.toneMappingExposure || .97;
  foregroundRenderer.clear();
  foregroundRenderer.render(foregroundScene, camera);
  if (viewport) {
    viewport.dataset.foregroundRendererDrawCalls = String(foregroundRenderer.info.render.calls);
    viewport.dataset.foregroundRendererTriangles = String(foregroundRenderer.info.render.triangles);
  }
}

function boxGeometry(width, height, depth) {
  const key = `${width}:${height}:${depth}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
  return geometryCache.get(key);
}

function cylinderGeometry(radius, length, segments = 24) {
  const key = `cylinder:${radius}:${length}:${segments}`;
  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.CylinderGeometry(radius, radius, length, segments));
  }
  return geometryCache.get(key);
}

function torusGeometry(radius, tube, radialSegments = 10, tubularSegments = 28) {
  const key = `torus:${radius}:${tube}:${radialSegments}:${tubularSegments}`;
  if (!geometryCache.has(key)) {
    geometryCache.set(key, new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments));
  }
  return geometryCache.get(key);
}

function helicalThreadGeometry(length, pitch, radius, tubeRadius, handedness = 1) {
  const key = `helical-thread:${length}:${pitch}:${radius}:${tubeRadius}:${handedness}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  const turns = length / pitch;
  const tubularSegments = Math.max(96, Math.ceil(turns * 10));
  const points = Array.from({ length: tubularSegments + 1 }, (_, index) => {
    const t = index / tubularSegments;
    const angle = t * turns * Math.PI * 2 * handedness;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      -length * .5 + t * length,
      Math.sin(angle) * radius
    );
  });
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, 4, false);
  geometry.computeVertexNormals();
  geometryCache.set(key, geometry);
  return geometry;
}

function spurGearGeometry(radius, teeth, depth) {
  const key = `spur-gear:${radius}:${teeth}:${depth}`;
  if (geometryCache.has(key)) return geometryCache.get(key);
  const pitch = Math.PI * 2 / teeth;
  const rootRadius = radius * .86;
  const shoulderRadius = radius * .95;
  const tipRadius = radius * 1.04;
  const shape = new THREE.Shape();
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const center = tooth * pitch;
    // Seven profile samples approximate an involute shoulder better than a
    // square saw tooth while keeping the geometry deterministic and textureless.
    const profile = [
      [center - pitch * .5, rootRadius],
      [center - pitch * .35, rootRadius],
      [center - pitch * .26, shoulderRadius],
      [center - pitch * .17, tipRadius],
      [center + pitch * .17, tipRadius],
      [center + pitch * .26, shoulderRadius],
      [center + pitch * .35, rootRadius]
    ];
    profile.forEach(([angle, radial], pointIndex) => {
      const x = Math.cos(angle) * radial;
      const y = Math.sin(angle) * radial;
      if (tooth === 0 && pointIndex === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();

  // Both gear constructors fit shafts no larger than .24r. A .28r bore leaves
  // a visible assembly clearance instead of burying a larger solid shaft inside
  // the gear face, while preserving enough ligament around the service portals.
  const centerBoreRadius = radius * .28;
  const centerBore = new THREE.Path();
  centerBore.absarc(0, 0, centerBoreRadius, 0, Math.PI * 2, true);
  shape.holes.push(centerBore);
  if (radius >= .3) {
    const portalCount = radius >= .55 ? 6 : 5;
    for (let portal = 0; portal < portalCount; portal += 1) {
      const angle = portal / portalCount * Math.PI * 2;
      const opening = new THREE.Path();
      opening.absarc(
        Math.cos(angle) * radius * .47,
        Math.sin(angle) * radius * .47,
        radius * .105,
        0,
        Math.PI * 2,
        true
      );
      shape.holes.push(opening);
    }
  }
  return extrudedGeometry(key, shape, depth, Math.min(depth * .1, radius * .026), 5);
}

function roundedRectShape(width, height, radius) {
  const halfWidth = width * .5;
  const halfHeight = height * .5;
  const r = Math.min(radius, halfWidth, halfHeight);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + r, -halfHeight);
  shape.lineTo(halfWidth - r, -halfHeight);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + r);
  shape.lineTo(halfWidth, halfHeight - r);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth - r, halfHeight);
  shape.lineTo(-halfWidth + r, halfHeight);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - r);
  shape.lineTo(-halfWidth, -halfHeight + r);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + r, -halfHeight);
  shape.closePath();
  return shape;
}

function rectangularHole(width, height) {
  const hole = new THREE.Path();
  hole.moveTo(-width * .5, -height * .5);
  hole.lineTo(-width * .5, height * .5);
  hole.lineTo(width * .5, height * .5);
  hole.lineTo(width * .5, -height * .5);
  hole.closePath();
  return hole;
}

function extrudedGeometry(key, shape, depth, bevel = .035, curveSegments = 10) {
  if (!geometryCache.has(key)) {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      steps: 1,
      curveSegments,
      bevelEnabled: bevel > 0,
      bevelSegments: bevel > 0 ? 2 : 0,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelOffset: 0
    });
    geometry.translate(0, 0, -depth * .5);
    geometry.computeVertexNormals();
    geometryCache.set(key, geometry);
  }
  return geometryCache.get(key);
}

function addBeveledPanel(parent, size, position, surface = graphite, radius = .08, bevel = .03, name = "") {
  const key = `beveled-panel:${size[0]}:${size[1]}:${size[2]}:${radius}:${bevel}`;
  const geometry = extrudedGeometry(key, roundedRectShape(size[0], size[1], radius), size[2], bevel);
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.name = name;
  // Fine service plates still receive the key light, but only mechanically
  // substantial panels enter the three shadow-map passes. Tiny beveled parts
  // contributed thousands of invisible shadow draws and could stall the GPU
  // before the first interactive frame.
  const volume = size[0] * size[1] * size[2];
  mesh.castShadow = volume > .05 && Math.max(...size) > .5;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function clampBevelToRingWall(bevel, outerWidth, outerHeight, innerWidth, innerHeight, depth) {
  const horizontalWall = Math.max(0, (outerHeight - innerHeight) * .5);
  const verticalWall = Math.max(0, (outerWidth - innerWidth) * .5);
  const wallLimitedBevel = Math.min(horizontalWall, verticalWall) * .42;
  const depthLimitedBevel = Math.max(0, depth) * .24;
  return Math.max(0, Math.min(bevel, wallLimitedBevel, depthLimitedBevel));
}

function addBeveledRing(parent, options) {
  const {
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    depth,
    position,
    surface,
    radius = .12,
    bevel = .025,
    name = ""
  } = options;
  const shape = roundedRectShape(outerWidth, outerHeight, radius);
  shape.holes.push(rectangularHole(innerWidth, innerHeight));
  // Thin pressure lips need two visible flat lands between the outside and
  // inside chamfers. Clamping against both wall width and extrusion depth keeps
  // the two bevel fronts from crossing and collapsing into degenerate faces.
  const safeBevel = clampBevelToRingWall(
    bevel,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    depth
  );
  const key = `beveled-ring:${outerWidth}:${outerHeight}:${innerWidth}:${innerHeight}:${depth}:${radius}:${safeBevel}`;
  const mesh = new THREE.Mesh(extrudedGeometry(key, shape, depth, safeBevel), surface);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.name = name;
  mesh.userData.requestedBevel = bevel;
  mesh.userData.appliedBevel = safeBevel;
  const ringVolume = Math.max(0, outerWidth * outerHeight - innerWidth * innerHeight) * depth;
  mesh.castShadow = ringVolume > .035 && Math.max(outerWidth, outerHeight) > .5;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addBoredBearingHousing(parent, options) {
  const {
    outerWidth,
    outerHeight,
    boreDiameter,
    depth,
    position,
    rotation = [0, Math.PI / 2, 0],
    surface = agedGunmetal,
    raceSurface = machinedMetal,
    radius = .07,
    bevel = .016,
    raceRadius,
    raceTube,
    name = "bored-bearing-housing"
  } = options;
  const shape = roundedRectShape(outerWidth, outerHeight, radius);
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreDiameter * .5, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  const safeBevel = clampBevelToRingWall(
    bevel,
    outerWidth,
    outerHeight,
    boreDiameter,
    boreDiameter,
    depth
  );
  const key = `bored-bearing:${outerWidth}:${outerHeight}:${boreDiameter}:${depth}:${radius}:${safeBevel}`;
  const assembly = new THREE.Group();
  assembly.name = name;
  assembly.position.set(...position);
  assembly.rotation.set(...rotation);

  const housing = new THREE.Mesh(extrudedGeometry(key, shape, depth, safeBevel, 24), surface);
  housing.name = `${name}-body`;
  housing.castShadow = outerWidth * outerHeight * depth > .04;
  housing.receiveShadow = true;
  assembly.add(housing);

  const raceGeometry = torusGeometry(raceRadius, raceTube, 10, 32);
  const raceOffset = depth * .5 + safeBevel * .72;
  for (const axialOffset of [-raceOffset, raceOffset]) {
    const race = new THREE.Mesh(raceGeometry, raceSurface);
    race.name = `${name}-race`;
    race.position.z = axialOffset;
    race.castShadow = false;
    race.receiveShadow = true;
    assembly.add(race);
  }
  parent.add(assembly);
  return assembly;
}

function addBox(parent, size, position, surface = graphite, rotation = null, name = "") {
  const mesh = new THREE.Mesh(boxGeometry(size[0], size[1], size[2]), surface);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.name = name;
  const volume = size[0] * size[1] * size[2];
  mesh.castShadow = volume > .04 && Math.max(...size) > .55;
  mesh.receiveShadow = volume > .006;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, radius, length, position, surface = machinedMetal, rotation = null, segments = 24) {
  const mesh = new THREE.Mesh(cylinderGeometry(radius, length, segments), surface);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = radius * radius * length > .012;
  mesh.receiveShadow = radius > .06;
  parent.add(mesh);
  return mesh;
}

function addTube(parent, points, radius = .055, surface = cableMaterial) {
  const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const geometry = new THREE.TubeGeometry(curve, Math.max(24, points.length * 10), radius, 6, false);
  geometryCache.set(`tube:${geometry.id}`, geometry);
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.castShadow = radius >= .075;
  mesh.receiveShadow = radius >= .04;
  parent.add(mesh);
  return mesh;
}

function addApertureRing(parent, options) {
  const {
    z,
    outerWidth,
    outerHeight,
    innerWidth,
    innerHeight,
    depth,
    surface
  } = options;
  const horizontalHeight = Math.max(.04, (outerHeight - innerHeight) / 2);
  const verticalWidth = Math.max(.04, (outerWidth - innerWidth) / 2);
  addBox(parent, [outerWidth, horizontalHeight, depth], [0, (innerHeight + horizontalHeight) / 2, z], surface);
  addBox(parent, [outerWidth, horizontalHeight, depth], [0, -(innerHeight + horizontalHeight) / 2, z], surface);
  addBox(parent, [verticalWidth, innerHeight, depth], [(innerWidth + verticalWidth) / 2, 0, z], surface);
  addBox(parent, [verticalWidth, innerHeight, depth], [-(innerWidth + verticalWidth) / 2, 0, z], surface);
}

const VENT_DUCT_STATIONS = Object.freeze([
  // The first station is the physical rear edge of the selected .048 hole.
  { z: DEVICE.faceZ - DEVICE.ventDepth, halfWidth: DEVICE.ventHoleRadius, halfHeight: DEVICE.ventHoleRadius, exponent: 2 },
  { z: 2.44, halfWidth: .054, halfHeight: .054, exponent: 2 },
  { z: 2.18, halfWidth: .074, halfHeight: .066, exponent: 2 },
  { z: 1.82, halfWidth: .122, halfHeight: .09, exponent: 2 },
  { z: 1.34, halfWidth: .21, halfHeight: .138, exponent: 2.35 },
  { z: .78, halfWidth: .345, halfHeight: .218, exponent: 2.9 },
  { z: .18, halfWidth: .54, halfHeight: .32, exponent: 3.65 },
  { z: -.36, halfWidth: .72, halfHeight: .43, exponent: 4.5 }
]);

const PLENUM_DUCT_STATIONS = Object.freeze([
  // This station is identical to the threshold exit in world space.
  { z: DEVICE.groupZ - .36, halfWidth: .72, halfHeight: .43, exponent: 4.5 },
  { z: 8.04, halfWidth: .88, halfHeight: .52, exponent: 4.65 },
  { z: 7.62, halfWidth: 1.16, halfHeight: .69, exponent: 4.85 },
  { z: 7.18, halfWidth: 1.54, halfHeight: .91, exponent: 5.05 },
  { z: 6.72, halfWidth: 2.06, halfHeight: 1.19, exponent: 5.25 },
  { z: 6.24, halfWidth: 2.64, halfHeight: 1.55, exponent: 5.45 },
  // Continue the same physical shell through the first service corridor.
  // The former hard stop at z=6.24 exposed the full rectangular bay within a
  // single scroll interval. These six real sections keep the wall, seams and
  // parallax around the lens until the rounded plenum has grown into the
  // chassis-rib aperture at z=-.4.
  { z: 5.55, halfWidth: 3.12, halfHeight: 1.82, exponent: 5.65 },
  { z: 4.72, halfWidth: 3.65, halfHeight: 2.12, exponent: 5.85 },
  { z: 3.72, halfWidth: 4.25, halfHeight: 2.45, exponent: 6.05 },
  { z: 2.58, halfWidth: 4.9, halfHeight: 2.76, exponent: 6.25 },
  { z: 1.32, halfWidth: 5.5, halfHeight: 3.02, exponent: 6.45 },
  { z: -.4, halfWidth: 6.08, halfHeight: 3.28, exponent: 6.7 }
]);

// Scroll distance is authored independently from the Catmull-Rom arc length.
// The selected aperture is only a few centimetres deep while the internal bay
// is metres long in scene scale, so raw arc-length sampling rushes through the
// physically important plate/throat/loft sequence. These stations reserve six
// readable phases for the real crossing, then smoothly regain the original
// pace before the carriers deploy.
const CAMERA_PROGRESS_STATIONS = Object.freeze([
  { input: 0, path: 0 },
  { input: .12, path: .12 },
  { input: .22, path: .22 },
  { input: .28, path: .28 },
  { input: .32, path: .292 },
  { input: .36, path: .301 },
  { input: .39, path: .315 },
  { input: .44, path: .327 },
  { input: .49, path: .35 },
  { input: .55, path: .39 },
  { input: .62, path: .52 },
  { input: .7, path: .68 },
  { input: .78, path: .8 },
  { input: .88, path: .9 },
  { input: 1, path: 1 }
]);

function createMonotoneTangents(stations) {
  const spans = [];
  const slopes = [];
  for (let index = 0; index < stations.length - 1; index += 1) {
    const span = stations[index + 1].input - stations[index].input;
    spans.push(span);
    slopes.push((stations[index + 1].path - stations[index].path) / span);
  }
  const tangents = [slopes[0]];
  for (let index = 1; index < stations.length - 1; index += 1) {
    const previousSlope = slopes[index - 1];
    const nextSlope = slopes[index];
    if (previousSlope <= 0 || nextSlope <= 0) {
      tangents.push(0);
      continue;
    }
    const previousSpan = spans[index - 1];
    const nextSpan = spans[index];
    const previousWeight = 2 * nextSpan + previousSpan;
    const nextWeight = nextSpan + 2 * previousSpan;
    tangents.push(
      (previousWeight + nextWeight)
      / (previousWeight / previousSlope + nextWeight / nextSlope)
    );
  }
  tangents.push(slopes.at(-1));
  return Object.freeze(tangents);
}

const CAMERA_PROGRESS_TANGENTS = createMonotoneTangents(CAMERA_PROGRESS_STATIONS);

function sampleDuctStation(station, angle, radialOffset = 0) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const power = 2 / Math.max(2, station.exponent);
  return new THREE.Vector3(
    Math.sign(cosine) * Math.pow(Math.abs(cosine), power) * (station.halfWidth + radialOffset),
    Math.sign(sine) * Math.pow(Math.abs(sine), power) * (station.halfHeight + radialOffset),
    station.z
  );
}

function createLoftedDuctGeometry(key, stations, radialSegments = 64) {
  if (geometryCache.has(key)) return geometryCache.get(key);
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  const radialStep = Math.PI * 2 / radialSegments;
  stations.forEach((station, stationIndex) => {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = segment / radialSegments * Math.PI * 2;
      const point = sampleDuctStation(station, angle);
      positions.push(point.x, point.y, point.z);

      // Central differences follow the continuous superellipse itself instead
      // of averaging the two triangle diagonals that happen to meet here. The
      // topology remains the authored 64-sided loft, but its reflected graze
      // now travels around the rounded wall without exposing radial facets.
      const radialBefore = sampleDuctStation(station, angle - radialStep * .5);
      const radialAfter = sampleDuctStation(station, angle + radialStep * .5);
      const previousStation = stations[Math.max(0, stationIndex - 1)];
      const nextStation = stations[Math.min(stations.length - 1, stationIndex + 1)];
      const axialBefore = sampleDuctStation(previousStation, angle);
      const axialAfter = sampleDuctStation(nextStation, angle);
      const radialTangent = radialAfter.sub(radialBefore);
      const axialTangent = axialAfter.sub(axialBefore);
      const normal = new THREE.Vector3().crossVectors(radialTangent, axialTangent).normalize();
      normals.push(normal.x, normal.y, normal.z);

      // A broad, non-repeating directional falloff is baked per vertex. It is
      // generated from the loft parameter (never a texture), keeping the bore
      // gunmetal-dark while allowing one restrained warm graze to describe it.
      const directionalGraze = Math.pow(.5 + .5 * Math.cos(angle - 2.34), 2.2);
      const axialOcclusion = Math.sin(stationIndex / Math.max(1, stations.length - 1) * Math.PI);
      const shade = clamp(.76 + directionalGraze * .15 - axialOcclusion * .045, .7, .92);
      colors.push(shade * .97, shade * .985, shade);
    }
  });
  for (let stationIndex = 0; stationIndex < stations.length - 1; stationIndex += 1) {
    const currentOffset = stationIndex * radialSegments;
    const nextOffset = (stationIndex + 1) * radialSegments;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const nextSegment = (segment + 1) % radialSegments;
      const a = currentOffset + segment;
      const b = currentOffset + nextSegment;
      const c = nextOffset + segment;
      const d = nextOffset + nextSegment;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometryCache.set(key, geometry);
  return geometry;
}

function addLoftedDuct(parent, key, stations, surface) {
  const duct = new THREE.Mesh(createLoftedDuctGeometry(key, stations), surface);
  duct.name = key;
  duct.castShadow = false;
  duct.receiveShadow = true;
  parent.add(duct);
  return duct;
}

function addConformingDuctHoop(parent, station, radialOffset, tubeRadius, surface) {
  const points = Array.from({ length: 32 }, (_, index) => (
    sampleDuctStation(station, index / 32 * Math.PI * 2, radialOffset)
  ));
  const curve = new THREE.CatmullRomCurve3(points, true, "centripetal", .5);
  const geometry = new THREE.TubeGeometry(curve, 64, tubeRadius, 8, true);
  geometryCache.set(`duct-hoop:${geometry.id}`, geometry);
  const hoop = new THREE.Mesh(geometry, surface);
  hoop.castShadow = tubeRadius > .03;
  hoop.receiveShadow = true;
  parent.add(hoop);
  return hoop;
}

function addLongitudinalDuctRibs(parent, stations) {
  // Four deliberately uneven seams begin only after the circular throat. They
  // stay tangent to the plenum wall and never form a decorative spoke pattern
  // across the selected aperture.
  const ribAngles = [.32, 1.78, 3.26, 5.02];
  const visibleStations = stations.slice(7);
  ribAngles.forEach((angle, ribIndex) => {
    const points = visibleStations.map((station, stationIndex) => {
      const drift = Math.sin(stationIndex * .91 + ribIndex * 1.37) * .018;
      const inset = .007 + Math.min(.03, (station.halfWidth + station.halfHeight) * .0085);
      const point = sampleDuctStation(station, angle + drift, -inset);
      return [point.x, point.y, point.z];
    });
    addTube(parent, points, ribIndex % 3 === 0 ? .006 : .004, ductSeamMetal);
  });
}

function addDuctRetainingDatums(parent, stations) {
  // Real service collars need indexed fasteners so a technician can read both
  // clocking and depth. Eighteen instanced heads provide that scale reference
  // through the otherwise black bore without adding decorative light strips.
  // They sit just inside the liner and begin behind the selected aperture, so
  // the physical 48 mm opening and its continuous loft remain unobstructed.
  const stationIndices = [2, 4, 6, 8, 10, 12, 14, 16, 18];
  const headsPerStation = 3;
  const heads = new THREE.InstancedMesh(
    cylinderGeometry(.018, .014, 12),
    ductHoopWear,
    stationIndices.length * headsPerStation
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const inward = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let instance = 0;

  stationIndices.forEach((stationIndex, collarIndex) => {
    const station = stations[stationIndex];
    const hardwareScale = clamp(.56 + (station.halfWidth + station.halfHeight) * .18, .56, 1.12);
    for (let boltIndex = 0; boltIndex < headsPerStation; boltIndex += 1) {
      const angle = .46 + boltIndex / headsPerStation * Math.PI * 2 + collarIndex * .19;
      const inset = .01 + Math.min(.032, (station.halfWidth + station.halfHeight) * .009);
      const point = sampleDuctStation(station, angle, -inset);
      inward.set(-point.x, -point.y, 0).normalize();
      quaternion.setFromUnitVectors(yAxis, inward);
      scale.set(hardwareScale, hardwareScale, hardwareScale);
      matrix.compose(point, quaternion, scale);
      heads.setMatrixAt(instance, matrix);
      instance += 1;
    }
  });

  heads.name = "duct-retaining-datum-heads";
  heads.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  heads.castShadow = false;
  heads.receiveShadow = true;
  parent.add(heads);
}

function createPerforatedVentPlate(group) {
  const shape = roundedRectShape(DEVICE.ventWidth, DEVICE.ventHeight, .045);
  for (let row = -1; row <= 1; row += 1) {
    for (let column = -31; column <= 31; column += 1) {
      const x = column * DEVICE.ventColumnPitch;
      const y = row * DEVICE.ventRowPitch;
      const hole = new THREE.Path();
      hole.absarc(x, y, DEVICE.ventHoleRadius, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  }

  const ventBevel = .005;
  const ventCurveSegments = 48;
  const ventCoreDepth = DEVICE.ventDepth - ventBevel * 2;
  const key = `physical-vent-v2:${DEVICE.ventWidth}:${DEVICE.ventHeight}:${DEVICE.ventDepth}:${ventBevel}:${ventCurveSegments}`;
  // Every aperture is still cut into one continuous plate, but the front and
  // rear lips now carry a real five-millimetre-equivalent chamfer. The core
  // depth is shortened by both bevel thicknesses so the total grille envelope
  // still ends exactly where the continuous loft begins.
  const plate = new THREE.Mesh(
    extrudedGeometry(key, shape, ventCoreDepth, ventBevel, ventCurveSegments),
    [graphite, ventWallMetal]
  );
  plate.position.z = DEVICE.faceZ - DEVICE.ventDepth * .5;
  plate.name = "physical-perforated-vent";
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  // A non-reflective internal baffle sits behind the grille. Every opening is
  // still a real through-hole; the central aperture alone lines up with the
  // deeper service duct, while neighboring holes look into the dark plenum.
  const baffleGap = .16;
  const baffleDepth = .045;
  const baffleZ = DEVICE.faceZ - DEVICE.ventDepth - .22;
  const baffleSideWidth = (DEVICE.ventWidth - baffleGap) * .5;
  const baffleBandHeight = (DEVICE.ventHeight - baffleGap) * .5;
  addBox(group, [baffleSideWidth, DEVICE.ventHeight, baffleDepth], [-(baffleGap + baffleSideWidth) * .5, 0, baffleZ], gasketRubber);
  addBox(group, [baffleSideWidth, DEVICE.ventHeight, baffleDepth], [(baffleGap + baffleSideWidth) * .5, 0, baffleZ], gasketRubber);
  addBox(group, [baffleGap, baffleBandHeight, baffleDepth], [0, (baffleGap + baffleBandHeight) * .5, baffleZ], gasketRubber);
  addBox(group, [baffleGap, baffleBandHeight, baffleDepth], [0, -(baffleGap + baffleBandHeight) * .5, baffleZ], gasketRubber);
}

function createEntranceEnclosure(group) {
  const faceZ = DEVICE.faceZ;
  const outerTop = DEVICE.outerCenterY + DEVICE.outerHeight * .5;
  const outerBottom = DEVICE.outerCenterY - DEVICE.outerHeight * .5;
  const screenTop = DEVICE.screenCenterY + DEVICE.screenHeight * .5;
  const screenBottom = DEVICE.screenCenterY - DEVICE.screenHeight * .5;
  const sideWidth = (DEVICE.outerWidth - DEVICE.screenWidth) * .5;
  const sideX = DEVICE.screenWidth * .5 + sideWidth * .5;
  const chassisZ = faceZ - .34;

  addBeveledPanel(group, [DEVICE.outerWidth, outerTop - screenTop, .68], [0, (outerTop + screenTop) * .5, chassisZ], exteriorShell, .1, .035, "upper-chassis");
  addBeveledPanel(group, [sideWidth, DEVICE.outerHeight - .16, .68], [-sideX, DEVICE.outerCenterY, chassisZ], exteriorShell, .08, .03, "left-chassis-rail");
  addBeveledPanel(group, [sideWidth, DEVICE.outerHeight - .16, .68], [sideX, DEVICE.outerCenterY, chassisZ], exteriorShell, .08, .03, "right-chassis-rail");
  addBeveledPanel(group, [DEVICE.outerWidth, .54, .72], [0, outerBottom + .27, chassisZ - .02], exteriorShell, .08, .035, "lower-chassis");

  // These narrow, real chamfer caps are not an emissive outline. They sit on
  // the enclosure's proud edge and catch the two photographic grazing lights,
  // revealing the top and side silhouette while the broad faces stay black.
  addBeveledPanel(group, [DEVICE.outerWidth - .24, .052, .075], [0, outerTop - .075, faceZ + .035], exteriorTrim, .02, .012, "upper-machined-chamfer");
  for (const side of [-1, 1]) {
    addBeveledPanel(
      group,
      [.052, DEVICE.outerHeight - .28, .075],
      [side * (DEVICE.outerWidth * .5 - .075), DEVICE.outerCenterY, faceZ + .035],
      exteriorTrim,
      .02,
      .012,
      side < 0 ? "left-machined-chamfer" : "right-machined-chamfer"
    );
  }

  addBeveledRing(group, {
    outerWidth: 12.17,
    // A slim pressure rail leaves all three physical vent rows unobstructed.
    outerHeight: 5.89,
    innerWidth: DEVICE.screenWidth,
    innerHeight: DEVICE.screenHeight,
    depth: .5,
    position: [0, DEVICE.screenCenterY, faceZ - .25],
    surface: exteriorShell,
    radius: .12,
    bevel: .025,
    name: "screen-pressure-frame"
  });
  addBeveledRing(group, {
    outerWidth: 11.83,
    outerHeight: 5.85,
    innerWidth: DEVICE.screenWidth,
    innerHeight: DEVICE.screenHeight,
    depth: .12,
    position: [0, DEVICE.screenCenterY, faceZ - .045],
    surface: gasketRubber,
    radius: .06,
    bevel: .012,
    name: "screen-gasket"
  });
  addBox(group, [DEVICE.screenWidth - .06, DEVICE.screenHeight - .06, .12], [0, DEVICE.screenCenterY, faceZ - .34], screenBacking);

  addBeveledRing(group, {
    outerWidth: DEVICE.ventWidth + .28,
    outerHeight: DEVICE.ventHeight + .28,
    innerWidth: DEVICE.ventWidth + .025,
    innerHeight: DEVICE.ventHeight + .025,
    depth: .2,
    position: [0, 0, faceZ - .1],
    surface: edgeMetal,
    radius: .07,
    bevel: .012,
    name: "vent-surround"
  });
  createPerforatedVentPlate(group);

  const ventSideWidth = (DEVICE.outerWidth - DEVICE.ventWidth) * .5;
  for (const side of [-1, 1]) {
    addBeveledPanel(
      group,
      [ventSideWidth, DEVICE.ventHeight + .12, .68],
      [side * (DEVICE.ventWidth * .5 + ventSideWidth * .5), 0, chassisZ],
      graphite,
      .05,
      .02,
      side < 0 ? "left-vent-cheek" : "right-vent-cheek"
    );
  }

  addBeveledPanel(group, [13.46, .16, .92], [0, outerBottom - .08, faceZ - .34], exteriorTrim, .07, .025, "base-rail");
  for (const side of [-1, 1]) {
    addBeveledPanel(group, [2.08, .14, 1.02], [side * 5.25, outerBottom - .18, faceZ - .38], deepGraphite, .06, .02, "device-foot");
  }

  const frontBolts = [
    [-6.16, 6.4], [6.16, 6.4], [-6.16, -.46], [6.16, -.46],
    [-6.16, 4.82], [6.16, 4.82], [-6.16, 2.92], [6.16, 2.92],
    [-6.16, 1.02], [6.16, 1.02]
  ];
  const boltGeometry = cylinderGeometry(.066, .075, 18);
  const washerGeometry = torusGeometry(.091, .014, 7, 18);
  const bolts = new THREE.InstancedMesh(boltGeometry, brushedAluminum, frontBolts.length);
  const washers = new THREE.InstancedMesh(washerGeometry, agedGunmetal, frontBolts.length);
  const boltRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const matrix = new THREE.Matrix4();
  frontBolts.forEach(([x, y], index) => {
    matrix.copy(boltRotation).setPosition(x, y, faceZ + .055);
    bolts.setMatrixAt(index, matrix);
    matrix.identity().setPosition(x, y, faceZ + .021);
    washers.setMatrixAt(index, matrix);
  });
  bolts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  washers.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  group.add(bolts, washers);

  // Sparse, non-repeating physical scuffs replace tiled material maps.
  const scuffGeometry = boxGeometry(.26, .006, .007);
  const scuffs = new THREE.InstancedMesh(scuffGeometry, wornEdge, 26);
  for (let index = 0; index < 26; index += 1) {
    const side = index % 2 ? -1 : 1;
    const x = side * (1.1 + ((index * 37) % 50) / 50 * 4.7);
    const y = index < 14 ? 6.27 + ((index % 4) - 1.5) * .045 : -.49 + ((index % 3) - 1) * .04;
    matrix.makeRotationZ(((index * 17) % 9 - 4) * .006);
    matrix.setPosition(x, y, faceZ + .018);
    scuffs.setMatrixAt(index, matrix);
  }
  scuffs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  scuffs.castShadow = false;
  group.add(scuffs);
}

function createVentThreshold() {
  const group = new THREE.Group();
  group.name = "vent-threshold";
  group.position.z = DEVICE.groupZ;

  createEntranceEnclosure(group);

  // One continuous shell now begins at the selected hole's real .048 rear
  // edge. Equal-width stations form the circular throat, then the section
  // becomes elliptical, superelliptical and finally a rounded rectangle.
  // There are no plane slices or hidden throat blocks for the camera to cross.
  addLoftedDuct(group, "monotonic-vent-duct", VENT_DUCT_STATIONS, entranceDuctSurface);

  for (const x of [-1.72, 1.72]) {
    for (const y of [-.88, .88]) {
      addCylinder(group, .07, .1, [x, y, 2.25], edgeMetal, [Math.PI / 2, 0, 0], 14);
    }
  }

  addBox(group, [15, .7, 1.4], [0, 2.05, 0], deepGraphite);
  addBox(group, [15, .7, 1.4], [0, -2.05, 0], deepGraphite);
  addBox(group, [1.8, 4.8, 1.4], [-7.15, 0, 0], deepGraphite);
  addBox(group, [1.8, 4.8, 1.4], [7.15, 0, 0], deepGraphite);

  const slatGeometry = boxGeometry(.1, 3.35, 1.16);
  const slatCount = 46;
  const slats = new THREE.InstancedMesh(slatGeometry, agedGunmetal, slatCount);
  const matrix = new THREE.Matrix4();
  let instance = 0;
  for (let index = -24; index <= 24; index += 1) {
    if (Math.abs(index) <= 7) continue;
    const x = index * .285;
    matrix.makeRotationZ(index % 2 ? .018 : -.018);
    matrix.setPosition(x, 0, 0);
    slats.setMatrixAt(instance, matrix);
    instance += 1;
  }
  slats.count = instance;
  slats.castShadow = true;
  slats.receiveShadow = true;
  group.add(slats);

  addBox(group, [.28, 3.45, 1.2], [-2.35, 0, -.02], agedGunmetal);
  addBox(group, [.28, 3.45, 1.2], [2.35, 0, -.02], agedGunmetal);
  addBox(group, [3.2, .72, 1.22], [0, 1.72, -.02], edgeMetal);
  addBox(group, [3.2, .72, 1.22], [0, -1.72, -.02], edgeMetal);

  for (const side of [-1, 1]) {
    for (let y = -1.25; y <= 1.25; y += .5) {
      addCylinder(group, .055, .12, [side * 1.48, y, .64], edgeMetal, [Math.PI / 2, 0, 0], 12);
    }
  }

  scene.add(group);
}

function createTransitionPlenum() {
  // The second shell shares the exact first shell exit, then continues the
  // same rounded-rect growth into the open mechanical plenum. Every station is
  // wider than the previous one; no frame or cross-member cuts the optical axis.
  addLoftedDuct(scene, "monotonic-plenum-duct", PLENUM_DUCT_STATIONS, plenumDuctSurface);

  // The first service lamp is fixed to the lower-right liner immediately
  // after the throat. Its housing and shield enter the shot before its light
  // reaches full output, so the reveal reads as a real installed luminaire
  // instead of camera exposure automation.
  addBeveledPanel(
    scene,
    [.42, .12, .26],
    [.91, -.59, 7.38],
    deepGraphite,
    .018,
    "plenum-entry-lamp-housing"
  );
  addBeveledPanel(
    scene,
    [.27, .024, .14],
    [.82, -.515, 7.31],
    whiteDiagnostic,
    .008,
    "plenum-entry-lamp-lens"
  );
  addBeveledPanel(
    scene,
    [.08, .18, .11],
    [1.01, -.62, 7.42],
    blackOxideSteel,
    null,
    "plenum-entry-lamp-bracket"
  );

  // The continuation light has a real serviceable housing and shield. It is
  // recessed below the upper-left liner so the source can graze the wall but
  // never appears as a floating orb in the camera path.
  addBeveledPanel(
    scene,
    [.58, .16, .34],
    [-2.78, 1.91, 4.74],
    deepGraphite,
    .045,
    .012,
    "plenum-continuation-lamp-housing"
  );
  addBox(
    scene,
    [.34, .026, .17],
    [-2.78, 1.815, 4.7],
    whiteDiagnostic,
    [0, 0, -.025],
    "plenum-continuation-lamp-lens"
  );
  addBox(
    scene,
    [.1, .22, .14],
    [-2.78, 2.02, 4.77],
    blackOxideSteel,
    null,
    "plenum-continuation-lamp-bracket"
  );

  const continuousStations = [
    ...VENT_DUCT_STATIONS.map(station => ({ ...station, z: station.z + DEVICE.groupZ })),
    ...PLENUM_DUCT_STATIONS.slice(1)
  ];
  const hoopStationIndices = [1, 3, 5, 7, 9, 11, 12, 13, 14, 16, 18];
  hoopStationIndices.forEach((stationIndex, hoopIndex) => {
    const station = continuousStations[stationIndex];
    const scale = station.halfWidth + station.halfHeight;
    // Negative offset seats each hoop on the visible cavity face instead of
    // hiding it behind the opaque duct wall.
    const radialOffset = -(.007 + Math.min(.026, scale * .008));
    const tubeRadius = .005 + Math.min(.014, scale * .0045);
    addConformingDuctHoop(
      scene,
      station,
      radialOffset,
      tubeRadius,
      hoopIndex % 2 ? ductHoopMetal : ductHoopWear
    );
  });
  addLongitudinalDuctRibs(scene, continuousStations);
  addDuctRetainingDatums(scene, continuousStations);
}

function createTunnelRib(z, index) {
  const group = new THREE.Group();
  group.position.z = z;
  group.name = `chassis-rib-${index}`;
  // The terminal station is a structural portal around the carrier envelope,
  // not another tunnel hoop through it. Moving only the complete hoop rearward
  // cleared the carriers but intersected the terminal services behind them.
  const terminalPortal = index === 8;
  const topY = terminalPortal ? 4.34 : 3.45;
  const bottomY = terminalPortal ? -4.78 : -3.45;
  const uprightY = terminalPortal ? -.22 : 0;
  const uprightHeight = terminalPortal ? 9.12 : 6.8;
  addBox(group, [13.2, .24, .38], [0, topY, 0], index % 2 ? graphite : machinedMetal);
  addBox(group, [13.2, .24, .38], [0, bottomY, 0], index % 2 ? graphite : machinedMetal);
  addBox(group, [.25, uprightHeight, .38], [-6.45, uprightY, 0], graphite);
  addBox(group, [.25, uprightHeight, .38], [6.45, uprightY, 0], graphite);
  addBox(group, [2.2, .14, .25], [-4.6, terminalPortal ? 4.42 : 2.8, .08], edgeMetal, [0, 0, -.18]);
  addBox(group, [2.2, .14, .25], [4.6, terminalPortal ? -4.8 : -2.8, .08], edgeMetal, [0, 0, -.18]);
  addBox(group, [4.15, .09, .2], [-2.05, terminalPortal ? 4.25 : 3.05, -.18], agedGunmetal, [0, 0, .035]);
  addBox(group, [4.15, .09, .2], [2.05, terminalPortal ? -4.63 : -3.05, -.18], agedGunmetal, [0, 0, .035]);
  for (const side of [-1, 1]) {
    addBox(group, [.12, 1.22, .26], [side * (terminalPortal ? 6.22 : 6.1), side * 2.78, -.04], machinedMetal, [0, 0, side * .62]);
  }
  scene.add(group);
}

function createHeatSink(x, y, z, rotationY = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  addBox(group, [1.68, 2.38, .18], [0, 0, -.14], deepGraphite);
  addBox(group, [1.45, 2.15, .28], [0, 0, 0], graphite);
  addBox(group, [.18, 2.02, .42], [-.79, 0, .08], edgeMetal);
  addBox(group, [.18, 2.02, .42], [.79, 0, .08], edgeMetal);
  const finGeometry = boxGeometry(.055, 1.95, .52);
  const fins = new THREE.InstancedMesh(finGeometry, machinedMetal, 13);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 13; index += 1) {
    matrix.setPosition(-.66 + index * .11, 0, .2);
    fins.setMatrixAt(index, matrix);
  }
  fins.castShadow = true;
  group.add(fins);
  for (const side of [-1, 1]) {
    for (const vertical of [-1, 1]) {
      addCylinder(group, .045, .06, [side * .7, vertical * .99, .23], brushedAluminum, [Math.PI / 2, 0, 0], 10);
    }
  }
  scene.add(group);
}

function createGear(radius, teeth, depth, surface = machinedMetal) {
  const group = new THREE.Group();
  const gearBody = new THREE.Mesh(spurGearGeometry(radius, teeth, depth), surface);
  gearBody.castShadow = true;
  gearBody.receiveShadow = true;
  gearBody.name = `spur-gear-${teeth}t`;
  group.add(gearBody);
  const faceRing = new THREE.Mesh(torusGeometry(radius * .69, radius * .055, 10, 36), milledBlackSteel);
  faceRing.position.z = depth * .53;
  faceRing.castShadow = true;
  group.add(faceRing);
  addCylinder(group, radius * .24, depth * 1.5, [0, 0, 0], turnedSteel, [Math.PI / 2, 0, 0], 28);
  addCylinder(group, radius * .095, depth * 1.78, [0, 0, .012], gasketRubber, [Math.PI / 2, 0, 0], 18);
  return group;
}

function createFastenerAndWearLayer() {
  const fastenerPositions = [];
  // The terminal hoop sits behind the carrier articulation volume. Keeping its
  // fasteners on the same rear station avoids a second, visually detached bolt
  // plane cutting through the deployed controls.
  const ribDepths = [6.2, 3.1, -.4, -4.2, -8.4, -12.8, -17.2, -21.4, -27.15];
  ribDepths.forEach((z, ribIndex) => {
    for (const x of [-5.9, -3.9, -1.95, 1.95, 3.9, 5.9]) {
      fastenerPositions.push([x, 3.3, z + .22], [x, -3.3, z + .22]);
    }
    for (const y of [-2.4, -.8, .8, 2.4]) {
      fastenerPositions.push([-6.28, y, z + .22], [6.28, y, z + .22]);
    }
    if (ribIndex % 2 === 0) fastenerPositions.push([0, 3.3, z + .22], [0, -3.3, z + .22]);
  });

  const boltGeometry = cylinderGeometry(.052, .06, 12);
  const washerGeometry = torusGeometry(.075, .014, 6, 14);
  const bolts = new THREE.InstancedMesh(boltGeometry, brushedAluminum, fastenerPositions.length);
  const washers = new THREE.InstancedMesh(washerGeometry, agedGunmetal, fastenerPositions.length);
  const boltRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const matrix = new THREE.Matrix4();
  fastenerPositions.forEach((position, index) => {
    matrix.copy(boltRotation).setPosition(...position);
    bolts.setMatrixAt(index, matrix);
    matrix.identity().setPosition(position[0], position[1], position[2] + .027);
    washers.setMatrixAt(index, matrix);
  });
  bolts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  washers.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bolts.castShadow = false;
  washers.castShadow = false;
  scene.add(bolts, washers);

  const wearGeometry = boxGeometry(.54, .018, .018);
  const wearCount = 52;
  const wear = new THREE.InstancedMesh(wearGeometry, wornEdge, wearCount);
  for (let index = 0; index < wearCount; index += 1) {
    const side = index % 2 ? -1 : 1;
    const layer = index % 4;
    const x = side * (1.15 + layer * 1.35);
    const y = index % 3 === 0 ? 3.31 : -3.31;
    const z = 5.3 - Math.floor(index / 4) * 2.35;
    matrix.makeRotationZ((index % 5 - 2) * .025);
    matrix.setPosition(x, y, z);
    wear.setMatrixAt(index, matrix);
  }
  wear.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  wear.frustumCulled = true;
  scene.add(wear);
}

function createCircuitBackplane(x, y, z, rotationY = 0, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  group.scale.setScalar(scale);

  addBox(group, [2.18, 1.5, .12], [0, 0, 0], agedGunmetal);
  addBox(group, [2.02, 1.34, .055], [0, 0, .09], pcbSubstrate);
  addBox(group, [.68, .44, .13], [-.36, .18, .16], darkPolymer);
  addBox(group, [.42, .32, .16], [.51, -.26, .18], graphite);
  addBox(group, [.28, .22, .14], [.47, .37, .17], machinedMetal);

  for (let index = 0; index < 7; index += 1) {
    const traceX = -.82 + index * .27;
    addBox(group, [.025, .78 - (index % 3) * .12, .018], [traceX, -.05, .135], copperContact);
  }
  for (let index = 0; index < 8; index += 1) {
    addCylinder(
      group,
      .035,
      .06,
      [-.86 + index * .245, -.58, .15],
      index === 6 ? amberDiagnostic : brushedAluminum,
      [Math.PI / 2, 0, 0],
      10
    );
  }
  addBox(group, [.5, .075, .035], [.55, .6, .145], copperContact);
  for (const side of [-1, 1]) {
    for (const vertical of [-1, 1]) {
      addCylinder(group, .045, .055, [side * .94, vertical * .58, .17], brushedAluminum, [Math.PI / 2, 0, 0], 10);
    }
  }
  scene.add(group);
  return group;
}

function createConnectorBank(x, y, z, rotationY = 0, rows = 4) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  addBox(group, [1.15, rows * .42 + .35, .28], [0, 0, 0], graphite);
  addBox(group, [.94, rows * .42 + .12, .035], [0, 0, .17], darkPolymer);
  const bodies = new THREE.InstancedMesh(cylinderGeometry(.12, .27, 16), agedGunmetal, rows);
  const collars = new THREE.InstancedMesh(torusGeometry(.14, .025, 8, 20), brushedAluminum, rows);
  const bodyRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < rows; index += 1) {
    const connectorY = (index - (rows - 1) / 2) * .42;
    matrix.copy(bodyRotation).setPosition(-.25, connectorY, .32);
    bodies.setMatrixAt(index, matrix);
    matrix.identity().setPosition(-.25, connectorY, .47);
    collars.setMatrixAt(index, matrix);
    addBox(group, [.28, .12, .08], [.26, connectorY, .22], index === rows - 1 ? copperContact : edgeMetal);
  }
  bodies.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  collars.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bodies.castShadow = false;
  collars.castShadow = true;
  group.add(bodies, collars);
  scene.add(group);
  return group;
}

function createServoAssembly(x, y, z, facing = 1, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  addBox(group, [1.52, .82, .78], [0, 0, 0], agedGunmetal);
  addBox(group, [1.2, .58, .12], [0, 0, .45], graphite);
  addCylinder(group, .23, 1.16, [facing * 1.18, 0, 0], machinedMetal, [0, 0, Math.PI / 2], 24);
  addCylinder(group, .095, 1.12, [facing * 2.17, 0, 0], brushedAluminum, [0, 0, Math.PI / 2], 18);
  addBox(group, [.28, 1.18, .76], [facing * .91, 0, 0], edgeMetal);
  addBox(group, [.42, .42, .42], [facing * 2.72, 0, 0], machinedMetal);
  addBox(group, [1.94, .12, .9], [0, -.53, 0], deepGraphite);
  for (const side of [-1, 1]) {
    addCylinder(group, .052, .07, [side * .63, .27, .48], brushedAluminum, [Math.PI / 2, 0, 0], 12);
  }
  scene.add(group);
  return group;
}

function createBearingAssembly(x, y, z, radius = .36, rotationY = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  addBox(group, [radius * 2.65, radius * 2.55, .24], [0, 0, -.1], graphite);
  const outer = new THREE.Mesh(torusGeometry(radius, radius * .17, 10, 28), brushedAluminum);
  const inner = new THREE.Mesh(torusGeometry(radius * .58, radius * .1, 8, 22), agedGunmetal);
  outer.position.z = inner.position.z = .16;
  outer.castShadow = inner.castShadow = true;
  group.add(outer, inner);
  addCylinder(group, radius * .22, .34, [0, 0, .14], machinedMetal, [Math.PI / 2, 0, 0], 20);
  for (const angle of [Math.PI / 4, Math.PI * .75, Math.PI * 1.25, Math.PI * 1.75]) {
    addCylinder(
      group,
      .035,
      .05,
      [Math.cos(angle) * radius * .84, Math.sin(angle) * radius * .84, .23],
      brushedAluminum,
      [Math.PI / 2, 0, 0],
      10
    );
  }
  scene.add(group);
  return group;
}

function createHorizontalHeatSink(x, y, z, width = 2.2, rotationZ = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.z = rotationZ;
  addBox(group, [width, .22, 1.24], [0, 0, 0], graphite);
  const finGeometry = boxGeometry(.055, .58, 1.12);
  const count = Math.max(9, Math.floor(width / .13));
  const fins = new THREE.InstancedMesh(finGeometry, machinedMetal, count);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index += 1) {
    matrix.setPosition(-width * .46 + index * (width * .92 / Math.max(1, count - 1)), y > 0 ? -.29 : .29, 0);
    fins.setMatrixAt(index, matrix);
  }
  fins.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  fins.castShadow = true;
  group.add(fins);
  scene.add(group);
}

function createLongitudinalInfrastructure() {
  const rackXs = [-5.85, -4.1, -1.62, 1.62, 4.1, 5.85];
  // Long approach rails hand their load into the dedicated terminal frame
  // before the hinged carriers. The former -25.1 ends occupied the same swept
  // volume as the controls; these dimensions retain the full tunnel rhythm but
  // leave a deliberate service break ahead of the articulation envelope.
  const approachRackLength = 28.1;
  const approachRackCenterZ = -7.95;
  rackXs.forEach((x, index) => {
    const surface = index % 3 === 0 ? machinedMetal : graphite;
    addBox(scene, [.16, .2, approachRackLength], [x, 3.18, approachRackCenterZ], surface);
    addBox(scene, [.16, .2, approachRackLength], [x, -3.18, approachRackCenterZ], surface);
  });
  for (const x of [-5.65, 5.65]) {
    addBox(scene, [.22, 5.6, 30.6], [x, 0, -9.8], deepGraphite);
    addBox(scene, [.08, 5.25, 30.4], [x * .985, 0, -9.65], agedGunmetal);
  }

  const cableRoutes = [
    [[-5.3, 2.65, 5.4], [-4.75, 2.4, 1], [-5.2, 2.1, -5.2], [-4.42, 1.8, -11.8], [-4.9, 2.25, -22.8]],
    [[-5.1, 2.48, 5.2], [-4.55, 2.2, .8], [-5.02, 1.92, -5.4], [-4.22, 1.62, -12], [-4.68, 2.06, -23]],
    [[-4.88, 2.32, 5], [-4.34, 2.02, .6], [-4.8, 1.73, -5.6], [-4.02, 1.43, -12.2], [-4.46, 1.86, -23.2]],
    [[5.25, -2.6, 4.7], [4.6, -2.3, -.4], [5.15, -1.92, -7.1], [4.28, -1.55, -14], [4.82, -2.05, -23.6]],
    [[5.03, -2.43, 4.5], [4.38, -2.12, -.6], [4.92, -1.73, -7.3], [4.05, -1.36, -14.2], [4.58, -1.86, -23.8]],
    [[4.8, -2.26, 4.3], [4.16, -1.94, -.8], [4.68, -1.54, -7.5], [3.82, -1.17, -14.4], [4.34, -1.67, -24]],
    [[-2.45, -2.95, 2.8], [-2.9, -2.72, -2.2], [-2.52, -2.45, -9.4], [-3.05, -2.52, -17.8]],
    [[2.28, 2.92, 2.2], [2.78, 2.65, -3.1], [2.38, 2.35, -10.6], [2.92, 2.48, -18.9]]
  ];
  cableRoutes.forEach((route, index) => addTube(scene, route, index < 6 ? .062 : .045, index % 2 ? braidedCable : cableMaterial));

  createCircuitBackplane(-5.38, .9, -7.7, Math.PI / 2, .84);
  createCircuitBackplane(5.38, -.7, -10.7, -Math.PI / 2, .9);
  createCircuitBackplane(-4.8, -1.65, -17.1, .18, .72);
  createConnectorBank(-4.95, -.05, -1.4, .08, 5);
  createConnectorBank(5.02, .45, -15.2, -.1, 5);
  createConnectorBank(-3.9, 2.1, -21.8, .04, 3);

  createServoAssembly(-3.15, -2.48, -6.4, 1, .72);
  createServoAssembly(3.2, 2.45, -9.8, -1, .74);
  createServoAssembly(-2.8, 2.42, -15.5, 1, .64);
  // A 150 mm-equivalent outboard service offset keeps the servo housing clear
  // of the priorities carrier at the end of its extract-and-hinge motion.
  createServoAssembly(3.2, -2.48, -22.2, -1, .68);

  createBearingAssembly(-4.58, .12, -11.7, .31, .06);
  createBearingAssembly(4.45, 1.35, -5.6, .38, -.08);
  createBearingAssembly(-3.95, -1.55, -20.1, .29, .04);
  createBearingAssembly(4.65, -.5, -23.2, .34, -.05);

  createHorizontalHeatSink(-2.2, 2.87, -2.7, 2.35, .04);
  createHorizontalHeatSink(2.35, -2.87, -7.3, 2.55, -.03);
  createHorizontalHeatSink(-1.8, 2.87, -12.9, 2.1, -.025);
  createHorizontalHeatSink(2.15, -2.87, -17.2, 2.4, .035);
  createHorizontalHeatSink(-4.45, 3.92, -26.78, 1.72, -.025);

  createFastenerAndWearLayer();
}

function createPrecisionGear(parent, options) {
  const {
    radius,
    teeth,
    depth,
    position,
    surface = machinedMetal,
    rotation = 0
  } = options;
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.z = rotation;

  const gearBody = new THREE.Mesh(spurGearGeometry(radius, teeth, depth), surface);
  gearBody.castShadow = radius > .28;
  gearBody.receiveShadow = true;
  gearBody.name = `precision-spur-gear-${teeth}t`;
  group.add(gearBody);
  const bearingRace = new THREE.Mesh(torusGeometry(radius * .35, radius * .062, 10, 30), turnedSteel);
  bearingRace.position.z = depth * .54;
  bearingRace.castShadow = radius > .34;
  group.add(bearingRace);
  if (radius >= .3) {
    const faceRim = new THREE.Mesh(torusGeometry(radius * .7, radius * .035, 8, Math.max(24, teeth * 2)), blackOxideSteel);
    faceRim.position.z = depth * .55;
    faceRim.castShadow = false;
    group.add(faceRim);
    const rearRace = new THREE.Mesh(torusGeometry(radius * .34, radius * .045, 8, 24), gasketRubber);
    rearRace.position.z = -depth * .55;
    group.add(rearRace);
  }
  addCylinder(group, radius * .2, depth * 1.52, [0, 0, 0], turnedSteel, [Math.PI / 2, 0, 0], 24);
  addCylinder(group, radius * .072, depth * 1.82, [0, 0, .02], gasketRubber, [Math.PI / 2, 0, 0], 14);
  addBox(group, [radius * .055, radius * .18, .008], [radius * .12, 0, depth * .79], gasketRubber, [0, 0, .01], "gear-hub-keyway");
  parent.add(group);
  return group;
}

function registerMeshedGearTrain({
  driver,
  driverTeeth,
  meshes = [],
  direction = 1,
  engagementRange = [.66, .9],
  engagementHalfTurns,
  runningSpeed
}) {
  const members = new Map();
  members.set(driver, {
    node: driver,
    teeth: driverTeeth,
    phase: driver.rotation.z,
    angularRatio: 1
  });

  // Each visible external mesh inherits angular travel from its actual parent.
  // The negative sign reverses direction at the contact point; the tooth-count
  // quotient keeps the same number of teeth crossing that point on both gears.
  meshes.forEach(({ node, teeth, meshesWith = driver }) => {
    const parentMember = members.get(meshesWith);
    if (!parentMember) throw new Error("A meshed gear must follow a registered driver");
    members.set(node, {
      node,
      teeth,
      phase: node.rotation.z,
      angularRatio: -parentMember.angularRatio * parentMember.teeth / teeth
    });
  });

  const train = {
    members: [...members.values()],
    direction,
    engagementRange,
    engagementHalfTurns,
    runningSpeed
  };
  continuousGearTrains.push(train);
  return train;
}

function createGearboxModule(x, y, z, scale = 1, rotationY = 0, mirrored = false) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  group.scale.setScalar(scale);
  const direction = mirrored ? -1 : 1;

  addBox(group, [3.65, 2.9, .34], [0, 0, -.42], deepGraphite);
  addBox(group, [3.36, 2.62, .16], [0, 0, -.18], agedGunmetal);
  addApertureRing(group, {
    z: .02,
    outerWidth: 3.48,
    outerHeight: 2.74,
    innerWidth: 2.92,
    innerHeight: 2.16,
    depth: .28,
    surface: gasketRubber
  });
  addApertureRing(group, {
    z: .18,
    outerWidth: 3.62,
    outerHeight: 2.88,
    innerWidth: 3.2,
    innerHeight: 2.46,
    depth: .18,
    surface: blackOxideSteel
  });

  const gearboxDriver = createPrecisionGear(group, {
    radius: .68,
    teeth: 20,
    depth: .28,
    position: [-.58 * direction, .18, .32],
    surface: machinedMetal,
    rotation: .08
  });
  const gearboxUpperDriven = createPrecisionGear(group, {
    radius: .43,
    teeth: 15,
    depth: .25,
    position: [.68 * direction, .52, .34],
    surface: agedGunmetal,
    rotation: -.12
  });
  const gearboxLowerDriven = createPrecisionGear(group, {
    radius: .35,
    teeth: 13,
    depth: .23,
    position: [.52 * direction, -.67, .33],
    surface: machinedMetal,
    rotation: .18
  });
  registerMeshedGearTrain({
    driver: gearboxDriver,
    driverTeeth: 20,
    meshes: [
      { node: gearboxUpperDriven, teeth: 15 },
      { node: gearboxLowerDriven, teeth: 13 }
    ],
    direction,
    engagementHalfTurns: 4.2,
    runningSpeed: .735
  });

  addBox(group, [3.08, 2.3, .035], [0, 0, .58], inspectionGlass);
  addApertureRing(group, {
    z: .61,
    outerWidth: 3.34,
    outerHeight: 2.56,
    innerWidth: 3.04,
    innerHeight: 2.26,
    depth: .11,
    surface: agedGunmetal
  });
  addBox(group, [4.2, .2, .66], [0, -1.62, -.08], graphite);
  addBox(group, [.34, .82, .72], [direction * 2.02, -.96, -.05], machinedMetal);
  addCylinder(group, .18, 1.04, [direction * 2.25, -.43, -.05], agedGunmetal, [0, 0, Math.PI / 2], 20);
  addCylinder(group, .075, .82, [direction * 2.91, -.43, -.05], brushedAluminum, [0, 0, Math.PI / 2], 14);

  const boltPositions = [
    [-1.51, 1.13], [0, 1.23], [1.51, 1.13],
    [-1.51, -1.13], [0, -1.23], [1.51, -1.13]
  ];
  const boltMesh = new THREE.InstancedMesh(cylinderGeometry(.06, .065, 12), brushedAluminum, boltPositions.length);
  const boltRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const matrix = new THREE.Matrix4();
  boltPositions.forEach(([boltX, boltY], index) => {
    matrix.copy(boltRotation).setPosition(boltX, boltY, .72);
    boltMesh.setMatrixAt(index, matrix);
  });
  boltMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  group.add(boltMesh);
  scene.add(group);
  return group;
}

function createPistonBank(x, y, z, count = 4, scale = 1, rotationZ = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.z = rotationZ;
  group.scale.setScalar(scale);
  const spacing = .46;
  const bankWidth = (count - 1) * spacing + .72;

  addBox(group, [bankWidth + .52, .42, .92], [0, -.72, 0], graphite);
  addBox(group, [bankWidth + .2, .16, .68], [0, -.43, .02], machinedMetal);
  const bodyGeometry = cylinderGeometry(.16, .74, 18);
  const rodGeometry = cylinderGeometry(.065, .76, 14);
  const collarGeometry = torusGeometry(.18, .035, 8, 18);
  const bodies = new THREE.InstancedMesh(bodyGeometry, agedGunmetal, count);
  const rods = new THREE.InstancedMesh(rodGeometry, brushedAluminum, count);
  const collars = new THREE.InstancedMesh(collarGeometry, edgeMetal, count);
  const matrix = new THREE.Matrix4();
  const collarRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  for (let index = 0; index < count; index += 1) {
    const pistonX = (index - (count - 1) / 2) * spacing;
    matrix.identity().setPosition(pistonX, -.05, 0);
    bodies.setMatrixAt(index, matrix);
    matrix.identity().setPosition(pistonX, .68 + (index % 2) * .08, 0);
    rods.setMatrixAt(index, matrix);
    matrix.copy(collarRotation).setPosition(pistonX, .34, 0);
    collars.setMatrixAt(index, matrix);
    addTube(
      group,
      [[pistonX, -.42, -.25], [pistonX + (index % 2 ? .12 : -.12), -.82, -.42], [0, -.92, -.46]],
      .025,
      braidedCable
    );
  }
  bodies.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  rods.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  collars.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bodies.castShadow = true;
  rods.castShadow = false;
  group.add(bodies, rods, collars);
  addBox(group, [bankWidth + .82, .13, 1.1], [0, -1.02, 0], deepGraphite);
  addCylinder(group, .11, bankWidth + .64, [0, -.78, -.58], machinedMetal, [0, 0, Math.PI / 2], 16);
  scene.add(group);
  return group;
}

function createBraidedLoom(
  points,
  radius = .035,
  strands = 4,
  turns = 3.2,
  surface = braidedCable,
  clampFractions = [.18, .43, .68, .9]
) {
  const baseCurve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  const terminalHero = points.every(point => point[2] < -25.2);
  const samples = baseCurve.getPoints(terminalHero ? 64 : 44);
  const group = new THREE.Group();
  const tangent = new THREE.Vector3();
  const normalA = new THREE.Vector3();
  const normalB = new THREE.Vector3();

  for (let strand = 0; strand < strands; strand += 1) {
    const strandPoints = samples.map((point, index) => {
      const t = index / Math.max(1, samples.length - 1);
      baseCurve.getTangent(t, tangent).normalize();
      normalA.set(-tangent.y, tangent.x, 0);
      if (normalA.lengthSq() < .01) normalA.set(1, 0, 0);
      normalA.normalize();
      normalB.crossVectors(tangent, normalA).normalize();
      const phase = t * Math.PI * 2 * turns + strand / strands * Math.PI * 2;
      return point.clone()
        .addScaledVector(normalA, Math.cos(phase) * radius * 1.9)
        .addScaledVector(normalB, Math.sin(phase) * radius * 1.9);
    });
    const strandCurve = new THREE.CatmullRomCurve3(strandPoints, false, "centripetal", .5);
    const geometry = new THREE.TubeGeometry(
      strandCurve,
      terminalHero ? 112 : 72,
      radius,
      terminalHero ? 7 : 5,
      false
    );
    geometryCache.set(`braid:${geometry.id}`, geometry);
    const mesh = new THREE.Mesh(geometry, strand % 3 === 0 ? cableMaterial : surface);
    mesh.castShadow = radius >= .035;
    mesh.receiveShadow = terminalHero;
    group.add(mesh);
  }

  const clampGeometry = torusGeometry(radius * strands * 1.4, radius * .38, 6, 16);
  const clamps = new THREE.InstancedMesh(clampGeometry, machinedMetal, clampFractions.length);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const quaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3(1, 1, 1);
  clampFractions.forEach((fraction, index) => {
    const point = baseCurve.getPointAt(fraction);
    baseCurve.getTangentAt(fraction, tangent).normalize();
    quaternion.setFromUnitVectors(zAxis, tangent);
    matrix.compose(point, quaternion, scale);
    clamps.setMatrixAt(index, matrix);
  });
  clamps.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  group.add(clamps);

  if (terminalHero) {
    const yAxis = new THREE.Vector3(0, 1, 0);
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (const fraction of [0, 1]) {
      const endpoint = baseCurve.getPointAt(fraction);
      const endpointTangent = baseCurve.getTangentAt(fraction).normalize();
      if (fraction === 0) endpointTangent.multiplyScalar(-1);
      const sleeve = new THREE.Mesh(
        cylinderGeometry(radius * strands * .66, .24, 20),
        blackOxideSteel
      );
      sleeve.name = "hero-loom-crimp-ferrule";
      sleeve.position.copy(endpoint).addScaledVector(endpointTangent, -.055);
      sleeve.quaternion.setFromUnitVectors(yAxis, endpointTangent);
      sleeve.castShadow = true;
      sleeve.receiveShadow = true;
      group.add(sleeve);
      const gland = new THREE.Mesh(
        torusGeometry(radius * strands * .72, radius * .36, 8, 24),
        turnedSteel
      );
      gland.name = "hero-loom-strain-relief-gland";
      gland.position.copy(endpoint).addScaledVector(endpointTangent, -.17);
      gland.quaternion.setFromUnitVectors(zAxis, endpointTangent);
      gland.castShadow = false;
      group.add(gland);
    }
  }
  scene.add(group);
  return group;
}

function createGrimeAndClampLayer() {
  const floorGeometry = boxGeometry(.78, .022, .035);
  const wallGeometry = boxGeometry(.025, .62, .54);
  const floorPatches = new THREE.InstancedMesh(floorGeometry, grimeSurface, 48);
  const wallPatches = new THREE.InstancedMesh(wallGeometry, grimeSurface, 36);
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  for (let index = 0; index < 48; index += 1) {
    const side = index % 2 ? -1 : 1;
    const x = side * (.8 + (index % 7) * .68);
    const y = index % 3 === 0 ? 3.305 : -3.305;
    const z = 4.6 - Math.floor(index / 4) * 2.45;
    quaternion.setFromEuler(new THREE.Euler(0, (index % 5 - 2) * .08, (index % 4 - 1.5) * .03));
    scale.set(.55 + (index % 5) * .12, 1, .72 + (index % 3) * .2);
    matrix.compose(new THREE.Vector3(x, y, z), quaternion, scale);
    floorPatches.setMatrixAt(index, matrix);
  }
  for (let index = 0; index < 36; index += 1) {
    const side = index % 2 ? -1 : 1;
    const x = side * 5.525;
    const y = -2.35 + (index % 6) * .9;
    const z = 3.5 - Math.floor(index / 3) * 2.5;
    quaternion.setFromEuler(new THREE.Euler((index % 3 - 1) * .06, 0, (index % 5 - 2) * .04));
    scale.set(1, .6 + (index % 4) * .18, .65 + (index % 3) * .16);
    matrix.compose(new THREE.Vector3(x, y, z), quaternion, scale);
    wallPatches.setMatrixAt(index, matrix);
  }
  floorPatches.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  wallPatches.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  floorPatches.renderOrder = wallPatches.renderOrder = 2;
  scene.add(floorPatches, wallPatches);

  const clampGeometry = boxGeometry(.42, .16, .28);
  const clampCount = 44;
  const clamps = new THREE.InstancedMesh(clampGeometry, machinedMetal, clampCount);
  for (let index = 0; index < clampCount; index += 1) {
    const side = index % 2 ? -1 : 1;
    const x = side * (4.45 + (index % 3) * .26);
    const y = side * (1.45 + (index % 4) * .34);
    const z = 4.2 - Math.floor(index / 2) * 1.34;
    matrix.makeRotationY(side * .12);
    matrix.setPosition(x, y, z);
    clamps.setMatrixAt(index, matrix);
  }
  clamps.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  clamps.castShadow = false;
  scene.add(clamps);
}

function createLayeredSupportStructures() {
  const stations = [4.5, 1.1, -2.6, -6.5, -10.6, -14.8, -19.1, -23.4];
  stations.forEach((z, index) => {
    const inset = index % 2 ? .2 : 0;
    addBox(scene, [2.7, .18, .5], [-4.32 + inset, 2.72, z], index % 3 ? graphite : machinedMetal, [0, .05, -.08]);
    addBox(scene, [2.7, .18, .5], [4.32 - inset, -2.72, z], index % 3 ? graphite : machinedMetal, [0, -.05, .08]);
    addBox(scene, [.18, 1.72, .48], [-5.1, .92, z - .12], agedGunmetal, [0, 0, -.38]);
    addBox(scene, [.18, 1.72, .48], [5.1, -.92, z - .12], agedGunmetal, [0, 0, -.38]);
    addBox(scene, [1.8, .12, .22], [-4.55, -2.45, z + .18], edgeMetal, [0, 0, .14]);
    addBox(scene, [1.8, .12, .22], [4.55, 2.45, z + .18], edgeMetal, [0, 0, .14]);
  });

  createGearboxModule(-4.15, -1.65, -4.45, .68, .08, false);
  createGearboxModule(4.12, 1.55, -13.9, .72, -.08, true);
  createGearboxModule(-4.64, 1.42, -26.72, .5, .035, true);
  createPistonBank(-2.7, -2.32, -3.9, 5, .7, -.08);
  createPistonBank(2.75, 2.35, -12.7, 4, .74, Math.PI - .05);
  createPistonBank(-2.4, 2.34, -19.2, 5, .65, Math.PI + .06);
  // Three full-scale cylinders occupy the lower service pocket: below the
  // carrier sweep, outside the cable loom, and seated on the existing tray.
  createPistonBank(3.4, -3.2, -23.4, 3, .68, .05);

  createBraidedLoom([
    [-5.02, .3, 4.8], [-4.35, .52, -.5], [-4.88, -.12, -6.4], [-3.86, .46, -12.8], [-4.62, .18, -22.7]
  ], .029, 5, 4.1);
  createBraidedLoom([
    [5.08, -.15, 3.8], [4.25, -.5, -2.1], [4.92, .08, -8.2], [3.95, -.42, -15.4], [4.55, -.1, -24.1]
  ], .03, 5, 4.4);
  createBraidedLoom([
    [-1.8, 2.72, 2.4], [-.8, 2.72, -3.2], [-1.35, 3.18, -9.7], [-.55, 3.86, -16.6], [-1.08, 4.34, -23.2]
  ], .024, 4, 3.6, cableMaterial);

  createGrimeAndClampLayer();
}

function createSuspendedParticulate() {
  const count = 180;
  const positions = new Float32Array(count * 3);
  let seed = 1847;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (random() - .5) * 10.8;
    positions[index * 3 + 1] = (random() - .5) * 5.6;
    positions[index * 3 + 2] = 5.5 - random() * 31;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometryCache.set(`particulate:${geometry.id}`, geometry);
  const surface = new THREE.PointsMaterial({
    color: 0xb8aa91,
    size: .018,
    sizeAttenuation: true,
    transparent: true,
    opacity: .2,
    depthWrite: false
  });
  disposableMaterials.add(surface);
  const points = new THREE.Points(geometry, surface);
  points.frustumCulled = true;
  scene.add(points);
}

function addCarrierFace(group, width, height, supportSide = "left") {
  addBeveledRing(group, {
    outerWidth: width + .22,
    outerHeight: height + .22,
    innerWidth: width + .06,
    innerHeight: height + .06,
    depth: .3,
    position: [0, 0, -.3],
    // The carrier's load-bearing flange is black-oxide steel. Keeping this
    // broad ring dark leaves the nickel retaining lip to supply a narrow,
    // physically plausible highlight instead of a white picture-frame halo.
    surface: blackOxideSteel,
    radius: .1,
    bevel: .02
  });
  addBeveledRing(group, {
    outerWidth: width + .1,
    outerHeight: height + .1,
    innerWidth: width + .02,
    innerHeight: height + .02,
    depth: .14,
    position: [0, 0, -.08],
    surface: gasketRubber,
    radius: .085,
    bevel: .012
  });
  // The web form occupies the real pressure well rather than floating above
  // the carrier. The outer plate, shadow well and front retaining bezel remain
  // visible around the projected DOM aperture at every viewing angle.
  addBox(group, [width, height, .34], [0, 0, -.02], graphite);
  addBeveledPanel(group, [width - .18, height - .18, .1], [0, 0, .18], darkPolymer, .06, .015);
  addBeveledRing(group, {
    outerWidth: width - .08,
    outerHeight: height - .08,
    innerWidth: width - .5,
    innerHeight: height - .5,
    depth: .16,
    position: [0, 0, .34],
    surface: agedGunmetal,
    radius: .075,
    bevel: .016
  });
  addBeveledRing(group, {
    outerWidth: width - .27,
    outerHeight: height - .27,
    innerWidth: width - .5,
    innerHeight: height - .5,
    depth: .055,
    position: [0, 0, .43],
    surface: gasketRubber,
    radius: .06,
    bevel: .008
  });
  addBeveledRing(group, {
    outerWidth: width - .34,
    outerHeight: height - .34,
    innerWidth: width - .84,
    innerHeight: height - .84,
    depth: .075,
    position: [0, 0, .475],
    surface: blackOxideSteel,
    radius: .052,
    bevel: .008
  });
  addBeveledRing(group, {
    outerWidth: width - .43,
    outerHeight: height - .43,
    innerWidth: width - .84,
    innerHeight: height - .84,
    depth: .035,
    position: [0, 0, .52],
    surface: blackOxideSteel,
    radius: .045,
    bevel: .005
  });
  // Short replaceable contact shoes catch narrow highlights without creating a
  // bright continuous picture frame around the electronic display.
  const contactLength = Math.max(.22, width * .19);
  for (const x of [-width * .27, width * .27]) {
    addBox(group, [contactLength, .026, .018], [x, height * .5 - .235, .552], turnedSteel);
    addBox(group, [contactLength, .026, .018], [x, -height * .5 + .235, .552], turnedSteel);
  }
  // Only the polished edge of the cover glass is Three.js geometry. The live
  // interactive pixels remain DOM, while this narrow ring catches a physical
  // highlight exactly inside the nickel retaining lip.
  addBeveledRing(group, {
    outerWidth: width - .78,
    outerHeight: height - .78,
    innerWidth: width - .84,
    innerHeight: height - .84,
    depth: .018,
    position: [0, 0, .545],
    surface: inspectionGlass,
    radius: .028,
    bevel: 0,
    name: "interactive-display-glass-edge"
  });
  addBox(group, [width - .58, .035, .035], [0, height * .5 - .31, .445], wornEdge);
  addBox(group, [width - .58, .035, .035], [0, -height * .5 + .31, .445], wornEdge);
  addBox(group, [.12, height + .2, .42], [-width * .5 - .11, 0, -.31], edgeMetal);
  addBox(group, [.12, height + .2, .42], [width * .5 + .11, 0, -.31], edgeMetal);
  addBox(group, [width + .25, .12, .42], [0, -height * .5 - .09, -.32], graphite);
  addBox(group, [width + .25, .12, .42], [0, height * .5 + .09, -.32], graphite);
  addBox(group, [width * .76, .11, .18], [0, 0, -.52], brushedAluminum, [0, 0, .02]);
  addBox(group, [width * .58, .085, .08], [0, -height * .18, .11], wornEdge, [0, 0, -.018]);
  addBox(group, [width * .36, .035, .035], [-width * .14, height * .22, .12], oilFilm, [0, 0, .025]);
  for (const x of [-width * .43, width * .43]) {
    for (const y of [-height * .39, height * .39]) {
      addCylinder(group, .04, .06, [x, y, .25], edgeMetal, [Math.PI / 2, 0, 0], 10);
    }
  }

  const isBottomSupport = supportSide === "bottom";
  const supportDirection = supportSide === "left" ? -1 : 1;
  const sideDriveOffset = supportSide === "right" ? .02 : .28;
  const sideSupportOffset = supportSide === "right" ? .04 : .3;
  const serviceDrive = new THREE.Group();
  if (isBottomSupport) {
    serviceDrive.position.set(width * .22, -height * .5 + .46, -.08);
    serviceDrive.rotation.z = Math.PI / 2;
  } else {
    serviceDrive.position.set(supportDirection * (width * .5 + sideDriveOffset), -height * .18, -.08);
  }
  const primaryServiceGear = createPrecisionGear(serviceDrive, {
    radius: .23,
    teeth: 11,
    depth: .14,
    position: [0, .16, .12],
    surface: machinedMetal,
    rotation: .08
  });
  const secondaryServiceGear = createPrecisionGear(serviceDrive, {
    radius: .16,
    teeth: 9,
    depth: .12,
    position: [-supportDirection * .34, -.16, .11],
    surface: agedGunmetal,
    rotation: -.12
  });
  registerMeshedGearTrain({
    driver: primaryServiceGear,
    driverTeeth: 11,
    meshes: [{ node: secondaryServiceGear, teeth: 9 }],
    direction: supportDirection,
    engagementHalfTurns: 3.9,
    runningSpeed: .7125
  });
  addBox(serviceDrive, [.92, .78, .16], [-supportDirection * .08, 0, -.14], deepGraphite);
  addBox(serviceDrive, [1.08, .12, .38], [-supportDirection * .04, -.48, -.12], edgeMetal);
  group.add(serviceDrive);

  if (isBottomSupport) {
    const supportY = -height * .5 + .46;
    addCylinder(group, .1, width * .72, [0, supportY, -.5], agedGunmetal, [0, 0, Math.PI / 2], 16);
    addCylinder(group, .045, width * .66, [.04, supportY, -.49], brushedAluminum, [0, 0, Math.PI / 2], 12);
    addTube(group, [
      [-width * .34, supportY - .02, -.4],
      [-width * .08, supportY - .16, -.52],
      [width * .31, supportY + .02, -.46]
    ], .025, braidedCable);
  } else {
    const supportX = supportDirection * (width * .5 + sideSupportOffset);
    addCylinder(group, .1, height * .72, [supportX, 0, -.5], agedGunmetal, null, 16);
    addCylinder(group, .045, height * .66, [supportX, .04, -.49], brushedAluminum, null, 12);
    addTube(group, [
      [supportX, height * .34, -.4],
      [supportDirection * (width * .5 + sideSupportOffset + .18), height * .12, -.52],
      [supportX, -height * .32, -.46]
    ], .025, braidedCable);
  }
}

function addForegroundInstanceBatch(parent, {
  name,
  geometry,
  surface,
  transforms
}) {
  const instances = new THREE.InstancedMesh(geometry, surface, transforms.length);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Euler();
  transforms.forEach((transform, index) => {
    position.fromArray(transform.position);
    rotation.fromArray(transform.rotation || [0, 0, 0]);
    quaternion.setFromEuler(rotation);
    scale.fromArray(transform.scale || [1, 1, 1]);
    matrix.compose(position, quaternion, scale);
    instances.setMatrixAt(index, matrix);
  });
  instances.name = name;
  instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  instances.instanceMatrix.needsUpdate = true;
  // The root receives a copied world matrix after the main scene has rendered.
  // Disabling local culling prevents a stale pre-copy bound from dropping a
  // jaw for one frame while a carrier swings or the result lift docks.
  instances.frustumCulled = false;
  instances.castShadow = false;
  instances.receiveShadow = true;
  instances.renderOrder = 24;
  parent.add(instances);
  return instances;
}

function registerCarrierForegroundOverlay(source, name, width, height, supportSide) {
  if (!foregroundScene || !source) return;
  const overlay = new THREE.Group();
  overlay.name = `${name}-foreground-retention-hardware`;
  overlay.matrixAutoUpdate = false;

  const panelWidth = width - .84;
  const panelHeight = height - .84;
  const halfWidth = panelWidth * .5;
  const halfHeight = panelHeight * .5;
  const jawSpan = clamp(width * .13, .23, .38);
  const jawDepth = .105;
  const horizontalJaws = [];
  const verticalJaws = [];
  const gasketSeats = [];
  const lockWashers = [];
  const lockBolts = [];
  const boltSlots = [];

  for (const sideX of [-1, 1]) {
    for (const sideY of [-1, 1]) {
      const boltX = sideX * (halfWidth - .13);
      const boltY = sideY * (halfHeight - .13);
      horizontalJaws.push({
        position: [sideX * (halfWidth - jawSpan * .44), sideY * (halfHeight - .025), .585],
        scale: [jawSpan, .11, jawDepth]
      });
      verticalJaws.push({
        position: [sideX * (halfWidth - .025), sideY * (halfHeight - jawSpan * .44), .586],
        scale: [.11, jawSpan, jawDepth]
      });
      gasketSeats.push({
        position: [boltX, boltY, .535],
        rotation: [0, 0, sideX * sideY * .035],
        scale: [.24, .24, .026]
      });
      lockWashers.push({ position: [boltX, boltY, .644] });
      lockBolts.push({
        position: [boltX, boltY, .664],
        rotation: [Math.PI / 2, 0, 0]
      });
      boltSlots.push({
        position: [boltX, boltY, .688],
        rotation: [0, 0, sideX * sideY * .18],
        scale: [.054, .011, .009]
      });
    }
  }

  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-horizontal-jaws`,
    geometry: boxGeometry(1, 1, 1),
    surface: blackOxideSteel,
    transforms: horizontalJaws
  });
  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-vertical-jaws`,
    geometry: boxGeometry(1, 1, 1),
    surface: blackOxideSteel,
    transforms: verticalJaws
  });
  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-gasket-seats`,
    geometry: boxGeometry(1, 1, 1),
    surface: gasketRubber,
    transforms: gasketSeats
  });
  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-lock-washers`,
    geometry: torusGeometry(.052, .012, 8, 22),
    surface: nickelSteel,
    transforms: lockWashers
  });
  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-lock-bolts`,
    geometry: cylinderGeometry(.035, .04, 14),
    surface: nickelSteel,
    transforms: lockBolts
  });
  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-bolt-slots`,
    geometry: boxGeometry(1, 1, 1),
    surface: deepGraphite,
    transforms: boltSlots
  });

  // Replaceable spring shoes cross the glass boundary by only a few
  // millimetres. Their selective nickel highlight makes the display read as a
  // captured component without drawing a bright decorative frame around it.
  const shoeLength = clamp(width * .16, .22, .64);
  const springShoes = [];
  for (const sideX of [-1, 1]) {
    for (const sideY of [-1, 1]) {
      springShoes.push({
        position: [sideX * panelWidth * .22, sideY * (halfHeight - .012), .647],
        rotation: [0, 0, sideX * sideY * .012],
        scale: [shoeLength, .034, .026]
      });
    }
  }
  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-spring-shoes`,
    geometry: boxGeometry(1, 1, 1),
    surface: nickelSteel,
    transforms: springShoes
  });

  // Each carrier keeps its authored mechanical identity: the course and
  // meeting displays lock from their hinge side, while the priorities and
  // result displays settle onto lower saddles. These tabs also provide the
  // unmistakable local occlusion that a single rear WebGL pass cannot make.
  const supportDirection = supportSide === "left" ? -1 : 1;
  const supportLatches = [];
  const supportWitnesses = [];
  if (supportSide === "bottom") {
    for (const sideX of [-1, 1]) {
      supportLatches.push({
        position: [sideX * panelWidth * .27, -halfHeight + .018, .592],
        scale: [.36, .14, .13]
      });
      supportWitnesses.push({
        position: [sideX * panelWidth * .27, -halfHeight + .048, .668],
        scale: [.22, .028, .025]
      });
    }
  } else {
    for (const sideY of [-1, 1]) {
      supportLatches.push({
        position: [supportDirection * (halfWidth - .018), sideY * panelHeight * .22, .592],
        scale: [.14, .36, .13]
      });
      supportWitnesses.push({
        position: [supportDirection * (halfWidth - .048), sideY * panelHeight * .22, .668],
        scale: [.028, .22, .025]
      });
    }
  }
  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-support-latches`,
    geometry: boxGeometry(1, 1, 1),
    surface: milledBlackSteel,
    transforms: supportLatches
  });
  addForegroundInstanceBatch(overlay, {
    name: `${name}-foreground-support-witnesses`,
    geometry: boxGeometry(1, 1, 1),
    surface: turnedSteel,
    transforms: supportWitnesses
  });

  foregroundScene.add(overlay);
  foregroundCarrierOverlays.push({ name, source, overlay, hasSafePose: false });
}

function createCarrier(name, width, height, supportSide) {
  const group = new THREE.Group();
  group.name = `${name}-carrier`;
  addCarrierFace(group, width, height, supportSide);
  // Reserve a real retaining lip around the live DOM display. The projected
  // controls terminate inside this opening instead of covering the carrier's
  // machined front edge.
  const panelWidth = width - .84;
  const panelHeight = height - .84;
  const panelZ = .28;
  const center = new THREE.Object3D();
  center.position.set(0, 0, panelZ);
  center.name = `${name}-panel-anchor`;
  group.add(center);
  const displaySpill = new THREE.PointLight(0xe4dac8, 0, 2.8, 2);
  displaySpill.position.set(0, 0, .7);
  displaySpill.name = `${name}-display-spill`;
  group.add(displaySpill);
  panelSpillLights.set(name, displaySpill);
  const corners = [
    [-panelWidth * .5, panelHeight * .5, panelZ],
    [panelWidth * .5, panelHeight * .5, panelZ],
    [panelWidth * .5, -panelHeight * .5, panelZ],
    [-panelWidth * .5, -panelHeight * .5, panelZ]
  ].map((position, index) => {
    const corner = new THREE.Object3D();
    corner.position.set(position[0], position[1], position[2]);
    corner.name = `${name}-panel-corner-${index}`;
    group.add(corner);
    return corner;
  });
  anchors.set(name, {
    center,
    corners,
    worldCorners: corners.map(() => new THREE.Vector3()),
    projectedCorners: corners.map(() => new THREE.Vector3()),
    screenQuad: corners.map(() => ({ x: 0, y: 0 })),
    output: {
      x: 0,
      y: 0,
      scale: 1,
      facing: 0,
      visible: false,
      quad: null
    }
  });
  scene.add(group);
  registerCarrierForegroundOverlay(group, name, width, height, supportSide);
  return group;
}

function createResultTerminalLift() {
  const guideAssembly = new THREE.Group();
  guideAssembly.name = "result-terminal-guide-assembly";
  guideAssembly.position.z = RESULT_TERMINAL.worldZ;

  // Twin ground rails and outboard lead screws are carried on the front face
  // of the portal. Their z envelope is wholly ahead of the portal fasteners,
  // while their x envelope remains outside the fourth display's retaining
  // flange. This is a real lift path, not decorative hardware painted behind
  // a DOM rectangle.
  for (const side of [-1, 1]) {
    const guideX = side * RESULT_TERMINAL.guideX;
    const screwX = side * RESULT_TERMINAL.screwX;
    addBeveledPanel(
      guideAssembly,
      [.16, RESULT_TERMINAL.guideHeight, .24],
      [guideX, RESULT_TERMINAL.guideCenterY, -.36],
      blackOxideSteel,
      .045,
      .012,
      `result-terminal-guide-${side < 0 ? "left" : "right"}`
    );
    addBox(
      guideAssembly,
      [.032, RESULT_TERMINAL.guideHeight - .42, .045],
      [guideX - side * .014, RESULT_TERMINAL.guideCenterY, -.214],
      turnedSteel,
      null,
      "result-terminal-guide-wear-strip"
    );
    const screwLength = RESULT_TERMINAL.guideHeight - .34;
    const screwAssembly = new THREE.Group();
    screwAssembly.name = `result-terminal-lead-screw-${side < 0 ? "left" : "right"}`;
    screwAssembly.position.set(screwX, RESULT_TERMINAL.guideCenterY, -.39);
    addCylinder(
      screwAssembly,
      RESULT_TERMINAL.screwRootRadius,
      screwLength,
      [0, 0, 0],
      blackOxideSteel,
      null,
      24
    ).name = "result-terminal-lead-screw-root";
    const thread = new THREE.Mesh(
      helicalThreadGeometry(
        screwLength,
        RESULT_TERMINAL.screwLead,
        (RESULT_TERMINAL.screwRootRadius + RESULT_TERMINAL.screwOuterRadius) * .5,
        (RESULT_TERMINAL.screwOuterRadius - RESULT_TERMINAL.screwRootRadius) * .5,
        side
      ),
      turnedSteel
    );
    thread.name = "result-terminal-helical-thread";
    thread.castShadow = false;
    thread.receiveShadow = true;
    screwAssembly.add(thread);
    guideAssembly.add(screwAssembly);
    resultLeadScrews.push({ node: screwAssembly, handedness: side });

    for (const y of [5.02, -12.82]) {
      // The screw axis is vertical (world Y), so the bearing aperture must be
      // cut in XZ and the housing depth must run along Y. A rotated extruded
      // ring provides the real bore; the former solid plate let the screw pass
      // through metal and placed a decorative race on the wrong axis.
      const bearingHousing = new THREE.Group();
      bearingHousing.name = "result-terminal-screw-bearing";
      bearingHousing.position.set(screwX, y, -.39);
      bearingHousing.rotation.x = Math.PI / 2;
      addBeveledRing(bearingHousing, {
        outerWidth: .58,
        outerHeight: .44,
        innerWidth: .28,
        innerHeight: .28,
        depth: .48,
        position: [0, 0, 0],
        surface: deepGraphite,
        radius: .09,
        bevel: .02,
        name: "result-terminal-screw-bearing-housing"
      });
      for (const axialOffset of [-.21, .21]) {
        const bearingRace = new THREE.Mesh(
          torusGeometry(.11, .024, 10, 34),
          machinedMetal
        );
        bearingRace.name = "result-terminal-screw-bearing-race";
        bearingRace.position.z = axialOffset;
        bearingRace.castShadow = false;
        bearingRace.receiveShadow = true;
        bearingHousing.add(bearingRace);
      }
      guideAssembly.add(bearingHousing);
    }

    // Short stand-offs establish a visible load path back to the portal but
    // stop outboard of the screen aperture and behind the moving slide rings.
    for (const y of [-4.46, 4.46]) {
      addBox(
        guideAssembly,
        [.54, .22, .32],
        [side * 6.02, y, -.74],
        milledBlackSteel,
        null,
        "result-terminal-guide-standoff"
      );
      addCylinder(
        guideAssembly,
        .045,
        .16,
        [side * 6.02, y, -.65],
        turnedSteel,
        [Math.PI / 2, 0, 0],
        12
      ).name = "result-terminal-guide-standoff-fastener";
    }
  }
  scene.add(guideAssembly);

  resultLift = new THREE.Group();
  resultLift.name = "result-terminal-lift-carriage";
  resultLift.position.set(0, RESULT_TERMINAL.stowedY, RESULT_TERMINAL.worldZ);

  resultCarrier = createCarrier(
    "result",
    RESULT_TERMINAL.width,
    RESULT_TERMINAL.height,
    "bottom"
  );
  scene.remove(resultCarrier);
  resultLift.add(resultCarrier);

  // Each lift nut has a genuine clearance opening around its screw. A stepped
  // dog-leg reaches forward around the guide rail before returning to the
  // carrier, so no solid connector occupies the same x/z volume as the rail.
  for (const side of [-1, 1]) {
    const nut = new THREE.Group();
    nut.name = `result-terminal-ball-nut-${side < 0 ? "left" : "right"}`;
    nut.position.set(side * RESULT_TERMINAL.screwX, -1.95, -.39);
    nut.rotation.x = Math.PI / 2;
    addBeveledRing(nut, {
      outerWidth: .3,
      outerHeight: .3,
      innerWidth: .17,
      innerHeight: .19,
      depth: .3,
      position: [0, 0, 0],
      surface: greasedBronze,
      radius: .055,
      bevel: .012,
      name: "result-terminal-ball-nut-body"
    });
    resultLift.add(nut);
    addBeveledPanel(
      resultLift,
      [.18, .28, .46],
      [side * 6.03, -1.95, -.16],
      milledBlackSteel,
      .045,
      .012,
      "result-terminal-nut-dogleg-outboard"
    );
    addBeveledPanel(
      resultLift,
      [.56, .28, .16],
      [side * 5.8, -1.95, .08],
      blackOxideSteel,
      .04,
      .01,
      "result-terminal-nut-dogleg-bridge"
    );
    addBeveledPanel(
      resultLift,
      [.18, .28, .42],
      [side * 5.55, -1.95, -.11],
      milledBlackSteel,
      .045,
      .012,
      "result-terminal-nut-dogleg-inboard"
    );
  }

  // Four bored slide shoes wrap the ground rails. The rail passes through the
  // negative space in each ring, avoiding the common visual bug where a solid
  // bearing block and its guide occupy the same volume.
  for (const side of [-1, 1]) {
    for (const y of [-2.64, 2.64]) {
      const slideShoe = new THREE.Group();
      slideShoe.name = "result-terminal-recirculating-slide";
      slideShoe.position.set(side * RESULT_TERMINAL.guideX, y, -.36);
      slideShoe.rotation.x = Math.PI / 2;
      addBeveledRing(slideShoe, {
        outerWidth: .42,
        outerHeight: .48,
        innerWidth: .22,
        innerHeight: .3,
        depth: .66,
        position: [0, 0, 0],
        surface: machinedMetal,
        radius: .075,
        bevel: .014,
        name: "result-terminal-recirculating-slide-shoe"
      });
      resultLift.add(slideShoe);
      addBox(
        resultLift,
        [.28, .22, .34],
        [side * 5.58, y, -.34],
        blackOxideSteel,
        null,
        "result-terminal-slide-tie"
      );
      addCylinder(
        resultLift,
        .032,
        .09,
        [side * 5.72, y - .22, -.17],
        turnedSteel,
        [Math.PI / 2, 0, 0],
        10
      ).name = "result-terminal-slide-fastener";
    }
  }

  // A shallow lower saddle transfers the carrier load into both slide pairs.
  // It remains below the live display aperture and therefore never needs a DOM
  // occlusion workaround.
  addBeveledPanel(
    resultLift,
    [10.3, .3, .42],
    [0, -3.78, -.34],
    milledBlackSteel,
    .075,
    .018,
    "result-terminal-lower-saddle"
  );
  for (const x of [-4.84, 4.84]) {
    addBeveledPanel(
      resultLift,
      [.54, .46, .34],
      [x, -3.68, -.16],
      deepGraphite,
      .08,
      .018,
      "result-terminal-docking-foot"
    );
    addCylinder(
      resultLift,
      .048,
      .15,
      [x, -3.68, .045],
      turnedSteel,
      [Math.PI / 2, 0, 0],
      12
    ).name = "result-terminal-docking-foot-fastener";
  }

  // A compact lubrication pump remains alive after docking. It is separate
  // from the lift screws (which correctly stop with the carriage), giving the
  // settled result terminal one physically credible continuous mechanism and
  // a visible tooth-contact source for intermittent sparks below the screen.
  addBeveledPanel(
    resultLift,
    [1.08, .58, .18],
    [4.14, -4.2, .13],
    deepGraphite,
    .08,
    .018,
    "result-terminal-lubrication-pump-bed"
  );
  resultSparkDriverGear = createPrecisionGear(resultLift, {
    radius: .21,
    teeth: 14,
    depth: .15,
    position: [3.96, -4.2, .46],
    surface: blackOxideSteel,
    rotation: 0
  });
  resultSparkDriverGear.name = "result-terminal-pump-driver-14t";
  resultSparkDrivenGear = createPrecisionGear(resultLift, {
    radius: .15,
    teeth: 10,
    depth: .14,
    position: [4.32, -4.2, .46],
    surface: phosphorBronze,
    rotation: Math.PI / 10
  });
  resultSparkDrivenGear.name = "result-terminal-pump-driven-10t";
  addCylinder(
    resultLift,
    .07,
    .34,
    [3.96, -4.2, .24],
    turnedSteel,
    [Math.PI / 2, 0, 0],
    18
  ).name = "result-terminal-pump-driver-shaft";
  addCylinder(
    resultLift,
    .055,
    .32,
    [4.32, -4.2, .24],
    turnedSteel,
    [Math.PI / 2, 0, 0],
    18
  ).name = "result-terminal-pump-driven-shaft";
  scene.add(resultLift);
}

function createTerminalCarrierBay(name, x, y, width, height) {
  const bay = new THREE.Group();
  bay.name = `${name}-terminal-bay`;
  bay.position.set(x, y, -26.12);
  addApertureRing(bay, {
    z: .08,
    outerWidth: width + .14,
    outerHeight: height + .14,
    innerWidth: width - .08,
    innerHeight: height - .08,
    depth: .16,
    surface: blackOxideSteel
  });
  // The carrier nests into an actual pressure cavity. Its rear plate is set
  // back from the beam face and joined by four visible return walls.
  addBeveledPanel(bay, [width - .26, height - .26, .1], [0, 0, -.43], deepGraphite, .07, .012, `${name}-bay-recess`);
  addBox(bay, [.11, height - .26, .48], [-width * .5 + .12, 0, -.18], graphite);
  addBox(bay, [.11, height - .26, .48], [width * .5 - .12, 0, -.18], graphite);
  addBox(bay, [width - .26, .11, .48], [0, height * .5 - .12, -.18], graphite);
  addBox(bay, [width - .26, .11, .48], [0, -height * .5 + .12, -.18], graphite);
  addBox(bay, [width * .62, .055, .04], [0, -height * .22, -.36], wornEdge, [0, 0, -.018]);
  for (const side of [-1, 1]) {
    addBox(bay, [.085, height - .42, .18], [side * (width * .5 - .18), 0, .23], edgeMetal);
    addBox(bay, [.035, height - .62, .06], [side * (width * .5 - .1), 0, .35], copperContact);
  }
  for (const xOffset of [-width * .42, width * .42]) {
    for (const yOffset of [-height * .41, height * .41]) {
      addCylinder(bay, .045, .075, [xOffset, yOffset, .28], brushedAluminum, [Math.PI / 2, 0, 0], 12);
    }
  }
  scene.add(bay);
  return bay;
}

function addVerticalHingeHardware(x, y, z, height, side) {
  addCylinder(scene, .16, height, [x, y, z], agedGunmetal, null, 24);
  for (const offset of [-height * .34, 0, height * .34]) {
    addCylinder(scene, .225, .36, [x, y + offset, z], machinedMetal, null, 24);
    addCylinder(scene, .09, .44, [x, y + offset, z + .015], brushedAluminum, null, 18);
  }
  addBox(scene, [.72, .42, .38], [x + side * .31, y - height * .5 - .12, z - .06], graphite);
  addBox(scene, [.72, .42, .38], [x + side * .31, y + height * .5 + .12, z - .06], graphite);
}

function addHorizontalHingeHardware(x, y, z, width) {
  addCylinder(scene, .16, width, [x, y, z], agedGunmetal, [0, 0, Math.PI / 2], 24);
  for (const offset of [-width * .36, 0, width * .36]) {
    addCylinder(scene, .225, .38, [x + offset, y, z], machinedMetal, [0, 0, Math.PI / 2], 24);
    addCylinder(scene, .09, .46, [x + offset, y, z + .015], brushedAluminum, [0, 0, Math.PI / 2], 18);
  }
}

function createTerminalServiceInfrastructure() {
  const group = new THREE.Group();
  group.name = "terminal-functional-service-layer";
  group.position.z = -25.74;

  // Visible service lamps justify the low directional fill used at the final
  // station. Their recessed lenses sit in protected perimeter zones rather
  // than becoming unexplained global illumination.
  for (const [x, y, rotation] of [[-4.73, -3.47, .035], [4.72, 3.55, -.028]]) {
    addBeveledPanel(group, [.72, .31, .28], [x, y, -.02], deepGraphite, .07, .018, "terminal-service-lamp-housing");
    addBeveledPanel(group, [.48, .09, .045], [x, y, .17], serviceLampLens, .025, .008, "terminal-service-lamp-lens");
    addBox(group, [.84, .045, .08], [x, y - .2, -.04], blackOxideSteel, [0, 0, rotation]);
  }

  // Upper differential: the cross-shaft transfers motion from the right-side
  // reducer to both hinged upper carriers. Collars and bearing blocks sit clear
  // of the display apertures and explain their shared deployment timing.
  // The bed stops behind the shaft's rear tangent; the bored housings bridge
  // the small remaining gap and transfer load without burying the shaft in it.
  addBeveledPanel(group, [5.45, .42, .28], [0, 4.02, -1.96], deepGraphite, .09, .02, "terminal-upper-drive-bed");
  addCylinder(group, .11, 5.12, [0, 4.02, -1.68], blackOxideSteel, [0, 0, Math.PI / 2], 20);
  addCylinder(group, .045, 5.18, [0, 4.02, -1.67], nickelSteel, [0, 0, Math.PI / 2], 14);
  for (const x of [-2.34, -1.16, 0, 1.16, 2.34]) {
    addBoredBearingHousing(group, {
      outerWidth: .38,
      outerHeight: .54,
      boreDiameter: .27,
      depth: .42,
      position: [x, 4.02, -1.68],
      rotation: [0, Math.PI / 2, 0],
      surface: agedGunmetal,
      raceSurface: machinedMetal,
      radius: .07,
      bevel: .018,
      raceRadius: .145,
      raceTube: .017,
      name: "terminal-upper-cross-shaft-bearing"
    });
  }
  const upperDriveGear = createPrecisionGear(group, {
    radius: .31,
    teeth: 13,
    depth: .16,
    position: [1.62, 3.94, -1.67],
    surface: blackOxideSteel,
    rotation: .06
  });
  const upperPinion = createPrecisionGear(group, {
    radius: .2,
    teeth: 9,
    depth: .14,
    position: [2.1, 3.69, -1.66],
    surface: phosphorBronze,
    rotation: -.14
  });
  registerMeshedGearTrain({
    driver: upperDriveGear,
    driverTeeth: 13,
    meshes: [{ node: upperPinion, teeth: 9 }],
    direction: 1,
    engagementHalfTurns: 3.8,
    runningSpeed: .705
  });

  // Left hydraulic distribution block. Four ferruled lines feed the course
  // carrier latch and its telescoping rails instead of terminating in space.
  const courseManifoldX = -4.7;
  addBeveledPanel(group, [.58, 2.72, .46], [courseManifoldX, 1.42, -.13], agedGunmetal, .075, .025, "course-hydraulic-manifold");
  addBeveledPanel(group, [.5, 2.42, .16], [courseManifoldX, 1.42, .2], blackOxideSteel, .045, .015);
  for (let index = 0; index < 4; index += 1) {
    const y = .55 + index * .58;
    addCylinder(group, .125, .32, [courseManifoldX, y, .43], blackOxideSteel, [Math.PI / 2, 0, 0], 18);
    addCylinder(group, .155, .08, [courseManifoldX, y, .61], nickelSteel, [Math.PI / 2, 0, 0], 18);
    addCylinder(group, .058, .18, [courseManifoldX, y, .69], phosphorBronze, [Math.PI / 2, 0, 0], 12);
  }
  addTube(group, [[courseManifoldX, .55, .76], [-4.76, .4, .38], [-4.74, .64, -1.72], [-4.6, .92, -1.72], [-3.86, 1.45, -1.72]], .034, braidedCable);
  addTube(group, [[courseManifoldX, 1.13, .76], [-4.77, 1.05, .36], [-4.74, 1.34, -1.73], [-4.6, 1.72, -1.73], [-3.8, 2.34, -1.73]], .031, cableMaterial);
  addTube(group, [[courseManifoldX, 1.71, .76], [-4.77, 1.82, .34], [-4.74, 2.08, -1.74], [-4.6, 2.44, -1.74], [-3.77, 3.06, -1.74]], .03, braidedCable);

  // Right electrical power stage. The exposed gear pair drives a small rotary
  // encoder while the connector stack routes power around, never across, the
  // meeting display opening.
  const meetingPowerX = 4.62;
  addBeveledPanel(group, [.68, 2.92, .48], [meetingPowerX, 1.5, -.15], graphite, .085, .025, "meeting-power-stage");
  addBeveledPanel(group, [.5, 2.58, .17], [meetingPowerX, 1.5, .2], blackOxideSteel, .05, .014);
  for (let index = 0; index < 5; index += 1) {
    const y = .46 + index * .5;
    addCylinder(group, .11, .29, [4.5, y, .43], agedGunmetal, [Math.PI / 2, 0, 0], 16);
    addCylinder(group, .137, .07, [4.5, y, .6], nickelSteel, [Math.PI / 2, 0, 0], 18);
    addBox(group, [.28, .105, .08], [4.72, y, .46], index === 3 ? phosphorBronze : edgeMetal);
  }
  sparkDrivenGear = createPrecisionGear(group, {
    radius: .23,
    teeth: 11,
    depth: .16,
    position: [3.82, -.34, .2],
    surface: agedGunmetal,
    rotation: .12
  });
  // Power cabling is routed around the pressure spine, not through the driven
  // gear or the tooth-contact spark emitter. The final leg terminates on the
  // lower encoder block and retains a full pitch-radius clearance envelope.
  addTube(group, [
    [4.5, .46, .73],
    [4.76, .18, .72],
    [4.82, -.16, .72],
    [4.58, -.52, .7],
    [4.52, -1.12, .58],
    [4.46, -1.55, .48]
  ], .035, braidedCable);
  addTube(group, [[4.5, 2.46, .73], [4.56, 2.7, .34], [4.54, 3.04, -1.72], [4.46, 3.34, -1.72], [3.97, 3.66, -1.72]], .03, cableMaterial);

  // The priority tray rises on a visible lead screw. The central cross-member
  // and two guide shafts occupy the deliberate gap between upper and lower
  // displays, preserving a clear physical separation between the assemblies.
  addBeveledPanel(group, [6.65, .42, .38], [0, .02, -2.1], deepGraphite, .08, .018, "terminal-priority-crossmember");
  addCylinder(group, .1, 6.18, [0, .02, -1.78], blackOxideSteel, [0, 0, Math.PI / 2], 20);
  addCylinder(group, .036, 6.26, [0, .02, -1.77], nickelSteel, [0, 0, Math.PI / 2], 12);
  for (const x of [-2.85, -1.45, 0, 1.45, 2.85]) {
    addBoredBearingHousing(group, {
      outerWidth: .34,
      outerHeight: .55,
      boreDiameter: .25,
      depth: .36,
      position: [x, .02, -1.78],
      rotation: [0, Math.PI / 2, 0],
      surface: agedGunmetal,
      raceSurface: machinedMetal,
      radius: .055,
      bevel: .014,
      raceRadius: .13,
      raceTube: .014,
      name: "terminal-priority-cross-shaft-bearing"
    });
  }

  addBeveledPanel(group, [8.6, .46, .36], [0, -3.79, -2.12], deepGraphite, .08, .02, "terminal-lower-lead-screw-bed");
  addCylinder(group, .12, 8.12, [0, -3.79, -1.78], blackOxideSteel, [0, 0, Math.PI / 2], 22);
  addCylinder(group, .048, 8.2, [0, -3.79, -1.77], nickelSteel, [0, 0, Math.PI / 2], 14);
  for (const x of [-3.72, -2.45, -1.18, 0, 1.18, 2.45, 3.72]) {
    addBoredBearingHousing(group, {
      outerWidth: .4,
      outerHeight: .62,
      boreDiameter: .29,
      depth: .44,
      position: [x, -3.79, -1.78],
      rotation: [0, Math.PI / 2, 0],
      surface: agedGunmetal,
      raceSurface: machinedMetal,
      radius: .065,
      bevel: .016,
      raceRadius: .152,
      raceTube: .016,
      name: "terminal-lower-lead-shaft-bearing"
    });
  }
  const lowerDriveGear = createPrecisionGear(group, {
    radius: .42,
    teeth: 16,
    depth: .2,
    position: [4.42, -3.42, .42],
    surface: blackOxideSteel,
    rotation: .04
  });
  const lowerPinion = createPrecisionGear(group, {
    radius: .26,
    teeth: 11,
    depth: .17,
    // .67 centre distance matches the two pitch radii (.42 + .26) closely,
    // preventing visibly interpenetrating teeth while preserving engagement.
    position: [4.86, -2.91, .43],
    surface: phosphorBronze,
    rotation: -.1
  });
  registerMeshedGearTrain({
    driver: lowerDriveGear,
    driverTeeth: 16,
    meshes: [{ node: lowerPinion, teeth: 11 }],
    direction: -1,
    engagementHalfTurns: 4.6,
    runningSpeed: .765
  });

  // Repeated fasteners are instanced physical parts, not a tiled normal map.
  const fastenerPositions = [];
  for (const x of [-4.9, -4.1, -3.3, -2.5, -1.7, -.9, 0, .9, 1.7, 2.5, 3.3, 4.1, 4.9]) {
    fastenerPositions.push([x, 4.27, .32], [x, -4.68, .32]);
  }
  for (const y of [-3.35, -2.55, -1.75, -.95, -.15, .65, 1.45, 2.25, 3.05]) {
    fastenerPositions.push([-5.18, y, .32], [5.18, y, .32]);
  }
  const boltGeometry = cylinderGeometry(.048, .06, 12);
  const washerGeometry = torusGeometry(.071, .014, 6, 14);
  const bolts = new THREE.InstancedMesh(boltGeometry, nickelSteel, fastenerPositions.length);
  const washers = new THREE.InstancedMesh(washerGeometry, blackOxideSteel, fastenerPositions.length);
  const boltRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const matrix = new THREE.Matrix4();
  fastenerPositions.forEach((position, index) => {
    matrix.copy(boltRotation).setPosition(position[0], position[1], position[2]);
    bolts.setMatrixAt(index, matrix);
    matrix.identity().setPosition(position[0], position[1], position[2] + .035);
    washers.setMatrixAt(index, matrix);
  });
  bolts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  washers.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bolts.castShadow = false;
  washers.castShadow = false;
  group.add(bolts, washers);

  scene.add(group);

  // Two recessed reduction housings occupy the remaining lower service
  // channels. They sit behind the moving carrier envelope (z <= -26.8), so the
  // denser terminal reads as a working machine without impossible collisions.
  createGearboxModule(-4.66, -2.03, -26.88, .48, .035, false);
  createGearboxModule(4.7, -1.78, -26.9, .5, -.04, true);
  createPistonBank(4.68, 2.72, -26.74, 4, .46, Math.PI - .035);
}

function createTerminalMicrodetailBatches() {
  const frontFacingQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const identityQuaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const unitScale = new THREE.Vector3(1, 1, 1);

  // Connector ferrules belong to bolted vertical distribution rails. The
  // upper service zone is a real rectangular maintenance opening rather than
  // a solid rail hidden behind the hydraulic and power manifolds. This gives
  // every hose a physical passage and keeps the visible frame load-bearing.
  for (const side of [-1, 1]) {
    const railName = side < 0 ? "left-terminal-distribution-rail" : "right-terminal-distribution-rail";
    const railSegments = [
      { y: -1.59, height: 2.96, suffix: "lower" },
      { y: 3.205, height: .21, suffix: "upper" }
    ];
    railSegments.forEach(({ y, height, suffix }) => {
      addBeveledPanel(
        scene,
        [.74, height, .24],
        [side * 4.78, y, -25.61],
        deepGraphite,
        Math.min(.08, height * .24),
        .018,
        `${railName}-${suffix}`
      );
      if (height > .4) {
        addBox(scene, [.08, height - .18, .16], [side * 4.56, y, -25.42], blackOxideSteel);
        addBox(scene, [.055, height - .34, .07], [side * 4.9, y, -25.36], agedGunmetal);
      }
    });
    for (const edgeY of [-.075, 3.065]) {
      addBox(scene, [.78, .085, .18], [side * 4.78, edgeY, -25.58], blackOxideSteel);
      addBox(scene, [.54, .026, .045], [side * 4.78, edgeY, -25.45], wornEdge);
    }
  }

  const perimeterFasteners = [];
  for (let index = 0; index < 12; index += 1) {
    const x = -4.72 + index * .86;
    perimeterFasteners.push([x, 4.28, -25.37], [x, -4.68, -25.37]);
  }
  for (let index = 0; index < 9; index += 1) {
    const y = -3.35 + index * .82;
    perimeterFasteners.push([-5.02, y, -25.35], [5.02, y, -25.35]);
  }
  // A second, deliberately irregular witness row breaks the synthetic grid
  // cadence without adding another mesh. These heads live only in the proven
  // top, bottom and side service bands, outside every carrier aperture and
  // hinge sweep.
  [
    [-5.34, 4.52, -25.31], [-4.18, 4.47, -25.3], [-2.63, 4.53, -25.32],
    [-.88, 4.46, -25.3], [1.34, 4.51, -25.31], [3.72, 4.45, -25.29],
    [5.3, 4.5, -25.31], [-5.32, -4.94, -25.31], [-4.04, -4.87, -25.3],
    [4.12, -4.92, -25.31], [5.31, -4.86, -25.29],
    [-5.28, -2.76, -25.3], [-5.32, -.96, -25.31], [-5.29, 1.18, -25.29],
    [5.3, -2.44, -25.3], [5.27, -.42, -25.29], [5.31, 2.12, -25.31]
  ].forEach(position => perimeterFasteners.push(position));
  for (const x of [-2.92, -2.18, -1.44, -.7, 0, .7, 1.44, 2.18, 2.92]) {
    perimeterFasteners.push([x, .05, -27.34]);
  }

  const boltHeads = new THREE.InstancedMesh(
    cylinderGeometry(.045, .058, 12),
    nickelSteel,
    perimeterFasteners.length
  );
  const boltWashers = new THREE.InstancedMesh(
    torusGeometry(.068, .013, 6, 14),
    blackOxideSteel,
    perimeterFasteners.length
  );
  const boltSlots = new THREE.InstancedMesh(
    boxGeometry(.062, .012, .012),
    deepGraphite,
    perimeterFasteners.length
  );
  perimeterFasteners.forEach((position, index) => {
    matrix.compose(new THREE.Vector3(...position), frontFacingQuaternion, unitScale);
    boltHeads.setMatrixAt(index, matrix);
    matrix.compose(new THREE.Vector3(position[0], position[1], position[2] + .033), identityQuaternion, unitScale);
    boltWashers.setMatrixAt(index, matrix);
    const slotRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, index % 2 ? .12 : -.12));
    matrix.compose(new THREE.Vector3(position[0], position[1], position[2] + .064), slotRotation, unitScale);
    boltSlots.setMatrixAt(index, matrix);
  });

  const connectorPositions = [];
  for (const [side, clusterKey] of [[-1, "left"], [1, "right"]]) {
    TERMINAL_CONNECTOR_CLUSTERS[clusterKey].flat().forEach((y, index) => {
      connectorPositions.push([
        side * (4.76 + (index % 3) * .035),
        y,
        -25.34 + (index % 3) * .018
      ]);
    });
  }
  const connectorBodies = new THREE.InstancedMesh(
    cylinderGeometry(.105, .2, 18),
    blackOxideSteel,
    connectorPositions.length
  );
  const connectorFerrules = new THREE.InstancedMesh(
    torusGeometry(.13, .026, 8, 20),
    nickelSteel,
    connectorPositions.length
  );
  const connectorPins = new THREE.InstancedMesh(
    cylinderGeometry(.035, .24, 12),
    phosphorBronze,
    connectorPositions.length
  );
  connectorPositions.forEach((position, index) => {
    matrix.compose(new THREE.Vector3(...position), frontFacingQuaternion, unitScale);
    connectorBodies.setMatrixAt(index, matrix);
    matrix.compose(new THREE.Vector3(position[0], position[1], position[2] + .12), identityQuaternion, unitScale);
    connectorFerrules.setMatrixAt(index, matrix);
    matrix.compose(new THREE.Vector3(position[0], position[1], position[2] + .18), frontFacingQuaternion, unitScale);
    connectorPins.setMatrixAt(index, matrix);
  });

  const clampPositions = [];
  for (let index = 0; index < 10; index += 1) {
    const x = -4.15 + index * .92;
    clampPositions.push([x, 4.28, -25.62], [x, -4.66, -25.62]);
  }
  const clampBodies = new THREE.InstancedMesh(
    boxGeometry(.28, .11, .17),
    agedGunmetal,
    clampPositions.length
  );
  const clampScrews = new THREE.InstancedMesh(
    cylinderGeometry(.028, .055, 10),
    nickelSteel,
    clampPositions.length * 2
  );
  let screwIndex = 0;
  clampPositions.forEach((position, index) => {
    const clampQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, index % 2 ? .025 : -.025));
    matrix.compose(new THREE.Vector3(...position), clampQuaternion, unitScale);
    clampBodies.setMatrixAt(index, matrix);
    for (const offset of [-.095, .095]) {
      matrix.compose(
        new THREE.Vector3(position[0] + offset, position[1], position[2] + .105),
        frontFacingQuaternion,
        unitScale
      );
      clampScrews.setMatrixAt(screwIndex, matrix);
      screwIndex += 1;
    }
  });

  // A complete terminal enclosure needs a believable boundary as well as a
  // populated backplane. Instanced intake louvers and side gussets form the
  // top, bottom and side depth cues visible in the reference render while
  // adding only two draw calls.
  const louverCount = 34;
  const enclosureLouvers = new THREE.InstancedMesh(
    boxGeometry(.17, .18, .62),
    blackOxideSteel,
    louverCount * 2
  );
  let louverIndex = 0;
  for (const y of [-4.62, 4.71]) {
    for (let index = 0; index < louverCount; index += 1) {
      const x = -5.72 + index * (11.44 / (louverCount - 1));
      const taper = Math.abs(x) / 5.72;
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        0,
        (index % 2 ? .018 : -.018) * (1 - taper * .35),
        x * .0035
      ));
      matrix.compose(new THREE.Vector3(x, y, -26.86), rotation, unitScale);
      enclosureLouvers.setMatrixAt(louverIndex, matrix);
      louverIndex += 1;
    }
  }

  const sideGussetPositions = [];
  // Gussets terminate between the removable service-cassette bays instead of
  // occupying the same solid volume. The five structural stations preserve a
  // continuous side load path while leaving four real maintenance apertures.
  for (const y of [-4, -2.32, 0, 2.32, 4]) {
    sideGussetPositions.push([-6.04, y, -26.82], [6.04, y, -26.82]);
  }
  const enclosureSideGussets = new THREE.InstancedMesh(
    boxGeometry(.72, .14, .64),
    agedGunmetal,
    sideGussetPositions.length
  );
  sideGussetPositions.forEach((position, index) => {
    const side = position[0] < 0 ? -1 : 1;
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, side * .08, 0));
    matrix.compose(new THREE.Vector3(...position), rotation, unitScale);
    enclosureSideGussets.setMatrixAt(index, matrix);
  });

  addBox(scene, [12.25, .13, .38], [0, 4.29, -26.36], agedGunmetal);
  addBox(scene, [12.25, .13, .38], [0, -5.18, -26.36], agedGunmetal);
  addBox(scene, [.13, 8.55, .38], [-5.74, .02, -26.36], blackOxideSteel);
  addBox(scene, [.13, 8.55, .38], [5.74, .02, -26.36], blackOxideSteel);

  for (const mesh of [
    boltHeads,
    boltWashers,
    boltSlots,
    connectorBodies,
    connectorFerrules,
    connectorPins,
    clampBodies,
    clampScrews,
    enclosureLouvers,
    enclosureSideGussets
  ]) {
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

function createTerminalTransmissionLayer() {
  const group = new THREE.Group();
  group.name = "terminal-bearing-and-transmission-layer";
  group.position.z = -25.76;

  // Bearing pedestals sit behind the exposed reduction gears. The old isolated
  // discs now have a rear race, an oil seal and a shaft terminating in the
  // chassis, so every rotating part reads as load-bearing hardware.
  const bearingStations = [
    { x: -4.15, y: -.72, size: 1.32 },
    { x: 4.16, y: -.82, size: 1.18 },
    { x: 3.82, y: -.34, size: .68 },
    { x: 3.15, y: -3.18, size: .98 }
  ];
  bearingStations.forEach(({ x, y, size }, index) => {
    addBeveledPanel(group, [size, size * .9, .32], [x, y, -.18], deepGraphite, .13, .026, `terminal-bearing-pedestal-${index}`);
    addBeveledRing(group, {
      outerWidth: size * .78,
      outerHeight: size * .78,
      innerWidth: size * .52,
      innerHeight: size * .52,
      depth: .22,
      position: [x, y, .03],
      surface: index === 2 ? greasedBronze : milledBlackSteel,
      radius: size * .16,
      bevel: .018,
      name: `terminal-bearing-race-${index}`
    });
    addCylinder(group, size * .19, .34, [x, y, .03], turnedSteel, [Math.PI / 2, 0, 0], 28);
    addCylinder(group, size * .11, .38, [x, y, .07], gasketRubber, [Math.PI / 2, 0, 0], 20);
  });

  // Offset transfer shafts and couplings explain how the terminal gear train
  // drives the upper and lower carrier linkages without crossing live screens.
  for (const [x, y, length, rotation] of [
    [-4.76, -.72, 1.16, Math.PI / 2],
    [4.67, -.82, .96, Math.PI / 2],
    [3.82, -.68, .62, 0],
    [3.15, -3.68, .86, 0]
  ]) {
    addCylinder(group, .072, length, [x, y, -.02], blackOxideSteel, rotation ? [0, 0, rotation] : null, 20);
    addCylinder(group, .031, length * .96, [x, y, .01], turnedSteel, rotation ? [0, 0, rotation] : null, 14);
  }

  // Three true depth bands: rear looms, mid-depth fluid lines, and proud clamp
  // bridges. All routes stay in the perimeter safe zones around the DOM bays.
  const perimeterLooms = [
    [[-5.18, 4.56, -.5], [-3.7, 4.59, -.46], [-1.55, 4.62, -.42], [.2, 4.58, -.4]],
    [[5.18, 3.46, -.47], [4.76, 2.9, -.38], [4.96, 1.46, -.32], [4.7, .18, -.28]],
    [[-5.22, -3.48, -.58], [-4.08, -3.77, -.68], [-2.86, -4.02, -.98], [-2.7, -4.05, -1.75]],
    [[5.2, -3.52, -.44], [4.12, -3.8, -.35], [3.4, -3.62, -.26], [2.84, -3.18, -.16]]
  ];
  const loomTerminations = [];
  perimeterLooms.forEach((route, index) => {
    addTube(group, route, index % 2 ? .042 : .052, index < 2 ? braidedCable : cableMaterial);
    const offsetRoute = route.map(([x, y, z]) => [x + (index % 2 ? -.08 : .08), y + .07, z - .045]);
    addTube(group, offsetRoute, index % 2 ? .024 : .031, index === 3 ? greasedBronze : blackOxideSteel);
    const start = new THREE.Vector3(...route[0]);
    const startTangent = new THREE.Vector3(...route[1]).sub(start).normalize();
    const end = new THREE.Vector3(...route[route.length - 1]);
    const endTangent = end.clone().sub(new THREE.Vector3(...route[route.length - 2])).normalize();
    loomTerminations.push(
      { point: start, tangent: startTangent, scale: index % 2 ? .84 : 1 },
      { point: end, tangent: endTangent, scale: index % 2 ? .84 : 1 }
    );
  });

  // Every perimeter loom now ends in an oriented crimp sleeve and strain-
  // relief gland instead of disappearing into a plate. The two instanced
  // batches inherit the routes' already-verified safe envelope and add true
  // local depth with only two draw calls.
  const loomCrimps = new THREE.InstancedMesh(
    cylinderGeometry(.06, .14, 14),
    nickelSteel,
    loomTerminations.length
  );
  const loomGlands = new THREE.InstancedMesh(
    torusGeometry(.078, .012, 7, 18),
    blackOxideSteel,
    loomTerminations.length
  );
  const loomMatrix = new THREE.Matrix4();
  const loomQuaternion = new THREE.Quaternion();
  const glandQuaternion = new THREE.Quaternion();
  const loomAxis = new THREE.Vector3(0, 1, 0);
  const glandAxis = new THREE.Vector3(0, 0, 1);
  const loomScale = new THREE.Vector3();
  loomTerminations.forEach(({ point, tangent, scale }, index) => {
    loomQuaternion.setFromUnitVectors(loomAxis, tangent);
    loomScale.set(scale, 1, scale);
    loomMatrix.compose(point, loomQuaternion, loomScale);
    loomCrimps.setMatrixAt(index, loomMatrix);
    glandQuaternion.setFromUnitVectors(glandAxis, tangent);
    loomScale.set(scale, scale, scale);
    loomMatrix.compose(point.clone().addScaledVector(tangent, .075), glandQuaternion, loomScale);
    loomGlands.setMatrixAt(index, loomMatrix);
  });
  loomCrimps.name = "terminal-loom-crimp-sleeves";
  loomGlands.name = "terminal-loom-strain-relief-glands";
  loomCrimps.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  loomGlands.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  loomCrimps.castShadow = false;
  loomGlands.castShadow = false;
  loomCrimps.receiveShadow = true;
  loomGlands.receiveShadow = true;
  group.add(loomCrimps, loomGlands);

  for (const side of [-1, 1]) {
    const x = side * 5.36;
    addBeveledPanel(group, [.56, 6.85, .28], [x, .05, -.28], agedGunmetal, .08, .018, side < 0 ? "left-pressure-spine" : "right-pressure-spine");
    for (const offset of [-.17, .17]) {
      addCylinder(group, .052, 5.86, [x + offset, .03, .03], offset < 0 ? blackOxideSteel : phosphorBronze, null, 16);
    }
  }

  // Dense side service banks use four instanced batches instead of isolated
  // decorative meshes. Each block has a housing, removable face, oil-sealed
  // valve and contact pin at a different depth along the pressure spine.
  const sideModuleStations = [];
  for (const [side, clusterKey] of [[-1, "left"], [1, "right"]]) {
    const irregularStations = TERMINAL_CONNECTOR_CLUSTERS[clusterKey].flat();
    for (let index = 0; index < irregularStations.length; index += 1) {
      sideModuleStations.push({
        x: side * (4.74 + (index % 3) * .01),
        y: irregularStations[index] + (index % 2 ? .06 : -.08),
        z: -.64 + (index % 3) * .18,
        scale: .86 + (index % 4) * .075,
        rotation: side * ((index % 3) - 1) * .018
      });
    }
  }
  const serviceHousings = new THREE.InstancedMesh(boxGeometry(.52, .3, .24), milledBlackSteel, sideModuleStations.length);
  const serviceFaces = new THREE.InstancedMesh(boxGeometry(.38, .18, .055), agedGunmetal, sideModuleStations.length);
  const serviceValveRaces = new THREE.InstancedMesh(torusGeometry(.085, .021, 7, 18), greasedBronze, sideModuleStations.length);
  const servicePins = new THREE.InstancedMesh(cylinderGeometry(.026, .12, 10), turnedSteel, sideModuleStations.length);
  const detailMatrix = new THREE.Matrix4();
  const detailQuaternion = new THREE.Quaternion();
  const detailScale = new THREE.Vector3();
  const frontFacing = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  sideModuleStations.forEach((station, index) => {
    detailQuaternion.setFromEuler(new THREE.Euler(0, 0, station.rotation));
    detailScale.set(station.scale, station.scale, 1);
    detailMatrix.compose(new THREE.Vector3(station.x, station.y, station.z), detailQuaternion, detailScale);
    serviceHousings.setMatrixAt(index, detailMatrix);
    detailMatrix.compose(new THREE.Vector3(station.x, station.y, station.z + .145), detailQuaternion, detailScale);
    serviceFaces.setMatrixAt(index, detailMatrix);
    detailMatrix.compose(new THREE.Vector3(station.x - Math.sign(station.x) * .11, station.y, station.z + .19), detailQuaternion, detailScale);
    serviceValveRaces.setMatrixAt(index, detailMatrix);
    detailMatrix.compose(new THREE.Vector3(station.x - Math.sign(station.x) * .11, station.y, station.z + .235), frontFacing, detailScale);
    servicePins.setMatrixAt(index, detailMatrix);
  });
  for (const mesh of [serviceHousings, serviceFaces, serviceValveRaces, servicePins]) {
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Three bolted manifolds per side turn the irregular ferrule clusters into a
  // legible pressure/power network. Short front-layer hoses terminate at real
  // glands; standoffs bridge the air gap to the rear pressure spine without
  // sharing solid volume with it or entering a carrier aperture.
  for (const [side, clusterKey] of [[-1, "left"], [1, "right"]]) {
    const sourceX = side * 4.78;
    const bridgeX = side * 5.06;
    const manifoldX = side * 5.36;
    TERMINAL_CONNECTOR_CLUSTERS[clusterKey].forEach((cluster, clusterIndex) => {
      const centerY = cluster.reduce((sum, value) => sum + value, 0) / cluster.length;
      addBeveledPanel(
        group,
        [.44, .52, .22],
        [manifoldX, centerY, .16],
        clusterIndex === 1 ? milledBlackSteel : agedGunmetal,
        .075,
        .014,
        `${clusterKey}-cluster-manifold-${clusterIndex}`
      );
      addCylinder(group, .045, .2, [manifoldX, centerY, -.04], blackOxideSteel, [Math.PI / 2, 0, 0], 14);
      cluster.forEach((sourceY, portIndex) => {
        const portY = centerY + (portIndex - (cluster.length - 1) * .5) * .12;
        addCylinder(group, .046, .11, [manifoldX, portY, .335], phosphorBronze, [Math.PI / 2, 0, 0], 12);
        addTube(group, [
          [sourceX, sourceY, .44],
          [bridgeX, sourceY + (portIndex % 2 ? .035 : -.025), .48],
          [manifoldX, portY, .4]
        ], .018 + (portIndex % 2) * .003, portIndex === 1 ? braidedCable : blackOxideSteel);
      });
      for (const yOffset of [-.18, .18]) {
        addCylinder(group, .026, .055, [manifoldX, centerY + yOffset, .3], turnedSteel, [Math.PI / 2, 0, 0], 10);
      }
    });
  }

  const clampPositions = [];
  for (const x of [-4.6, -3.4, -2.2, -1, .2, 1.4, 2.6, 3.8, 4.72]) {
    clampPositions.push([x, 4.42, -.06], [x, -4.72, -.06]);
  }
  const clampMesh = new THREE.InstancedMesh(boxGeometry(.24, .13, .24), milledBlackSteel, clampPositions.length);
  const clampBoltMesh = new THREE.InstancedMesh(cylinderGeometry(.03, .08, 12), turnedSteel, clampPositions.length * 2);
  const matrix = new THREE.Matrix4();
  const frontRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  let boltIndex = 0;
  clampPositions.forEach((position, index) => {
    matrix.identity().setPosition(...position);
    clampMesh.setMatrixAt(index, matrix);
    for (const offset of [-.07, .07]) {
      matrix.copy(frontRotation).setPosition(position[0] + offset, position[1], position[2] + .15);
      clampBoltMesh.setMatrixAt(boltIndex, matrix);
      boltIndex += 1;
    }
  });
  clampMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  clampBoltMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  clampMesh.receiveShadow = true;
  group.add(clampMesh, clampBoltMesh);

  scene.add(group);
}

function createTerminalOuterPortal() {
  const group = new THREE.Group();
  group.name = "terminal-load-bearing-outer-portal";
  // The portal is the foremost terminal structure. Keeping it ahead of the
  // last tunnel rib prevents the enclosure silhouette from being swallowed by
  // the dark approach geometry at the final camera station.
  group.position.z = -25.96;

  // A full structural portal is kept outside every carrier sweep. Its nested
  // faces, return lips and fasteners keep the final frame readable as a real
  // appliance enclosure instead of letting the machinery dissolve into black.
  addBeveledPanel(group, [13.08, .48, .82], [0, 5.08, 0], serviceFrameSteel, .12, .028, "terminal-outer-crossbeam");
  addBox(group, [12.22, .055, .08], [0, 4.89, .46], turnedSteel);
  addBox(group, [11.72, .038, .06], [0, 4.79, .43], wornEdge);

  // The lower portal transfers its load around a genuine priorities-carrier
  // aperture. Splitting the beam, return lip and wear strip keeps the member
  // out of the carrier's extract-then-hinge envelope at every progress frame.
  const priorityPortalAperture = 6.4;
  for (const side of [-1, 1]) {
    const beamWidth = (13.08 - priorityPortalAperture) * .5;
    const beamX = side * (priorityPortalAperture * .5 + beamWidth * .5);
    addBeveledPanel(group, [beamWidth, .48, .82], [beamX, -5.08, 0], serviceFrameSteel, .12, .028, `terminal-outer-crossbeam-bottom-${side < 0 ? "left" : "right"}`);
    const lipWidth = (12.22 - priorityPortalAperture) * .5;
    const lipX = side * (priorityPortalAperture * .5 + lipWidth * .5);
    addBox(group, [lipWidth, .055, .08], [lipX, -4.89, .46], turnedSteel);
    const wearWidth = (11.72 - priorityPortalAperture) * .5;
    const wearX = side * (priorityPortalAperture * .5 + wearWidth * .5);
    addBox(group, [wearWidth, .038, .06], [wearX, -4.79, .43], wornEdge);
  }
  for (const x of [-6.3, 6.3]) {
    addBeveledPanel(group, [.52, 9.72, .82], [x, 0, 0], serviceFrameSteel, .12, .028, "terminal-outer-upright");
    addBox(group, [.055, 8.9, .08], [x - Math.sign(x) * .19, 0, .46], turnedSteel);
    addBox(group, [.038, 8.42, .06], [x - Math.sign(x) * .29, 0, .43], wornEdge);
  }

  // A rear hoop and four depth ties turn the front outline into a true machine
  // enclosure. The hoop lives wholly behind z -26.9; the ties occupy only the
  // four protected corners, outside the upper and lower carrier sweeps.
  const rearHorizontalGeometry = extrudedGeometry(
    "terminal-rear-hoop-horizontal",
    roundedRectShape(12.16, .34, .075),
    .4,
    .018
  );
  const rearVerticalGeometry = extrudedGeometry(
    "terminal-rear-hoop-vertical",
    roundedRectShape(.34, 9.12, .075),
    .4,
    .018
  );
  const rearHorizontalMembers = new THREE.InstancedMesh(rearHorizontalGeometry, serviceFrameSteel, 2);
  const rearVerticalMembers = new THREE.InstancedMesh(rearVerticalGeometry, milledBlackSteel, 2);
  const portalMatrix = new THREE.Matrix4();
  [-4.72, 4.72].forEach((y, index) => {
    portalMatrix.identity().setPosition(0, y, -1.08);
    rearHorizontalMembers.setMatrixAt(index, portalMatrix);
  });
  [-5.92, 5.92].forEach((x, index) => {
    portalMatrix.identity().setPosition(x, 0, -1.08);
    rearVerticalMembers.setMatrixAt(index, portalMatrix);
  });

  const cornerTiePositions = [];
  for (const x of [-5.98, 5.98]) {
    for (const y of [-4.8, 4.8]) cornerTiePositions.push([x, y, -.54]);
  }
  const cornerTies = new THREE.InstancedMesh(
    boxGeometry(.24, .24, 1.08),
    blackOxideSteel,
    cornerTiePositions.length
  );
  cornerTiePositions.forEach((position, index) => {
    portalMatrix.identity().setPosition(...position);
    cornerTies.setMatrixAt(index, portalMatrix);
  });

  // The louver rows already have real open depth; these inner crossmembers give
  // them a load path and a dark plenum backing instead of a floating slat band.
  const grilleCrossmemberGeometry = extrudedGeometry(
    "terminal-grille-crossmember",
    roundedRectShape(11.52, .22, .05),
    .34,
    .014
  );
  const grilleCrossmembers = new THREE.InstancedMesh(grilleCrossmemberGeometry, agedGunmetal, 2);
  [4.42, -4.46].forEach((y, index) => {
    portalMatrix.identity().setPosition(0, y, -.82);
    grilleCrossmembers.setMatrixAt(index, portalMatrix);
  });

  // Eight service cassettes replace the large blank side walls with bounded,
  // removable rail modules. They terminate a pair of looms and stay at
  // |x| >= 5.38, beyond every carrier flange at every hinge angle.
  const serviceCassetteStations = [];
  for (const x of [-6.04, 6.04]) {
    for (const y of [-3.12, -1.08, 1.14, 3.12]) {
      // The left-upper station is a genuine shaft-access aperture. Keeping it
      // open lets the gearbox collar be withdrawn along its axis; placing a
      // decorative cassette there would occupy the same service envelope.
      if (x < 0 && y === 1.14) continue;
      serviceCassetteStations.push([x, y]);
    }
  }
  const sideRails = new THREE.InstancedMesh(boxGeometry(.16, 7.42, .2), blackOxideSteel, 2);
  // Rails sit outboard of both gearbox envelopes and the slotted gusset row.
  // The portal upright is on a separate, shallower z datum, leaving a visible
  // service gap instead of sharing solid volume with this rear support.
  [-6.52, 6.52].forEach((x, index) => {
    portalMatrix.identity().setPosition(x, 0, -.94);
    sideRails.setMatrixAt(index, portalMatrix);
  });
  const cassetteBodies = new THREE.InstancedMesh(
    extrudedGeometry("terminal-service-cassette-body", roundedRectShape(.58, .84, .09), .32, .016),
    milledBlackSteel,
    serviceCassetteStations.length
  );
  const cassetteFaces = new THREE.InstancedMesh(
    extrudedGeometry("terminal-service-cassette-face", roundedRectShape(.42, .62, .065), .055, .01),
    agedGunmetal,
    serviceCassetteStations.length
  );
  const cassetteFasteners = new THREE.InstancedMesh(
    cylinderGeometry(.03, .055, 10),
    turnedSteel,
    serviceCassetteStations.length * 4
  );
  const cassetteWear = new THREE.InstancedMesh(
    boxGeometry(.024, .4, .018),
    wornEdge,
    serviceCassetteStations.length
  );
  const cassetteEdgeCatches = new THREE.InstancedMesh(
    boxGeometry(.13, .04, .035),
    nickelSteel,
    serviceCassetteStations.length
  );
  const frontFastenerRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  let cassetteFastenerIndex = 0;
  serviceCassetteStations.forEach(([x, y], index) => {
    const drift = (index % 3 - 1) * .014;
    portalMatrix.makeRotationZ(drift).setPosition(x, y, -.8);
    cassetteBodies.setMatrixAt(index, portalMatrix);
    portalMatrix.makeRotationZ(-drift * .7).setPosition(x, y, -.515);
    cassetteFaces.setMatrixAt(index, portalMatrix);
    portalMatrix.identity().setPosition(x - Math.sign(x) * .18, y, -.476);
    cassetteWear.setMatrixAt(index, portalMatrix);
    portalMatrix.identity().setPosition(x + Math.sign(x) * .14, y, -.45);
    cassetteEdgeCatches.setMatrixAt(index, portalMatrix);
    for (const xOffset of [-.15, .15]) {
      for (const yOffset of [-.25, .25]) {
        portalMatrix.copy(frontFastenerRotation).setPosition(x + xOffset, y + yOffset, -.45);
        cassetteFasteners.setMatrixAt(cassetteFastenerIndex, portalMatrix);
        cassetteFastenerIndex += 1;
      }
    }
  });

  for (const mesh of [
    rearHorizontalMembers,
    rearVerticalMembers,
    cornerTies,
    grilleCrossmembers,
    sideRails,
    cassetteBodies,
    cassetteFaces,
    cassetteFasteners,
    cassetteWear,
    cassetteEdgeCatches
  ]) {
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  for (const side of [-1, 1]) {
    addTube(group, [
      [side * 5.7, 3.46, -.53],
      [side * 5.5, 2.62, -.42],
      [side * 5.55, .72, -.48],
      [side * 5.5, -1.46, -.4],
      [side * 5.7, -3.48, -.54]
    ], .026, braidedCable);
  }

  // Recessed inner jambs provide a second silhouette, like the stepped wall
  // thickness in the reference render. They remain in the protected perimeter
  // zones and therefore cannot visually or physically cut through a control.
  addBeveledPanel(group, [12.06, .2, .42], [0, 4.56, .22], agedGunmetal, .055, .016, "terminal-inner-top-jamb");
  const priorityInnerAperture = 6.2;
  for (const side of [-1, 1]) {
    const jambWidth = (12.06 - priorityInnerAperture) * .5;
    const jambX = side * (priorityInnerAperture * .5 + jambWidth * .5);
    addBeveledPanel(group, [jambWidth, .2, .42], [jambX, -4.56, .22], agedGunmetal, .055, .016, `terminal-inner-bottom-jamb-${side < 0 ? "left" : "right"}`);
  }
  addBeveledPanel(group, [.2, 8.92, .42], [-5.88, 0, .22], blackOxideSteel, .055, .016, "terminal-inner-left-jamb");
  addBeveledPanel(group, [.2, 8.92, .42], [5.88, 0, .22], blackOxideSteel, .055, .016, "terminal-inner-right-jamb");

  for (const x of [-6.3, 6.3]) {
    for (const y of [-5.08, 5.08]) {
      addBeveledPanel(group, [.92, .78, .2], [x, y, .49], agedGunmetal, .14, .022, "terminal-corner-cap");
    }
  }

  // Side service louvers are true geometry, not a repeated image. One instanced
  // batch supplies the deep side-wall rhythm visible when the final FOV widens.
  const louverStations = [];
  for (const x of [-6.02, 6.02]) {
    for (let index = 0; index < 12; index += 1) {
      louverStations.push([x, -3.96 + index * .72, .12, Math.sign(x) * (index % 2 ? .025 : -.025)]);
    }
  }
  const sideLouvers = new THREE.InstancedMesh(boxGeometry(.58, .1, .54), blackOxideSteel, louverStations.length);
  const sideLouverMatrix = new THREE.Matrix4();
  const sideLouverQuaternion = new THREE.Quaternion();
  const sideLouverScale = new THREE.Vector3(1, 1, 1);
  louverStations.forEach(([x, y, z, yaw], index) => {
    sideLouverQuaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
    sideLouverMatrix.compose(new THREE.Vector3(x, y, z), sideLouverQuaternion, sideLouverScale);
    sideLouvers.setMatrixAt(index, sideLouverMatrix);
  });
  sideLouvers.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  sideLouvers.receiveShadow = true;
  group.add(sideLouvers);

  const portalFasteners = [];
  for (let index = 0; index < 15; index += 1) {
    const x = -5.52 + index * .79;
    portalFasteners.push([x, 5.08, .54]);
    if (Math.abs(x) >= priorityPortalAperture * .5 + .16) {
      portalFasteners.push([x, -5.08, .54]);
    }
  }
  for (let index = 0; index < 11; index += 1) {
    const y = -4.04 + index * .81;
    portalFasteners.push([-6.3, y, .54], [6.3, y, .54]);
  }
  const portalBolts = new THREE.InstancedMesh(cylinderGeometry(.055, .07, 14), turnedSteel, portalFasteners.length);
  const portalWashers = new THREE.InstancedMesh(torusGeometry(.082, .015, 7, 16), gasketRubber, portalFasteners.length);
  const portalBoltSlots = new THREE.InstancedMesh(boxGeometry(.072, .014, .012), deepGraphite, portalFasteners.length);
  const frontBoltRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  portalFasteners.forEach((position, index) => {
    portalMatrix.copy(frontBoltRotation).setPosition(...position);
    portalBolts.setMatrixAt(index, portalMatrix);
    portalMatrix.identity().setPosition(position[0], position[1], position[2] + .04);
    portalWashers.setMatrixAt(index, portalMatrix);
    portalMatrix.makeRotationZ(index % 3 === 0 ? -.18 : index % 3 === 1 ? .08 : .21)
      .setPosition(position[0], position[1], position[2] + .04);
    portalBoltSlots.setMatrixAt(index, portalMatrix);
  });
  portalBolts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  portalWashers.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  portalBoltSlots.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  portalBolts.castShadow = false;
  portalBoltSlots.castShadow = false;
  group.add(portalBolts, portalWashers, portalBoltSlots);
  scene.add(group);

  // Two braided looms terminate at real perimeter service banks. Their paths
  // stay outside the display apertures while adding the layered cable density
  // that distinguishes a working mechanism from a flat sci-fi backdrop.
  createBraidedLoom([
    [-5.42, -3.72, -26.7],
    [-5.02, -3.08, -26.2],
    [-4.86, -2.18, -25.96],
    [-4.94, -1.32, -25.9],
    [-4.58, -.66, -25.82]
  ], .03, 5, 4.4, braidedCable);
  createBraidedLoom([
    [5.38, 4.0, -26.72],
    [5.02, 3.72, -26.2],
    [4.82, 3.18, -25.98],
    [4.94, 2.56, -25.9],
    [4.6, 2.18, -25.84]
  ], .027, 4, 3.8, braidedCable);
}

function createTerminalPrecisionDensityLayer() {
  const railGroup = new THREE.Group();
  railGroup.name = "terminal-precision-carriage-rails";
  // The carriage rails live on the rear structural plane. At the previous
  // depth their faces occupied the same volume as the portal jambs and clamp
  // row; this offset keeps a visible air gap behind both terminal crossbeams.
  railGroup.position.z = -26.95;

  // Replace empty perimeter bands with real linear-guide hardware. Every
  // carriage remains outside the measured carrier sweep while four instanced
  // batches provide the small-scale repetition of manufactured assemblies.
  // The upper guide owns a distinct rear datum behind the portal hoop. This
  // creates a visible service gap rather than stacking two full-length solid
  // beams and their carriage races inside one another.
  const upperPrecisionDepthOffset = -.64;
  const linearGuideShaftZ = .28;
  addBeveledPanel(railGroup, [10.78, .16, .48], [0, 4.48, -.12 + upperPrecisionDepthOffset], blackOxideSteel, .05, .014, "terminal-upper-linear-guide");
  addBeveledPanel(railGroup, [10.78, .16, .48], [0, -5.18, -.12], blackOxideSteel, .05, .014, "terminal-lower-linear-guide");
  addCylinder(railGroup, .045, 10.34, [0, 4.48, linearGuideShaftZ + upperPrecisionDepthOffset], turnedSteel, [0, 0, Math.PI / 2], 14);
  addCylinder(railGroup, .045, 10.34, [0, -5.18, linearGuideShaftZ], turnedSteel, [0, 0, Math.PI / 2], 14);

  const stations = [];
  for (const y of [4.48, -5.18]) {
    for (let index = 0; index < 12; index += 1) {
      stations.push({
        x: -4.72 + index * .86,
        y,
        zOffset: y > 0 ? upperPrecisionDepthOffset : 0
      });
    }
  }
  // Standardized bored blocks ride on the X-axis ground shafts. Moving both
  // shafts forward leaves a real air gap behind the block; the previous solid
  // boxes occupied the same z volume as both their shaft and the guide bed.
  const carriageOuterWidth = .22;
  const carriageOuterHeight = .25;
  const carriageBoreDiameter = .11;
  const carriageAxialDepth = .42;
  const carriageBevel = clampBevelToRingWall(
    .012,
    carriageOuterWidth,
    carriageOuterHeight,
    carriageBoreDiameter,
    carriageBoreDiameter,
    carriageAxialDepth
  );
  const carriageShape = roundedRectShape(carriageOuterWidth, carriageOuterHeight, .045);
  const carriageBore = new THREE.Path();
  carriageBore.absarc(0, 0, carriageBoreDiameter * .5, 0, Math.PI * 2, true);
  carriageShape.holes.push(carriageBore);
  const carriageBodyGeometry = extrudedGeometry(
    `terminal-linear-carriage:${carriageOuterWidth}:${carriageOuterHeight}:${carriageBoreDiameter}:${carriageAxialDepth}:${carriageBevel}`,
    carriageShape,
    carriageAxialDepth,
    carriageBevel,
    24
  );
  const carriageBodies = new THREE.InstancedMesh(carriageBodyGeometry, milledBlackSteel, stations.length);
  const carriageFaces = new THREE.InstancedMesh(boxGeometry(.29, .12, .055), agedGunmetal, stations.length);
  const carriageRaces = new THREE.InstancedMesh(torusGeometry(.062, .008, 8, 22), turnedSteel, stations.length * 2);
  const carriagePins = new THREE.InstancedMesh(cylinderGeometry(.018, .09, 9), phosphorBronze, stations.length * 3);
  const carriageStopDogs = new THREE.InstancedMesh(
    boxGeometry(.15, .055, .05),
    nickelSteel,
    stations.length
  );
  const matrix = new THREE.Matrix4();
  const axisQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  const faceQuaternion = new THREE.Quaternion();
  const frontQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  const unitScale = new THREE.Vector3(1, 1, 1);
  const faceScale = new THREE.Vector3();
  let raceIndex = 0;
  let pinIndex = 0;
  stations.forEach((station, index) => {
    const shaftZ = linearGuideShaftZ + station.zOffset;
    matrix.compose(new THREE.Vector3(station.x, station.y, shaftZ), axisQuaternion, unitScale);
    carriageBodies.setMatrixAt(index, matrix);
    faceScale.set(.9 + (index % 4) * .035, .9 + (index % 4) * .035, 1);
    matrix.compose(new THREE.Vector3(station.x, station.y, shaftZ + .14), faceQuaternion, faceScale);
    carriageFaces.setMatrixAt(index, matrix);
    for (const xOffset of [-.214, .214]) {
      matrix.compose(new THREE.Vector3(station.x + xOffset, station.y, shaftZ), axisQuaternion, unitScale);
      carriageRaces.setMatrixAt(raceIndex, matrix);
      raceIndex += 1;
    }
    for (const xOffset of [-.11, 0, .11]) {
      matrix.compose(new THREE.Vector3(station.x + xOffset, station.y, shaftZ + .18), frontQuaternion, unitScale);
      carriagePins.setMatrixAt(pinIndex, matrix);
      pinIndex += 1;
    }
    const inwardY = station.y > 0 ? station.y - .18 : station.y + .18;
    const dogRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, index % 2 ? .035 : -.025));
    matrix.compose(new THREE.Vector3(station.x, inwardY, shaftZ + .18), dogRotation, unitScale);
    carriageStopDogs.setMatrixAt(index, matrix);
  });
  carriageBodies.name = "terminal-bored-linear-carriage-bodies";
  carriageRaces.name = "terminal-x-axis-linear-carriage-races";
  carriageStopDogs.name = "terminal-linear-guide-stop-dogs";
  for (const mesh of [carriageBodies, carriageFaces, carriageRaces, carriagePins, carriageStopDogs]) {
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    railGroup.add(mesh);
  }
  scene.add(railGroup);

  // The existing terminal-upper-drive-bed is the single upper ball-screw
  // mechanism. A second coaxial actuator was removed here because duplicated
  // shafts and bearing blocks would occupy the same physical volume.

  // The pump occupies the lower-left service shelf rather than sharing volume
  // with the left portal jamb and vertical distribution rail. A dedicated
  // gland gives the incoming braided loom a physically explicit termination.
  addBeveledPanel(scene, [1.45, .68, .42], [-3.65, -3.9, -25.92], deepGraphite, .12, .024, "terminal-left-pump-housing");
  addBeveledPanel(scene, [1.25, .5, .13], [-3.65, -3.9, -25.63], agedGunmetal, .09, .016, "terminal-left-pump-face");
  const pumpDrive = createPrecisionGear(scene, {
    radius: .34,
    teeth: 15,
    depth: .2,
    position: [-3.82, -3.96, -25.48],
    surface: milledBlackSteel,
    rotation: -.07
  });
  const pumpPinion = createPrecisionGear(scene, {
    radius: .22,
    teeth: 10,
    depth: .17,
    position: [-3.42, -3.61, -25.47],
    surface: greasedBronze,
    rotation: .11
  });
  registerMeshedGearTrain({
    driver: pumpDrive,
    driverTeeth: 15,
    meshes: [{ node: pumpPinion, teeth: 10 }],
    direction: 1,
    engagementHalfTurns: 5.1,
    runningSpeed: .8025
  });
  addCylinder(scene, .12, .5, [-3.82, -3.96, -25.69], turnedSteel, [Math.PI / 2, 0, 0], 20);
  addCylinder(scene, .09, .44, [-3.42, -3.61, -25.67], turnedSteel, [Math.PI / 2, 0, 0], 18);
  addCylinder(scene, .12, .24, [-4.25, -3.9, -25.7], blackOxideSteel, [Math.PI / 2, 0, 0], 18);
  const pumpGland = new THREE.Mesh(torusGeometry(.15, .03, 8, 22), turnedSteel);
  pumpGland.position.set(-4.25, -3.9, -25.55);
  pumpGland.castShadow = false;
  scene.add(pumpGland);
  createBraidedLoom([
    [-5.48, -3.58, -26.38],
    [-5.02, -3.8, -26.2],
    [-4.66, -3.98, -26.02],
    [-4.42, -3.96, -25.88],
    [-4.25, -3.9, -25.78]
  ], .025, 5, 4.6, braidedCable, [.16, .36, .54]);
}

function createMechanicalInterior() {
  createVentThreshold();
  createTransitionPlenum();
  // The last station is widened into a terminal portal by createTunnelRib so
  // it can remain on the established -25 datum without crossing a carrier.
  [6.2, 3.1, -.4, -4.2, -8.4, -12.8, -17.2, -21.4, -25].forEach(createTunnelRib);
  createLongitudinalInfrastructure();
  createLayeredSupportStructures();

  createHeatSink(-5.25, 1.65, 4.8, .08);
  createHeatSink(5.15, -1.6, 2.4, -.06);
  createHeatSink(-5.2, -1.6, -5.5, .12);
  createHeatSink(5.2, 1.65, -7.8, -.1);
  createHeatSink(-5.1, 1.45, -14.2, .08);
  createHeatSink(5.15, -1.5, -18.5, -.12);

  const cableRoutes = [
    [[-5.8, 2.8, 6], [-4.7, 2.2, 1], [-5.4, 1.1, -5], [-3.9, .9, -11], [-4.7, 1.7, -19]],
    [[-5.55, 2.95, 6], [-4.45, 2.45, 1], [-5.1, 1.35, -5], [-3.65, 1.15, -11], [-4.45, 1.95, -19]],
    [[5.75, -2.75, 5], [4.65, -2.2, 0], [5.35, -1.25, -6], [3.85, -1, -12], [4.6, -1.65, -21]],
    [[5.5, -2.95, 5], [4.4, -2.4, 0], [5.05, -1.48, -6], [3.62, -1.22, -12], [4.35, -1.9, -21]],
    [[-2.8, 3.25, 3], [-3.5, 2.4, -2], [-2.7, 2.7, -9], [-3.2, 2.15, -17]],
    [[2.9, -3.2, 1], [3.6, -2.45, -4], [2.8, -2.7, -11], [3.3, -2.05, -19]]
  ];
  cableRoutes.forEach((route, index) => addTube(scene, route, index < 4 ? .075 : .05));

  for (let index = 0; index < 34; index += 1) {
    const side = index % 2 ? -1 : 1;
    const z = 4.5 - index * .78;
    const x = side * (4.15 + (index % 4) * .36);
    const y = -2.45 + (index % 5) * 1.15;
    addBox(scene, [.48 + (index % 3) * .16, .18, .6], [x, y, z], index % 3 ? graphite : machinedMetal, [0, side * .08, (index % 2) * .04]);
  }

  // A load-bearing beam frame replaces the former solid shared wall. The
  // negative space between these members is the three actual bay openings.
  const terminalFrame = new THREE.Group();
  terminalFrame.name = "terminal-carrier-beam-frame";
  terminalFrame.position.z = -26.47;
  addBeveledPanel(terminalFrame, [10.9, .3, .42], [0, 4.3, 0], agedGunmetal, .08, .02, "terminal-top-beam");
  addBeveledPanel(terminalFrame, [10.9, .3, .42], [0, -4.22, 0], agedGunmetal, .08, .02, "terminal-bottom-beam");
  addBeveledPanel(terminalFrame, [.3, 8.82, .42], [-5.3, .04, 0], graphite, .08, .02, "terminal-left-beam");
  addBeveledPanel(terminalFrame, [.3, 8.82, .42], [5.3, .04, 0], graphite, .08, .02, "terminal-right-beam");
  addBox(terminalFrame, [6.95, .11, .36], [0, .045, .02], blackOxideSteel);
  addBox(terminalFrame, [.18, 3.78, .36], [-.04, 2.08, .02], blackOxideSteel);
  addBox(terminalFrame, [.22, 3.92, .38], [-3.8, 2.03, -.02], graphite);
  addBox(terminalFrame, [.22, 4.02, .38], [4.03, 2.05, -.02], graphite);
  addBox(terminalFrame, [.22, 4.05, .38], [-2.67, -1.98, -.02], graphite);
  addBox(terminalFrame, [.22, 4.05, .38], [2.67, -1.98, -.02], graphite);
  scene.add(terminalFrame);

  // Wider display pressure wells improve live-control legibility without
  // making the upper carriers touch the central spine. The meeting aperture
  // gains the most width because it contains the densest session controls.
  createTerminalCarrierBay("course", -1.91, 1.93, 3.49, 3.64);
  createTerminalCarrierBay("meeting", 1.98, 2.08, 3.83, 3.9);
  createTerminalCarrierBay("priorities", 0, -1.98, 5.05, 3.92);
  createTerminalServiceInfrastructure();
  createTerminalMicrodetailBatches();
  createTerminalTransmissionLayer();
  createTerminalOuterPortal();
  createTerminalPrecisionDensityLayer();

  courseHinge = new THREE.Group();
  courseHinge.name = "course-terminal-hinge";
  courseHinge.position.set(-3.8, 1.93, -25.96);
  courseHinge.rotation.y = -1.48;
  courseExtract = new THREE.Group();
  courseExtract.name = "course-telescoping-carriage";
  courseCarrier = createCarrier("course", 3.22, 3.39, "left");
  scene.remove(courseCarrier);
  courseCarrier.position.set(1.89, 0, 0);
  courseExtract.add(courseCarrier);
  addBox(courseExtract, [2.14, .095, .16], [.91, 1.48, -.24], blackOxideSteel);
  addBox(courseExtract, [2.14, .095, .16], [.91, -1.48, -.24], blackOxideSteel);
  addBox(courseExtract, [1.62, .045, .07], [.61, 1.48, -.13], wornEdge);
  addBox(courseExtract, [1.62, .045, .07], [.61, -1.48, -.13], wornEdge);
  courseHinge.add(courseExtract);
  scene.add(courseHinge);
  addVerticalHingeHardware(-3.8, 1.93, -25.96, 3.45, 1);
  courseLatch = addBox(scene, [.32, .7, .42], [-3.5, 3.73, -25.67], machinedMetal, [0, 0, .12]);
  addBox(scene, [.11, .3, .07], [-3.48, 3.73, -25.43], amberDiagnostic);

  meetingHinge = new THREE.Group();
  meetingHinge.name = "meeting-terminal-hinge";
  meetingHinge.position.set(3.97, 2.08, -25.96);
  meetingHinge.rotation.y = 1.48;
  meetingExtract = new THREE.Group();
  meetingExtract.name = "meeting-telescoping-carriage";
  meetingCarrier = createCarrier("meeting", 3.56, 3.65, "right");
  scene.remove(meetingCarrier);
  meetingCarrier.position.set(-1.99, 0, 0);
  meetingExtract.add(meetingCarrier);
  addBox(meetingExtract, [2.26, .095, .16], [-.96, 1.59, -.24], blackOxideSteel);
  addBox(meetingExtract, [2.26, .095, .16], [-.96, -1.59, -.24], blackOxideSteel);
  addBox(meetingExtract, [1.7, .045, .07], [-.66, 1.59, -.13], wornEdge);
  addBox(meetingExtract, [1.7, .045, .07], [-.66, -1.59, -.13], wornEdge);
  meetingHinge.add(meetingExtract);
  scene.add(meetingHinge);
  addVerticalHingeHardware(3.97, 2.08, -25.96, 3.65, -1);
  addBox(scene, [.34, .74, .42], [3.63, 4.04, -25.67], machinedMetal, [0, 0, -.12]);
  addBox(scene, [.1, .31, .07], [3.61, 4.04, -25.43], amberDiagnostic);

  priorityHinge = new THREE.Group();
  priorityHinge.name = "priorities-terminal-hinge";
  priorityHinge.position.set(0, -3.8, -25.96);
  priorityHinge.rotation.x = 1.48;
  priorityExtract = new THREE.Group();
  priorityExtract.name = "priorities-telescoping-carriage";
  priorityCarrier = createCarrier("priorities", 4.79, 3.64, "bottom");
  scene.remove(priorityCarrier);
  priorityCarrier.position.set(0, 1.82, 0);
  priorityExtract.add(priorityCarrier);
  addBox(priorityExtract, [.11, 2.05, .16], [-2.15, .86, -.24], blackOxideSteel);
  addBox(priorityExtract, [.11, 2.05, .16], [2.15, .86, -.24], blackOxideSteel);
  addBox(priorityExtract, [.05, 1.5, .07], [-2.15, .58, -.13], wornEdge);
  addBox(priorityExtract, [.05, 1.5, .07], [2.15, .58, -.13], wornEdge);
  priorityHinge.add(priorityExtract);
  scene.add(priorityHinge);
  addHorizontalHingeHardware(0, -3.8, -25.96, 4.92);
  priorityLock = new THREE.Group();
  priorityLock.position.set(0, -3.48, -25.62);
  addBox(priorityLock, [.6, .44, .38], [0, 0, 0], machinedMetal);
  addBox(priorityLock, [.23, .1, .07], [0, 0, .23], amberDiagnostic);
  scene.add(priorityLock);

  createResultTerminalLift();

  // Exposed reduction gears make the staggered deployment mechanically
  // legible. They are small enough to read as service hardware rather than a
  // decorative spectacle.
  const leftTerminalGear = createPrecisionGear(scene, {
    radius: .36,
    teeth: 13,
    depth: .18,
    position: [-4.15, -.72, -25.58],
    surface: agedGunmetal,
    rotation: .08
  });
  sparkDriverGear = createPrecisionGear(scene, {
    radius: .36,
    teeth: 15,
    depth: .18,
    position: [4.16, -.82, -25.54],
    surface: milledBlackSteel,
    rotation: -.04
  });
  const lowerTerminalGear = createPrecisionGear(scene, {
    radius: .31,
    teeth: 12,
    depth: .17,
    position: [3.15, -3.18, -25.5],
    surface: agedGunmetal,
    rotation: .1
  });
  registerMeshedGearTrain({
    driver: leftTerminalGear,
    driverTeeth: 13,
    direction: 1,
    engagementHalfTurns: 5.2,
    runningSpeed: .81
  });
  registerMeshedGearTrain({
    driver: sparkDriverGear,
    driverTeeth: 15,
    meshes: [{ node: sparkDrivenGear, teeth: 11 }],
    direction: -1,
    engagementHalfTurns: 4.4,
    runningSpeed: .75
  });
  registerMeshedGearTrain({
    driver: lowerTerminalGear,
    driverTeeth: 12,
    direction: 1,
    engagementHalfTurns: 6.3,
    runningSpeed: .8925
  });
  // The left service trunk runs behind the hydraulic block; the former front
  // route cut through the manifold shell and read as an impossible overlay.
  addTube(scene, [[-4.46, -.65, -26.24], [-4.72, .42, -26.24], [-4.48, 2.7, -26.22]], .036, braidedCable);
  addTube(scene, [
    [4.72, -.48, -25.18],
    [5.08, -.3, -25.18],
    [5.62, -.1, -25.36],
    [5.64, 1.45, -25.34],
    [5.62, 2.8, -25.38]
  ], .036, cableMaterial);

  const core = new THREE.Group();
  // The diagnostic core is a rear service layer, not a face occupying the same
  // plane as the carrier bays.
  core.position.z = -27.72;
  addBox(core, [12.4, .42, .55], [0, 3.02, 0], deepGraphite);
  addBox(core, [12.4, .42, .55], [0, -3.02, 0], deepGraphite);
  addBox(core, [.42, 5.65, .55], [-5.96, 0, 0], deepGraphite);
  addBox(core, [.42, 5.65, .55], [5.96, 0, 0], deepGraphite);
  const railXs = [-4.4, -2.2, 0, 2.2, 4.4];
  railXs.forEach((x, railIndex) => {
    addBox(core, [.13, 5.35, .22], [x, 0, .42], edgeMetal);
    for (let slot = 0; slot < 4; slot += 1) {
      const y = 2.05 - slot * 1.35 + (railIndex % 2 ? -.12 : .08);
      addBox(core, [1.5, .62, .34], [x, y, .56], smokedGlass);
      addBox(core, [.07, .07, .06], [x + .57, y - .2, .78], whiteDiagnostic);
    }
  });
  addBox(core, [.42, 5.7, .38], [0, 0, .35], deepGraphite);
  addBox(core, [.065, 5.18, .08], [0, 0, .58], agedGunmetal);
  scene.add(core);

  gearDrive = createGear(.86, 18, .32, machinedMetal);
  gearDrive.position.set(3.85, -2.1, -18.2);
  scene.add(gearDrive);
  secondaryGear = createGear(.57, 14, .28, graphite);
  secondaryGear.position.set(2.55, -2.42, -18.05);
  scene.add(secondaryGear);
  registerMeshedGearTrain({
    driver: gearDrive,
    driverTeeth: 18,
    meshes: [{ node: secondaryGear, teeth: 14 }],
    direction: -1,
    engagementRange: [.64, .94],
    engagementHalfTurns: 8,
    runningSpeed: 1.34
  });
  addTube(scene, [[3.9, -2.1, -18.4], [4.5, -1.25, -19.7], [4.2, -.4, -22.2]], .04, cableMaterial);

  const upperIdler = createGear(.42, 13, .22, agedGunmetal);
  upperIdler.position.set(-4.34, 2.08, -8.9);
  upperIdler.rotation.y = .08;
  scene.add(upperIdler);
  registerMeshedGearTrain({
    driver: upperIdler,
    driverTeeth: 13,
    direction: 1,
    engagementHalfTurns: 5.6,
    runningSpeed: .84
  });
  addBox(scene, [1.36, .18, .52], [-4.34, 2.08, -9.18], graphite);
  addCylinder(scene, .11, .72, [-4.34, 2.08, -8.98], brushedAluminum, [Math.PI / 2, 0, 0], 18);

  const lowerIdler = createGear(.36, 12, .2, machinedMetal);
  lowerIdler.position.set(4.46, -1.95, -13.95);
  lowerIdler.rotation.y = -.06;
  scene.add(lowerIdler);
  registerMeshedGearTrain({
    driver: lowerIdler,
    driverTeeth: 12,
    direction: -1,
    engagementHalfTurns: 7.2,
    runningSpeed: .96
  });
  addBox(scene, [1.18, .16, .46], [4.46, -1.95, -14.22], graphite);
  addCylinder(scene, .095, .64, [4.46, -1.95, -14.02], brushedAluminum, [Math.PI / 2, 0, 0], 18);

  createSparks();
  createSuspendedParticulate();
}

function createSparks() {
  // Keep the event physically small but temporally legible: more fine streaks
  // read as tooth-contact debris without turning the mechanism into fireworks.
  const count = 26;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const lives = new Float32Array(count);
  const angles = new Float32Array(count);
  const scales = new Float32Array(count);
  const streakWeights = new Float32Array(count);
  const geometry = new THREE.BufferGeometry();
  geometryCache.set(`sparks:${geometry.id}`, geometry);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aLife", new THREE.BufferAttribute(lives, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("aAngle", new THREE.BufferAttribute(angles, 1));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aStreak", new THREE.BufferAttribute(streakWeights, 1));
  sparkMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 }
    },
    vertexShader: `
      attribute vec3 color;
      attribute float aLife;
      attribute float aAngle;
      attribute float aScale;
      attribute float aStreak;
      varying vec3 vColor;
      varying float vLife;
      varying float vAngle;
      varying float vStreak;
      uniform float uPixelRatio;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = clamp(7.0 / max(1.0, -viewPosition.z), 0.48, 1.35);
        gl_PointSize = (3.1 + 6.4 * aLife) * aScale * uPixelRatio * perspective;
        gl_Position = projectionMatrix * viewPosition;
        vColor = color;
        vLife = aLife;
        vAngle = aAngle;
        vStreak = aStreak;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vLife;
      varying float vAngle;
      varying float vStreak;
      uniform float uOpacity;

      void main() {
        vec2 point = gl_PointCoord - vec2(0.5);
        float cosine = cos(vAngle);
        float sine = sin(vAngle);
        vec2 streak = mat2(cosine, -sine, sine, cosine) * point;
        float crossEdge = mix(0.11, 0.055, vStreak);
        float lengthEdge = mix(0.22, 0.53, vStreak);
        float crossSection = 1.0 - smoothstep(crossEdge * 0.38, crossEdge, abs(streak.y));
        float lengthMask = 1.0 - smoothstep(lengthEdge * 0.7, lengthEdge, abs(streak.x));
        float core = 1.0 - smoothstep(0.012, mix(0.052, 0.034, vStreak), length(streak - vec2(0.14, 0.0)));
        float alpha = max(core * 0.72, crossSection * lengthMask * mix(0.22, 0.66, vStreak)) * vLife * uOpacity;
        if (alpha < 0.012) discard;
        vec3 hotCore = mix(vColor, vec3(1.0, 0.86, 0.54), core * 0.28);
        gl_FragColor = vec4(hotCore, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    // Sparks obey the scene depth buffer. A small physical stand-off from the
    // tooth face prevents z-fighting without drawing a white overlay through
    // gears, shafts or the carrier bezels.
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  disposableMaterials.add(sparkMaterial);
  sparkPoints = new THREE.Points(geometry, sparkMaterial);
  // Derive the emitter from the two pitch-circle centres. The driver radius is
  // .36 and the pinion radius is .23, so their .59 centre distance creates a
  // real contact point instead of a decorative particle source in empty space.
  scene.updateMatrixWorld(true);
  sparkDriverGear?.getWorldPosition(sparkDriverCenter);
  sparkDrivenGear?.getWorldPosition(sparkDrivenCenter);
  sparkContactPoint.copy(sparkDriverCenter).lerp(sparkDrivenCenter, .36 / (.36 + .23));
  // Stand the emitter just proud of the tooth face: enough to avoid z-fighting
  // while keeping every streak visibly born at the physical pitch contact.
  sparkContactPoint.z += .14;
  sparkPoints.position.copy(sparkContactPoint);
  sparkPoints.frustumCulled = false;
  sparkSeeds = Array.from({ length: count }, (_, index) => {
    const isStreak = index < 10;
    return {
      delay: isStreak ? index * .011 : .018 + (index - 10) * .006,
      speed: isStreak ? 1.82 + (index % 4) * .17 : .98 + (index % 4) * .12,
      drag: isStreak ? 2.45 + (index % 3) * .2 : 3.05 + (index % 2) * .22,
      lifetime: isStreak ? .27 + (index % 4) * .038 : .2 + (index % 3) * .036,
      // The chosen tangent points away from the carrier faces. A narrow spread
      // reads as tooth ejecta rather than a permanently attached firework fan.
      angle: .5 + ((index * 7) % 13) / 13 * .34,
      depth: -.075 + ((index * 11) % 13) / 13 * .15,
      scale: isStreak ? .71 + (index % 3) * .075 : .34 + (index % 3) * .05,
      streak: isStreak ? .88 + (index % 2) * .08 : .04
    };
  });
  sparkSeeds.forEach((seed, index) => {
    angles[index] = seed.angle;
    scales[index] = seed.scale;
    streakWeights[index] = seed.streak;
  });
  scene.add(sparkPoints);

  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage)
  );
  geometryCache.set(`spark-trails:${trailGeometry.id}`, trailGeometry);
  sparkTrailMaterial = new THREE.LineBasicMaterial({
    color: 0xf08b24,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  disposableMaterials.add(sparkTrailMaterial);
  sparkTrails = new THREE.LineSegments(trailGeometry, sparkTrailMaterial);
  sparkTrails.position.copy(sparkPoints.position);
  sparkTrails.frustumCulled = false;
  sparkTrails.renderOrder = 20;
  scene.add(sparkTrails);

  sparkLight = new THREE.PointLight(0xffb45a, 0, 1.45, 2);
  sparkLight.position.copy(sparkPoints.position);
  sparkLight.position.z += .16;
  scene.add(sparkLight);
}

function createLights() {
  ambientLight = new THREE.HemisphereLight(0xd6d3cd, 0x050403, .62);
  scene.add(ambientLight);
  frontKey = new THREE.SpotLight(0xfff5e5, 235, 32, .72, .72, 1.25);
  frontKey.position.set(-4.8, 7.8, 19.4);
  frontKey.target.position.set(-.8, 3.15, 11.4);
  frontKey.castShadow = true;
  frontKey.shadow.mapSize.set(1024, 1024);
  frontKey.shadow.bias = -.00035;
  scene.add(frontKey, frontKey.target);

  frontFill = new THREE.SpotLight(0xd2c7b6, 118, 30, .78, .9, 1.45);
  frontFill.position.set(6.4, -.8, 18.2);
  frontFill.target.position.set(1.2, 2.35, 11.25);
  scene.add(frontFill, frontFill.target);

  frontEdge = new THREE.DirectionalLight(0xb7afa2, 1.25);
  frontEdge.position.set(0, 5.5, 16.5);
  frontEdge.target.position.set(0, 2.8, 11.2);
  scene.add(frontEdge, frontEdge.target);

  // Narrow neutral grazers model softbox reflections along the exterior's
  // machined edges. They intentionally do not cast shadows and fade before
  // the lens crosses the grille, so the duct and terminal retain deep blacks.
  exteriorLeftRim = new THREE.SpotLight(0xd8d0c3, 55, 28, .32, .86, 1.55);
  exteriorLeftRim.position.set(-7.8, 6.5, 18);
  exteriorLeftRim.target.position.set(-5.9, 3.5, 11.7);
  scene.add(exteriorLeftRim, exteriorLeftRim.target);

  exteriorRightRim = new THREE.SpotLight(0xbec1bf, 38, 27, .34, .88, 1.6);
  exteriorRightRim.position.set(7.8, 5.6, 17.5);
  exteriorRightRim.target.position.set(5.9, 3.1, 11.7);
  scene.add(exteriorRightRim, exteriorRightRim.target);

  // Keep the maintenance source physically inside and off-axis. The previous
  // coaxial lamp sat millimetres in front of the LCD backing and produced a
  // saturated circular reflection while the camera descended toward the vent.
  thresholdLight = new THREE.SpotLight(0xcbbba2, 0, 12, .58, .84, 1.8);
  thresholdLight.position.set(-.58, .44, 10.82);
  thresholdLight.target.position.set(.42, -.12, 7.1);
  thresholdLight.castShadow = true;
  thresholdLight.shadow.mapSize.set(1024, 1024);
  scene.add(thresholdLight, thresholdLight.target);

  // An unmodeled off-axis bounce source reveals the loft curvature without a
  // visible fixture or an exposure lift. It is active only during the crossing.
  ductFillLight = new THREE.SpotLight(0xb8afa2, 0, 8.2, .48, .93, 2);
  ductFillLight.position.set(-.74, .52, 10.62);
  ductFillLight.target.position.set(.66, -.26, 7.16);
  scene.add(ductFillLight, ductFillLight.target);

  // Shadow-free, off-axis maintenance grazers replace centered point bounces.
  // Their soft cones reveal one wall at a time, so the liner never turns into
  // an evenly lit champagne funnel as the lens crosses the selected hole.
  ductWallLight = new THREE.SpotLight(0xbcae99, 0, 3.2, .46, .95, 2.2);
  ductWallLight.position.set(-.18, .13, 10.38);
  ductWallLight.target.position.set(.48, -.22, 8.68);
  scene.add(ductWallLight, ductWallLight.target);

  ductExitLight = new THREE.SpotLight(0x9f978b, 0, 4.6, .38, .96, 2.15);
  ductExitLight.position.set(.42, -.24, 8.26);
  ductExitLight.target.position.set(-.7, .34, 6.46);
  scene.add(ductExitLight, ductExitLight.target);

  cameraInspectionLight = new THREE.SpotLight(0xaaa399, 0, 3.8, .78, 1, 2.2);
  cameraInspectionLight.position.set(0, 0, 12);
  cameraInspectionLight.target.position.set(0, 0, 8);
  scene.add(cameraInspectionLight, cameraInspectionLight.target);

  const courseLight = new THREE.PointLight(0xe8ddc8, 0, 13, 1.8);
  courseLight.position.set(-2.5, 2.2, -2.4);
  scene.add(courseLight);
  // The first corridor sources wake only after the camera has cleared the
  // extended plenum. Their former .45/.47 onset illuminated the rapidly
  // growing wall from behind, causing a multi-stop exposure jump between two
  // adjacent scroll frames even though the camera path itself was continuous.
  routePhaseLights.push({ light: courseLight, peak: 74, window: [.53, .64, .7, .8] });
  const meetingLight = new THREE.PointLight(0xddd1bc, 0, 14, 1.9);
  meetingLight.position.set(2.5, 1.8, -10.2);
  scene.add(meetingLight);
  routePhaseLights.push({ light: meetingLight, peak: 78, window: [.54, .62, .73, .82] });
  const coreLight = new THREE.PointLight(0xf0e5d2, 0, 13, 1.7);
  coreLight.position.set(0, 2.4, -20.2);
  scene.add(coreLight);
  routePhaseLights.push({ light: coreLight, peak: 92, window: [.63, .72, .84, .94] });
  const amberLight = new THREE.PointLight(0xd77b1c, 0, 4.5, 2);
  amberLight.position.set(3.5, -1.8, -17.3);
  scene.add(amberLight);
  routePhaseLights.push({ light: amberLight, peak: 32, window: [.61, .69, .84, .93] });

  const rackLight = new THREE.SpotLight(0xd8cbb3, 0, 22, .32, .72, 1.8);
  rackLight.position.set(-4.7, 2.7, -3.2);
  rackLight.target.position.set(-1.8, .3, -14.5);
  scene.add(rackLight, rackLight.target);
  routePhaseLights.push({ light: rackLight, peak: 82, window: [.55, .66, .74, .84] });
  const serviceLight = new THREE.SpotLight(0xc8b99f, 0, 18, .28, .78, 1.9);
  serviceLight.position.set(4.6, -2.5, -10.1);
  serviceLight.target.position.set(1.4, -.2, -20.5);
  scene.add(serviceLight, serviceLight.target);
  routePhaseLights.push({ light: serviceLight, peak: 68, window: [.55, .64, .76, .88] });
  plenumLight = new THREE.SpotLight(0xc3a881, 0, 6.2, .42, .94, 2.15);
  plenumLight.position.set(-1.18, .7, 6.54);
  plenumLight.target.position.set(.62, -.28, 8.08);
  scene.add(plenumLight, plenumLight.target);
  plenumRimLight = new THREE.SpotLight(0x9e978d, 0, 5, .34, .96, 2.2);
  plenumRimLight.position.set(1.52, -.84, 6.28);
  plenumRimLight.target.position.set(-.42, .18, 7.82);
  scene.add(plenumRimLight, plenumRimLight.target);

  // This shielded practical projects down the corridor rather than spilling
  // straight back onto the nearby liner. The long, soft cone reveals actual
  // rails and service hardware while its own modeled lens passes the camera.
  plenumEntryLight = new THREE.SpotLight(0xaaa49a, 0, 8.5, .5, .9, 2.15);
  plenumEntryLight.position.set(.82, -.42, 7.3);
  plenumEntryLight.target.position.set(-.18, .1, 2.55);
  scene.add(plenumEntryLight, plenumEntryLight.target);

  // A dim, modeled inspection luminaire sits midway down the extended
  // plenum. It reveals the next wall section before the high-energy corridor
  // rack lights wake, keeping the passage physically continuous without an
  // exposure automation or an invisible full-scene fill.
  plenumContinuationLight = new THREE.PointLight(0xb7aea0, 0, 7.2, 2.05);
  plenumContinuationLight.position.set(-2.78, 1.62, 4.74);
  scene.add(plenumContinuationLight);

  // Terminal-only studio lights enter late in the camera run. They reveal
  // black-on-black depth by grazing bevels and cylindrical hardware rather
  // than lifting the global ambient or bleaching the control displays.
  terminalKeyLight = new THREE.SpotLight(0xe7e3dc, 0, 18, .46, .78, 1.82);
  terminalKeyLight.position.set(-5.35, 4.7, -18.55);
  terminalKeyLight.target.position.set(-5.05, 1.2, -26.2);
  terminalKeyLight.castShadow = true;
  terminalKeyLight.shadow.mapSize.set(1024, 1024);
  terminalKeyLight.shadow.bias = -.00022;
  scene.add(terminalKeyLight, terminalKeyLight.target);

  terminalFillLight = new THREE.SpotLight(0xc7c4bd, 0, 17, .56, .82, 1.9);
  terminalFillLight.position.set(5.75, 2.8, -19.4);
  // Aim the broad fill at the right service cassette instead of the exposed
  // reduction pair, preserving the spark as the only hot local accent.
  terminalFillLight.target.position.set(5.38, 1.18, -26.42);
  scene.add(terminalFillLight, terminalFillLight.target);

  terminalRimLight = new THREE.PointLight(0xe1ded7, 0, 8.5, 2);
  terminalRimLight.position.set(.1, 4.15, -23.2);
  scene.add(terminalRimLight);

  terminalLowerFillLight = new THREE.SpotLight(0xc1beb7, 0, 12, .54, .88, 2.05);
  terminalLowerFillLight.position.set(.35, -4.35, -20.1);
  terminalLowerFillLight.target.position.set(0, -4.75, -26.25);
  scene.add(terminalLowerFillLight, terminalLowerFillLight.target);

  terminalLeftServiceLight = new THREE.SpotLight(0xbcb9b2, 0, 10.5, .48, .9, 2.15);
  terminalLeftServiceLight.position.set(-5.35, -.95, -21.15);
  terminalLeftServiceLight.target.position.set(-4.35, -1.05, -26.55);
  scene.add(terminalLeftServiceLight, terminalLeftServiceLight.target);

  // Large rectangular sources behave like off-camera workshop softboxes. They
  // produce long, continuous highlights across milled edges instead of the
  // clipped white spots caused by very intense point sources.
  terminalLeftSoftbox = new THREE.RectAreaLight(0xd4d1ca, 0, 5.8, 5.2);
  terminalLeftSoftbox.position.set(-4.9, 1.1, -20.7);
  terminalLeftSoftbox.lookAt(-2.4, .45, -26.25);
  scene.add(terminalLeftSoftbox);

  terminalRightSoftbox = new THREE.RectAreaLight(0xc3c0b9, 0, 4.8, 5.8);
  terminalRightSoftbox.position.set(5.15, -.2, -21.15);
  terminalRightSoftbox.lookAt(3.1, -.55, -26.35);
  scene.add(terminalRightSoftbox);

  terminalTopSoftbox = new THREE.RectAreaLight(0xddd9d1, 0, 8.6, .72);
  terminalTopSoftbox.position.set(0, 4.92, -21.5);
  terminalTopSoftbox.lookAt(0, 3.6, -26.4);
  scene.add(terminalTopSoftbox);

  // Broad grazing spots are the dependable WebGL fallback for the area-light
  // softboxes above. They illuminate only the structural portal and keep the
  // LCD carriers out of the clipped white range.
  terminalLeftPortalLight = new THREE.SpotLight(0xd2cfc8, 0, 15, .52, .94, 2.05);
  terminalLeftPortalLight.position.set(-8.1, .6, -20.3);
  terminalLeftPortalLight.target.position.set(-6.05, .05, -25.92);
  scene.add(terminalLeftPortalLight, terminalLeftPortalLight.target);

  terminalRightPortalLight = new THREE.SpotLight(0xc5c2bb, 0, 15, .52, .94, 2.05);
  terminalRightPortalLight.position.set(8.1, -.3, -20.5);
  terminalRightPortalLight.target.position.set(6.05, 0, -25.92);
  scene.add(terminalRightPortalLight, terminalRightPortalLight.target);

  terminalTopPortalLight = new THREE.SpotLight(0xd8d4cc, 0, 14, .48, .95, 2.1);
  terminalTopPortalLight.position.set(0, 7.3, -20.6);
  terminalTopPortalLight.target.position.set(0, 5.02, -25.94);
  scene.add(terminalTopPortalLight, terminalTopPortalLight.target);

  terminalBottomPortalLight = new THREE.SpotLight(0xbcb9b2, 0, 13, .5, .96, 2.15);
  terminalBottomPortalLight.position.set(.3, -6.8, -20.8);
  terminalBottomPortalLight.target.position.set(0, -5.02, -25.94);
  scene.add(terminalBottomPortalLight, terminalBottomPortalLight.target);

  // A low-intensity camera-side bounce supplies the broad frontal energy of a
  // product-photography softbox. It reveals micro-bevels across the backplane
  // without replacing the stronger directional hierarchy above.
  terminalFrontWash = new THREE.DirectionalLight(0xcfccc5, 0);
  terminalFrontWash.position.set(-2.2, 3.4, -18.6);
  terminalFrontWash.target.position.set(0, 0, -26.2);
  scene.add(terminalFrontWash, terminalFrontWash.target);
}

function createGeometricBackplane() {
  const group = new THREE.Group();
  group.name = "terminal-geometric-backplane";
  // Move the shell rearward enough to support three genuine depth planes while
  // keeping every static module behind the carrier sweep envelope.
  group.position.z = -28.05;

  addBeveledPanel(group, [15.2, 9.7, .36], [0, 0, -.28], deepGraphite, .16, .035, "backplane-shell");
  addBox(group, [14.35, .24, .5], [0, 4.42, .03], machinedMetal);
  addBox(group, [14.35, .24, .5], [0, -4.42, .03], machinedMetal);
  addBox(group, [.24, 8.72, .5], [-6.98, 0, .03], agedGunmetal);
  addBox(group, [.24, 8.72, .5], [6.98, 0, .03], agedGunmetal);

  const modules = [
    { x: -5.1, y: 2.65, w: 2.55, h: 1.28, surface: graphite },
    { x: -2.1, y: 2.72, w: 2.7, h: 1.14, surface: agedGunmetal },
    { x: 1.05, y: 2.62, w: 2.92, h: 1.36, surface: graphite },
    { x: 4.62, y: 2.58, w: 3.25, h: 1.42, surface: agedGunmetal },
    { x: -4.58, y: .74, w: 3.15, h: 1.72, surface: agedGunmetal },
    { x: -.92, y: .55, w: 3.48, h: 2.02, surface: graphite },
    { x: 3.32, y: .58, w: 4.08, h: 1.94, surface: graphite },
    { x: -5.05, y: -2.12, w: 2.72, h: 2.02, surface: graphite },
    { x: -1.86, y: -2.35, w: 2.86, h: 1.62, surface: agedGunmetal },
    { x: 1.35, y: -2.28, w: 2.82, h: 1.78, surface: graphite },
    { x: 4.76, y: -2.16, w: 3.38, h: 2.08, surface: agedGunmetal }
  ];
  const fastenerPositions = [];
  modules.forEach(({ x, y, w, h, surface }, index) => {
    const layerIndex = index % 3;
    const layerDepth = [.05, .27, .47][layerIndex];
    const housingDepth = [.28, .38, .5][layerIndex];
    const frontSurfaceZ = layerDepth + housingDepth * .5 + .075;
    addBeveledPanel(group, [w, h, housingDepth], [x, y, layerDepth], surface, .08, .02, `backplane-module-${index}`);
    addBeveledPanel(group, [w - .22, h - .22, .1], [x, y, frontSurfaceZ], darkPolymer, .05, .01);
    const insetX = w * .5 - .14;
    const insetY = h * .5 - .14;
    fastenerPositions.push(
      [x - insetX, y - insetY, frontSurfaceZ + .08], [x + insetX, y - insetY, frontSurfaceZ + .08],
      [x - insetX, y + insetY, frontSurfaceZ + .08], [x + insetX, y + insetY, frontSurfaceZ + .08]
    );
    if (index % 2 === 0) {
      addBox(group, [w * .62, .045, .055], [x, y + h * .25, frontSurfaceZ + .095], edgeMetal);
      addBox(group, [w * .42, .035, .05], [x - w * .08, y - h * .22, frontSurfaceZ + .1], copperContact);
    }
  });

  const boltGeometry = cylinderGeometry(.043, .055, 12);
  const bolts = new THREE.InstancedMesh(boltGeometry, brushedAluminum, fastenerPositions.length);
  const boltRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const matrix = new THREE.Matrix4();
  fastenerPositions.forEach((position, index) => {
    matrix.copy(boltRotation).setPosition(position[0], position[1], position[2]);
    bolts.setMatrixAt(index, matrix);
  });
  bolts.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  bolts.castShadow = false;
  group.add(bolts);

  for (const x of [-3.55, 0, 3.55]) {
    addBox(group, [.08, 8.1, .1], [x, 0, .38], edgeMetal);
    addBox(group, [.035, 7.72, .07], [x + .09, 0, .445], copperContact);
  }
  const copperPinPositions = [];
  const steelPinPositions = [];
  for (let bank = 0; bank < 4; bank += 1) {
    const y = 3.6 - bank * 2.38;
    for (let pin = -10; pin <= 10; pin += 1) {
      (pin % 4 === 0 ? copperPinPositions : steelPinPositions).push([pin * .24, y, .43]);
    }
  }
  const pinGeometry = cylinderGeometry(.024, .07, 8);
  const pinRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  const pinMatrix = new THREE.Matrix4();
  for (const [positions, surface] of [[copperPinPositions, copperContact], [steelPinPositions, edgeMetal]]) {
    const pins = new THREE.InstancedMesh(pinGeometry, surface, positions.length);
    positions.forEach((position, index) => {
      pinMatrix.copy(pinRotation).setPosition(...position);
      pins.setMatrixAt(index, pinMatrix);
    });
    pins.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    pins.castShadow = false;
    group.add(pins);
  }

  addTube(group, [[-6.45, 3.8, .48], [-4.9, 3.15, .62], [-3.1, 1.45, .64], [-1.2, -.25, .58]], .055, braidedCable);
  addTube(group, [[6.4, -3.65, .5], [5.05, -2.95, .68], [3.5, -1.35, .63], [1.7, .18, .56]], .048, cableMaterial);
  scene.add(group);
}

function updateMechanisms(progress) {
  // Result mode is sequenced rather than cross-faded: hinge rotation closes
  // first, telescoping carriages retract second, and latches seat third. The
  // large result lift does not begin crossing the opening until all three old
  // carriers are inside their bays.
  const resultHingeStow = smoothstep(.02, .18, resultModeBlend);
  const plannerHingePermission = 1 - smoothstep(.02, .18, resultModeBlend);
  const plannerReachPermission = 1 - smoothstep(.22, .34, resultModeBlend);
  const plannerReleasePermission = 1 - smoothstep(.3, .4, resultModeBlend);
  const courseRelease = smoothstep(.64, .69, progress) * plannerReleasePermission;
  const courseOpen = smoothstep(.67, .755, progress) * plannerHingePermission;
  const coursePlannerOpen = smoothstep(.67, .755, progress);
  // Extract each carrier through its aperture before beginning the hinge turn;
  // otherwise the wider face flange sweeps through the solid bay return wall.
  const courseReach = smoothstep(.61, .665, progress) * plannerReachPermission;
  courseHinge.rotation.y = THREE.MathUtils.lerp(-1.48, .075, courseOpen);
  // Result storage is a deeper, face-forward rack position. Rotating the old
  // carriers side-on here would send their broad plates toward the camera and
  // through the fourth display even though their slide rails were retracted.
  if (resultHingeStow > 0) {
    const coursePlannerRotation = THREE.MathUtils.lerp(-1.48, .075, coursePlannerOpen);
    courseHinge.rotation.y = THREE.MathUtils.lerp(coursePlannerRotation, 0, resultHingeStow);
  }
  courseHinge.rotation.z = Math.sin(courseOpen * Math.PI) * -.018 * (1 - resultHingeStow);
  courseExtract.position.z = THREE.MathUtils.lerp(.08, .78, courseReach);
  courseExtract.position.x = THREE.MathUtils.lerp(-.08, 0, courseReach);
  courseLatch.rotation.z = THREE.MathUtils.lerp(.12, -.72, courseRelease);
  courseLatch.position.y = THREE.MathUtils.lerp(3.73, 3.93, courseRelease);

  const meetingOpen = smoothstep(.77, .85, progress) * plannerHingePermission;
  const meetingPlannerOpen = smoothstep(.77, .85, progress);
  const meetingReach = smoothstep(.71, .765, progress) * plannerReachPermission;
  meetingHinge.rotation.y = THREE.MathUtils.lerp(1.48, -.075, meetingOpen);
  if (resultHingeStow > 0) {
    const meetingPlannerRotation = THREE.MathUtils.lerp(1.48, -.075, meetingPlannerOpen);
    meetingHinge.rotation.y = THREE.MathUtils.lerp(meetingPlannerRotation, 0, resultHingeStow);
  }
  meetingHinge.rotation.z = Math.sin(meetingOpen * Math.PI) * .016 * (1 - resultHingeStow);
  meetingExtract.position.z = THREE.MathUtils.lerp(.08, .795, meetingReach);
  meetingExtract.position.x = THREE.MathUtils.lerp(.08, 0, meetingReach);

  const priorityRelease = smoothstep(.81, .86, progress) * plannerReleasePermission;
  const priorityOpen = smoothstep(.84, .91, progress) * plannerHingePermission;
  const priorityPlannerOpen = smoothstep(.84, .91, progress);
  const priorityReach = smoothstep(.77, .835, progress) * plannerReachPermission;
  priorityHinge.rotation.x = THREE.MathUtils.lerp(1.48, -.055, priorityOpen);
  if (resultHingeStow > 0) {
    const priorityPlannerRotation = THREE.MathUtils.lerp(1.48, -.055, priorityPlannerOpen);
    priorityHinge.rotation.x = THREE.MathUtils.lerp(priorityPlannerRotation, 0, resultHingeStow);
  }
  priorityHinge.rotation.z = Math.sin(priorityOpen * Math.PI) * -.012 * (1 - resultHingeStow);
  priorityExtract.position.z = THREE.MathUtils.lerp(.06, .75, priorityReach);
  priorityExtract.position.y = THREE.MathUtils.lerp(-.07, 0, priorityReach);
  priorityLock.position.y = THREE.MathUtils.lerp(-3.48, -3.8, priorityRelease);
  priorityLock.rotation.z = THREE.MathUtils.lerp(0, .82, priorityRelease);

  const courseSpill = panelSpillLights.get("course");
  const meetingSpill = panelSpillLights.get("meeting");
  const prioritiesSpill = panelSpillLights.get("priorities");
  const resultSpill = panelSpillLights.get("result");
  if (courseSpill) {
    courseSpill.intensity = 5.4 * courseReach;
  }
  if (meetingSpill) {
    meetingSpill.intensity = 5.8 * meetingReach;
  }
  if (prioritiesSpill) {
    prioritiesSpill.intensity = 6.2 * priorityReach;
  }

  const resultLiftProgress = smoothstep(.46, .96, resultModeBlend);
  if (resultLift) {
    const liftY = THREE.MathUtils.lerp(
      RESULT_TERMINAL.stowedY,
      RESULT_TERMINAL.dockedY,
      resultLiftProgress
    );
    resultLift.position.y = liftY;
    resultLift.position.z = RESULT_TERMINAL.worldZ;
    const liftTravel = liftY - RESULT_TERMINAL.stowedY;
    const screwAngle = liftTravel / RESULT_TERMINAL.screwLead * Math.PI * 2;
    resultLeadScrews.forEach(({ node, handedness }) => {
      node.rotation.y = screwAngle * handedness;
    });
  }
  if (resultSpill) {
    resultSpill.intensity = 7.4 * smoothstep(.88, .98, resultModeBlend);
  }
  if (viewport) viewport.dataset.resultTerminalBlend = resultModeBlend.toFixed(4);

  continuousGearTrains.forEach(({
    members,
    direction,
    engagementRange,
    engagementHalfTurns,
    runningSpeed
  }) => {
    const engagement = smoothstep(engagementRange[0], engagementRange[1], progress);
    const driverTravel = (
      engagement * Math.PI * engagementHalfTurns
      + machineRunTime * runningSpeed
    ) * direction;
    members.forEach(({ node, phase, angularRatio }) => {
      node.rotation.z = phase + driverTravel * angularRatio;
    });
  });
  if (resultSparkDriverGear && resultSparkDrivenGear) {
    const pumpAngle = machineRunTime * 1.1;
    resultSparkDriverGear.rotation.z = pumpAngle;
    resultSparkDrivenGear.rotation.z = Math.PI / 10 - pumpAngle * 14 / 10;
  }
  updateSparks(progress);
}

function updateSparks(progress) {
  if (!sparkPoints || !sparkMaterial) return;
  const terminalPresence = smoothstep(.76, .86, progress);
  const resultSourceIsReady = resultModeBlend >= .965
    && Boolean(resultSparkDriverGear && resultSparkDrivenGear);
  const sourceIsChanging = resultModeBlend > .82 && resultModeBlend < .965;
  const driver = resultSourceIsReady ? resultSparkDriverGear : sparkDriverGear;
  const driven = resultSourceIsReady ? resultSparkDrivenGear : sparkDrivenGear;
  const driverRadius = resultSourceIsReady ? .21 : .36;
  const drivenRadius = resultSourceIsReady ? .15 : .23;
  const driverTeeth = resultSourceIsReady ? 14 : 15;
  driver?.getWorldPosition(sparkDriverCenter);
  driven?.getWorldPosition(sparkDrivenCenter);
  sparkContactPoint.copy(sparkDriverCenter).lerp(
    sparkDrivenCenter,
    driverRadius / (driverRadius + drivenRadius)
  );
  sparkContactPoint.z += resultSourceIsReady ? .1 : .14;
  sparkPoints.position.copy(sparkContactPoint);
  if (sparkTrails) sparkTrails.position.copy(sparkContactPoint);
  if (sparkLight) {
    sparkLight.position.copy(sparkContactPoint);
    sparkLight.position.z += .16;
  }
  // A burst is phase-locked to every third tooth contact. This preserves the
  // intermittent mechanics while keeping the emitter at the real pitch-circle
  // tangent even when scrolling has stopped and the transmission keeps moving.
  const toothPitch = Math.PI * 2 / driverTeeth;
  const toothTravel = Math.abs(driver?.rotation.z || sparkRunTime * .75) / toothPitch;
  const contactCycle = (toothTravel % 3) / 3;
  const localTime = contactCycle * 1.25;
  const burst = windowedPhase(localTime, .01, .045, .26, .43)
    * terminalPresence
    * (sourceIsChanging ? 0 : 1);
  const opacity = burst * .88;
  sparkMaterial.uniforms.uOpacity.value = opacity;
  if (sparkTrailMaterial) sparkTrailMaterial.opacity = Math.min(.88, burst * .9);
  if (sparkLight) {
    sparkLight.intensity = burst * 6.4;
  }
  sparkPoints.visible = burst > .002;
  if (sparkTrails) sparkTrails.visible = sparkPoints.visible;
  if (viewport) {
    viewport.dataset.sparkOpacity = opacity.toFixed(3);
    viewport.dataset.sparkSource = resultSourceIsReady ? "result-pump" : "planner-gearbox";
  }
  if (!sparkPoints.visible) {
    if (viewport) viewport.dataset.sparkAlive = "0";
    return;
  }
  const positions = sparkPoints.geometry.attributes.position.array;
  const colors = sparkPoints.geometry.attributes.color.array;
  const lives = sparkPoints.geometry.attributes.aLife.array;
  const trailPositions = sparkTrails?.geometry.attributes.position.array;
  let aliveCount = 0;
  sparkSeeds.forEach((seed, index) => {
    const time = Math.max(0, localTime - seed.delay);
    const life = clamp(1 - time / seed.lifetime);
    const distance = seed.speed * (1 - Math.exp(-seed.drag * time)) / seed.drag;
    const hidden = time <= 0 || life <= 0;
    if (!hidden) aliveCount += 1;
    positions[index * 3] = hidden ? 0 : Math.cos(seed.angle) * distance;
    positions[index * 3 + 1] = hidden ? 0 : Math.sin(seed.angle) * distance - time * time * 1.18;
    positions[index * 3 + 2] = hidden ? -20 : seed.depth * distance;
    if (trailPositions) {
      const trailOffset = index * 6;
      const tailLength = hidden ? 0 : Math.min(.36, .065 + distance * .6);
      trailPositions[trailOffset] = positions[index * 3];
      trailPositions[trailOffset + 1] = positions[index * 3 + 1];
      trailPositions[trailOffset + 2] = positions[index * 3 + 2];
      trailPositions[trailOffset + 3] = hidden
        ? 0
        : positions[index * 3] - Math.cos(seed.angle) * tailLength;
      trailPositions[trailOffset + 4] = hidden
        ? 0
        : positions[index * 3 + 1] - Math.sin(seed.angle) * tailLength + time * .035;
      trailPositions[trailOffset + 5] = hidden ? -20 : positions[index * 3 + 2] - seed.depth * tailLength * .3;
    }
    sparkColorScratch.copy(sparkCoolColor).lerp(sparkHotColor, life * life);
    colors[index * 3] = sparkColorScratch.r;
    colors[index * 3 + 1] = sparkColorScratch.g;
    colors[index * 3 + 2] = sparkColorScratch.b;
    lives[index] = hidden ? 0 : life;
  });
  sparkPoints.geometry.attributes.position.needsUpdate = true;
  sparkPoints.geometry.attributes.color.needsUpdate = true;
  sparkPoints.geometry.attributes.aLife.needsUpdate = true;
  if (sparkTrails) sparkTrails.geometry.attributes.position.needsUpdate = true;
  if (viewport) viewport.dataset.sparkAlive = String(aliveCount);
}

function mapCameraProgress(progress) {
  const input = clamp(progress);
  let stationIndex = CAMERA_PROGRESS_STATIONS.length - 2;
  for (let index = 0; index < CAMERA_PROGRESS_STATIONS.length - 1; index += 1) {
    if (input <= CAMERA_PROGRESS_STATIONS[index + 1].input) {
      stationIndex = index;
      break;
    }
  }
  const start = CAMERA_PROGRESS_STATIONS[stationIndex];
  const end = CAMERA_PROGRESS_STATIONS[stationIndex + 1];
  const span = end.input - start.input;
  const t = clamp((input - start.input) / span);
  const t2 = t * t;
  const t3 = t2 * t;
  const startBasis = 2 * t3 - 3 * t2 + 1;
  const startTangentBasis = t3 - 2 * t2 + t;
  const endBasis = -2 * t3 + 3 * t2;
  const endTangentBasis = t3 - t2;
  return clamp(
    startBasis * start.path
    + startTangentBasis * span * CAMERA_PROGRESS_TANGENTS[stationIndex]
    + endBasis * end.path
    + endTangentBasis * span * CAMERA_PROGRESS_TANGENTS[stationIndex + 1]
  );
}

function updateCamera(progress) {
  const pathProgress = mapCameraProgress(progress);
  if (viewport) viewport.dataset.cameraPathProgress = pathProgress.toFixed(4);
  cameraPath.getPointAt(pathProgress, camera.position);
  const exteriorFrameHold = 1 - smoothstep(
    EXTERIOR_PRESENTATION.releaseStart,
    EXTERIOR_PRESENTATION.releaseEnd,
    progress
  );
  camera.position.y += EXTERIOR_PRESENTATION.verticalCameraOffset * exteriorFrameHold;
  cameraPath.getTangentAt(Math.min(.999, pathProgress), cameraForward).normalize();
  lookTarget.copy(camera.position).addScaledVector(cameraForward, 4.8);
  // The lens must stay coaxial with the selected 48 mm aperture until it has
  // crossed the far plenum collar. Even a small inherited downward tangent at
  // this scale makes the camera graze the funnel exterior and reads as a hard
  // cut to a radial disc instead of a physical passage through the hole.
  lookTarget.y += Math.sin(pathProgress * Math.PI) * .08 * smoothstep(.6, .75, progress);
  camera.up.set(0, 1, 0);
  camera.lookAt(lookTarget);
  if (cameraInspectionLight) {
    cameraInspectionLight.position.copy(camera.position);
    cameraInspectionLight.target.position.copy(lookTarget);
  }
  const exteriorAspectCompensation = clamp(1.4 / Math.max(.5, camera.aspect), .72, 1.78);
  const exteriorBaseFov = THREE.MathUtils.lerp(
    43,
    EXTERIOR_PRESENTATION.baseFov,
    exteriorFrameHold
  );
  const exteriorFov = THREE.MathUtils.radToDeg(
    2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(exteriorBaseFov) * .5) * exteriorAspectCompensation)
  );
  const portraitFraming = 1 - smoothstep(.68, 1.46, camera.aspect);
  // The endpoint keeps the three carrier apertures and their load-bearing frame
  // in view while making the live controls readable at a 720 px-tall desktop.
  // Portrait framing remains wider because the stacked carriers need the extra
  // vertical clearance there.
  const terminalFov = THREE.MathUtils.lerp(65, 82, portraitFraming);
  camera.fov = THREE.MathUtils.lerp(exteriorFov, terminalFov, smoothstep(.08, .82, progress));
  // Exterior photography lighting must not follow the camera into the duct.
  // Fading the broad frontal sources leaves the perforation walls dark and
  // lets the smaller service light reveal depth without bleaching the bore.
  const entranceLightFade = smoothstep(.28, .43, progress);
  if (frontKey) frontKey.intensity = THREE.MathUtils.lerp(235, 0, entranceLightFade);
  if (frontFill) frontFill.intensity = THREE.MathUtils.lerp(118, 0, entranceLightFade);
  if (frontEdge) frontEdge.intensity = THREE.MathUtils.lerp(1.25, 0, entranceLightFade);
  if (exteriorLeftRim) exteriorLeftRim.intensity = THREE.MathUtils.lerp(55, 0, entranceLightFade);
  if (exteriorRightRim) exteriorRightRim.intensity = THREE.MathUtils.lerp(38, 0, entranceLightFade);
  whiteDiagnostic.emissiveIntensity = THREE.MathUtils.lerp(.002, .42, smoothstep(.55, .7, progress));
  if (thresholdLight) {
    // The exterior spot is gone before the lens reaches the selected hole;
    // otherwise its circular cone paints a false low-poly "disc" on the flat
    // grille. The coaxial duct points below take over the lip and liner.
    thresholdLight.intensity = THREE.MathUtils.lerp(15, 0, smoothstep(.28, .41, progress));
  }
  if (ductFillLight) {
    ductFillLight.intensity = 2.8 * windowedPhase(progress, .25, .32, .58, .68);
  }
  if (ductWallLight) ductWallLight.intensity = .88 * windowedPhase(progress, .31, .37, .57, .68);
  if (ductExitLight) ductExitLight.intensity = .95 * windowedPhase(progress, .39, .46, .64, .73);
  if (cameraInspectionLight) {
    cameraInspectionLight.intensity = .6 * windowedPhase(progress, .34, .38, .52, .62);
  }
  if (ambientLight) {
    // Hold the bore at one exposure level through the entire throat/plenum
    // crossing. Ambient returns only after the camera is clear of the collar.
    const throatOcclusion = smoothstep(.34, .45, progress);
    const terminalAmbientReturn = smoothstep(.65, .84, progress);
    const throatAmbient = THREE.MathUtils.lerp(.62, .21, throatOcclusion);
    ambientLight.intensity = THREE.MathUtils.lerp(throatAmbient, .48, terminalAmbientReturn);
  }
  // A slow crossfade between low off-axis grazers replaces the previous pair
  // of centered points, which lifted every radial face at once near 60%.
  const plenumReveal = windowedPhase(progress, .47, .62, .72, .84);
  if (plenumLight) plenumLight.intensity = 7.5 * plenumReveal;
  if (plenumRimLight) plenumRimLight.intensity = 3.4 * plenumReveal;
  if (plenumEntryLight) {
    plenumEntryLight.intensity = 24 * windowedPhase(progress, .43, .48, .57, .67);
  }
  if (plenumContinuationLight) {
    plenumContinuationLight.intensity = 5.2 * windowedPhase(progress, .46, .51, .59, .69);
  }
  routePhaseLights.forEach(({ light, peak, window }) => {
    light.intensity = peak * windowedPhase(progress, ...window);
  });
  const terminalReveal = smoothstep(.69, .84, progress);
  if (terminalKeyLight) terminalKeyLight.intensity = 82 * terminalReveal;
  if (terminalFillLight) terminalFillLight.intensity = 68 * terminalReveal;
  if (terminalRimLight) terminalRimLight.intensity = 20 * terminalReveal;
  if (terminalLowerFillLight) terminalLowerFillLight.intensity = 72 * terminalReveal;
  if (terminalLeftServiceLight) terminalLeftServiceLight.intensity = 60 * terminalReveal;
  if (terminalLeftSoftbox) terminalLeftSoftbox.intensity = 38 * terminalReveal;
  if (terminalRightSoftbox) terminalRightSoftbox.intensity = 34 * terminalReveal;
  if (terminalTopSoftbox) terminalTopSoftbox.intensity = 20 * terminalReveal;
  // The three broad workshop softboxes are the terminal reflection rig. The
  // portal spots remain constructed as compatibility fixtures but stay dark;
  // running both rigs doubled every black-metal lighting evaluation and made
  // the browser unresponsive without adding a physically distinct source.
  if (terminalLeftPortalLight) terminalLeftPortalLight.intensity = 0;
  if (terminalRightPortalLight) terminalRightPortalLight.intensity = 0;
  if (terminalTopPortalLight) terminalTopPortalLight.intensity = 0;
  if (terminalBottomPortalLight) terminalBottomPortalLight.intensity = 0;
  if (terminalFrontWash) terminalFrontWash.intensity = 1 * terminalReveal;
  // Keep the complete neutral workshop rig resident in Three's active-light
  // set. Intensity reaches zero outside a source's physical phase, but light
  // visibility never changes during the journey; shader programs therefore
  // stay stable while the camera crosses the grille and enters the terminal.
  // Only shadow-map ownership remains phase-aware to avoid redundant geometry
  // passes from zero-energy keys.
  if (frontKey) frontKey.castShadow = frontKey.intensity > .001;
  if (thresholdLight) thresholdLight.castShadow = false;
  if (terminalKeyLight) terminalKeyLight.castShadow = terminalKeyLight.intensity > .001;
  // Keep the short throat optically clean; depth haze belongs to the terminal
  // bay and arrives only once the camera is well beyond the plenum collar.
  scene.fog.density = THREE.MathUtils.lerp(.0036, .0052, smoothstep(.66, .86, progress));
  // The reference render carries readable midtone steel while preserving a
  // near-black floor. Raise only the terminal exposure, after the bore has
  // cleared, so bevels and fasteners emerge without bleaching the exterior or
  // the warm tooth-contact spark.
  renderer.toneMappingExposure = THREE.MathUtils.lerp(.97, 1.26, smoothstep(.74, .9, progress));
  camera.updateProjectionMatrix();
}

function dispatchProjectedAnchors() {
  if (!canvas || !camera) return;
  camera.getWorldDirection(cameraForward);
  const result = {};
  anchors.forEach((frame, name) => {
    frame.center.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    const inFront = entranceDelta.copy(worldPosition).sub(camera.position).dot(cameraForward) > 0;
    projectedPosition.copy(worldPosition).project(camera);
    const output = frame.output;
    output.x = (projectedPosition.x * .5 + .5) * viewportWidth;
    output.y = (-projectedPosition.y * .5 + .5) * viewportHeight;
    output.scale = clamp(7.8 / Math.max(7.8, distance), .68, 1);

    let allCornersInFront = true;
    let allCornersFinite = true;
    let minimumX = Infinity;
    let maximumX = -Infinity;
    let minimumY = Infinity;
    let maximumY = -Infinity;
    frame.corners.forEach((corner, index) => {
      const worldCorner = frame.worldCorners[index];
      const projectedCorner = frame.projectedCorners[index];
      const screenCorner = frame.screenQuad[index];
      corner.getWorldPosition(worldCorner);
      const forwardDepth = entranceDelta.copy(worldCorner).sub(camera.position).dot(cameraForward);
      allCornersInFront = allCornersInFront && forwardDepth > Math.max(.08, camera.near * 3);
      projectedCorner.copy(worldCorner).project(camera);
      screenCorner.x = (projectedCorner.x * .5 + .5) * viewportWidth;
      screenCorner.y = (-projectedCorner.y * .5 + .5) * viewportHeight;
      allCornersFinite = allCornersFinite
        && Number.isFinite(screenCorner.x)
        && Number.isFinite(screenCorner.y)
        && projectedCorner.z > -1
        && projectedCorner.z < 1;
      minimumX = Math.min(minimumX, screenCorner.x);
      maximumX = Math.max(maximumX, screenCorner.x);
      minimumY = Math.min(minimumY, screenCorner.y);
      maximumY = Math.max(maximumY, screenCorner.y);
    });

    surfaceEdgeA.copy(frame.worldCorners[3]).sub(frame.worldCorners[0]);
    surfaceEdgeB.copy(frame.worldCorners[1]).sub(frame.worldCorners[0]);
    surfaceNormal.copy(surfaceEdgeA).cross(surfaceEdgeB).normalize();
    surfaceToCamera.copy(camera.position).sub(worldPosition).normalize();
    output.facing = surfaceNormal.dot(surfaceToCamera);

    let signedArea = 0;
    frame.screenQuad.forEach((corner, index) => {
      const next = frame.screenQuad[(index + 1) % frame.screenQuad.length];
      signedArea += corner.x * next.y - next.x * corner.y;
    });
    const projectedWidth = maximumX - minimumX;
    const projectedHeight = maximumY - minimumY;
    const projectionLimit = Math.hypot(viewportWidth, viewportHeight) * 2.75;
    const bounded = projectedWidth > 4
      && projectedHeight > 4
      && projectedWidth < projectionLimit
      && projectedHeight < projectionLimit;
    const intersectsViewport = maximumX > -8
      && minimumX < viewportWidth + 8
      && maximumY > -8
      && minimumY < viewportHeight + 8;
    const modeAllowsSurface = name === "result"
      ? resultModeTarget === 1 && resultModeBlend >= .965
      : resultModeTarget === 0 && resultModeBlend <= .42;
    output.visible = inFront
      && allCornersInFront
      && allCornersFinite
      && bounded
      && intersectsViewport
      && Math.abs(signedArea) > 64
      && output.facing > .18
      && modeAllowsSurface;
    output.quad = output.visible ? frame.screenQuad : null;
    result[name] = output;
  });
  window.dispatchEvent(new CustomEvent("concourse:timetable-machine-anchors", { detail: result }));

  const forwardDistance = entranceDelta.copy(entranceCenter).sub(camera.position).dot(cameraForward);
  const entranceInFront = forwardDistance > Math.max(.12, camera.near * 6);
  projectedPosition.copy(entranceCenter).project(camera);
  const entranceCenterDepth = projectedPosition.z;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  entranceCorners.forEach((corner, index) => {
    const projected = entranceProjectedCorners[index].copy(corner).project(camera);
    projected.x = (projected.x * .5 + .5) * viewportWidth;
    projected.y = (-projected.y * .5 + .5) * viewportHeight;
    left = Math.min(left, projected.x);
    right = Math.max(right, projected.x);
    top = Math.min(top, projected.y);
    bottom = Math.max(bottom, projected.y);
  });
  const projectedWidth = right - left;
  const projectedHeight = bottom - top;
  const projectionLimit = Math.hypot(viewportWidth, viewportHeight) * 2.75;
  const projectionIsBounded = [left, right, top, bottom, projectedWidth, projectedHeight]
    .every(Number.isFinite)
    && projectedWidth > 1
    && projectedHeight > 1
    && projectedWidth < projectionLimit
    && projectedHeight < projectionLimit;
  const topEdge = {
    x: entranceProjectedCorners[1].x - entranceProjectedCorners[0].x,
    y: entranceProjectedCorners[1].y - entranceProjectedCorners[0].y
  };
  window.dispatchEvent(new CustomEvent("concourse:timetable-machine-entrance-projection", {
    detail: {
      x: (left + right) * .5,
      y: (top + bottom) * .5,
      width: projectedWidth,
      height: projectedHeight,
      rotation: Math.atan2(topEdge.y, topEdge.x),
      visible: entranceInFront
        && projectionIsBounded
        && entranceCenterDepth > -1
        && entranceCenterDepth < 1
    }
  }));
}

function shouldRunContinuousMotion() {
  if (auditFrameEnabled) return false;
  return currentProgress >= .64 || Math.abs(resultModeTarget - resultModeBlend) > .0001;
}

function updateResultMode(frameDelta) {
  if (auditFrameEnabled) {
    const nextBlend = resultModeTarget === 1
      ? (auditResultBlend ?? 1)
      : 0;
    if (Math.abs(resultModeBlend - nextBlend) > .0001) {
      resultModeBlend = nextBlend;
      projectionDirty = true;
    }
    return;
  }
  const difference = resultModeTarget - resultModeBlend;
  if (Math.abs(difference) <= .0001) {
    if (resultModeBlend !== resultModeTarget) {
      resultModeBlend = resultModeTarget;
      projectionDirty = true;
    }
    return;
  }
  // One scalar drives a mechanically staged 1.35 s changeover. Individual
  // mechanisms apply their own non-overlapping windows in updateMechanisms(),
  // so reversing midway remains continuous and cannot teleport a carrier.
  const direction = Math.sign(difference);
  resultModeBlend = clamp(resultModeBlend + direction * frameDelta / 1.35);
  projectionDirty = true;
  if ((direction > 0 && resultModeBlend > resultModeTarget)
    || (direction < 0 && resultModeBlend < resultModeTarget)) {
    resultModeBlend = resultModeTarget;
  }
}

function readAuditHashState() {
  if (!auditFrameEnabled) return false;
  const hashParameters = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  let changed = false;
  if (hashParameters.has("timetableAuditTime")) {
    const nextTime = Number(hashParameters.get("timetableAuditTime"));
    if (Number.isFinite(nextTime)) {
      const clampedTime = Math.max(0, nextTime);
      changed = changed || Math.abs(clampedTime - auditFrameTime) > 1e-7;
      auditFrameTime = clampedTime;
    }
  }
  if (hashParameters.has("timetableAuditResultBlend")) {
    const nextBlend = Number(hashParameters.get("timetableAuditResultBlend"));
    if (Number.isFinite(nextBlend)) {
      const clampedBlend = clamp(nextBlend);
      changed = changed
        || auditResultBlend === null
        || Math.abs(clampedBlend - auditResultBlend) > 1e-7;
      auditResultBlend = clampedBlend;
    }
  }
  return changed;
}

function handleAuditHashChange() {
  if (!auditFrameEnabled) return;
  readAuditHashState();
  machineRunTime = auditFrameTime;
  sparkRunTime = auditFrameTime;
  lastAnimationTimestamp = 0;
  projectionDirty = true;
  if (viewport) {
    viewport.dataset.auditFrameReady = "0";
    viewport.dataset.auditFrameTime = auditFrameTime.toFixed(3);
    viewport.dataset.auditResultBlend = auditResultBlend === null
      ? "auto"
      : auditResultBlend.toFixed(4);
  }
  requestRender();
}

function cancelProgramWarmup(reset = false) {
  programWarmupGeneration += 1;
  if (programWarmupRequest) {
    if (programWarmupRequestType === "idle" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(programWarmupRequest);
    } else {
      window.clearTimeout(programWarmupRequest);
    }
  }
  programWarmupRequest = 0;
  programWarmupRequestType = "";
  if (reset) programWarmupComplete = false;
}

function scheduleProgramWarmup() {
  if (programWarmupComplete || programWarmupRequest || !renderer || !scene || !camera
    || isDisposed || isContextLost) return;

  // The fully resident zero-intensity light rig gives every spatial phase one
  // stable shader signature. Compile it once after construction, but enter the
  // compiler only from an idle task so controls and the first semantic paint
  // are never held behind synchronous WebGL program linking.
  programWarmupComplete = true;
  const generation = ++programWarmupGeneration;
  const compilePrograms = () => {
    programWarmupRequest = 0;
    programWarmupRequestType = "";
    if (generation !== programWarmupGeneration || !renderer || !scene || !camera
      || isDisposed || isContextLost) return;
    if (viewport) viewport.dataset.rendererPrograms = "warming";

    const markReady = () => {
      if (generation !== programWarmupGeneration || isDisposed || isContextLost) return;
      if (viewport) viewport.dataset.rendererPrograms = "ready";
    };
    const markDeferred = () => {
      if (generation !== programWarmupGeneration || isDisposed || isContextLost) return;
      // Rendering remains fully functional if a driver rejects parallel
      // compilation; Three will lazily link the same programs on first use.
      if (viewport) viewport.dataset.rendererPrograms = "lazy-fallback";
    };

    try {
      if (typeof renderer.compileAsync === "function") {
        Promise.resolve(renderer.compileAsync(scene, camera)).then(markReady, markDeferred);
      } else {
        renderer.compile(scene, camera);
        markReady();
      }
    } catch (error) {
      markDeferred();
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    programWarmupRequestType = "idle";
    programWarmupRequest = window.requestIdleCallback(compilePrograms, { timeout: 1200 });
  } else {
    programWarmupRequestType = "timer";
    programWarmupRequest = window.setTimeout(compilePrograms, 32);
  }
  if (viewport) viewport.dataset.rendererPrograms = "queued";
}

function renderNow() {
  renderFrame = 0;
  if (!renderer || !scene || !camera || isDisposed || isContextLost || !isActive || document.hidden) {
    lastAnimationTimestamp = 0;
    return;
  }
  const continuousMotion = shouldRunContinuousMotion();
  const frameTimestamp = performance.now();
  const frameElapsed = lastAnimationTimestamp > 0
    ? frameTimestamp - lastAnimationTimestamp
    : Number.POSITIVE_INFINITY;
  const stableResultMode = resultModeTarget === 1
    && Math.abs(resultModeTarget - resultModeBlend) <= .0001
    && currentProgress >= .64;
  const stablePlannerTerminal = resultModeTarget === 0
    && Math.abs(resultModeTarget - resultModeBlend) <= .0001
    && currentProgress >= .64;
  const settledFrameRate = stableResultMode ? 24 : (stablePlannerTerminal ? 30 : 0);
  // Camera travel, scroll input and the mechanical mode changeover are always
  // rendered on the next animation frame. Only a settled terminal is sampled:
  // planner at ~30 fps and the denser projected result at cinematic 24 fps.
  // Elapsed wall time still drives every gear and phase-locked spark, so their
  // physical speed never slows with the GPU cadence.
  if (!settledFrameRate) {
    settledRenderDeadline = 0;
    settledRenderRate = 0;
  } else if (settledRenderRate !== settledFrameRate || settledRenderDeadline <= 0) {
    settledRenderRate = settledFrameRate;
    settledRenderDeadline = frameTimestamp;
  }
  if (settledFrameRate && !projectionDirty && frameTimestamp + .5 < settledRenderDeadline) {
    scheduleContinuousFrame(settledFrameRate);
    return;
  }
  const frameDelta = continuousMotion && lastAnimationTimestamp > 0
    ? clamp(frameElapsed / 1000, 0, .05)
    : 0;
  lastAnimationTimestamp = continuousMotion ? frameTimestamp : 0;
  machineRunTime += frameDelta;
  if (auditFrameEnabled) {
    // Every audit hash is an independent deterministic mechanical instant.
    // Do not let an earlier exterior frame erase the requested terminal spark
    // phase before the same loaded scene advances to its result evidence.
    sparkRunTime = auditFrameTime;
    machineRunTime = auditFrameTime;
  } else if (currentProgress >= .76) sparkRunTime += frameDelta;
  else if (currentProgress < .7) sparkRunTime = 0;
  updateResultMode(frameDelta);
  updateCamera(currentProgress);
  updateMechanisms(currentProgress);
  updateForegroundComposite(currentProgress);
  renderer.render(scene, camera);
  if (viewport) {
    viewport.dataset.rendererDrawCalls = String(renderer.info.render.calls);
    viewport.dataset.rendererTriangles = String(renderer.info.render.triangles);
    viewport.dataset.rendererLines = String(renderer.info.render.lines);
    viewport.dataset.rendererPoints = String(renderer.info.render.points);
  }
  if (projectionDirty) {
    dispatchProjectedAnchors();
    projectionDirty = false;
  }
  syncForegroundCarrierOverlays();
  if (auditFrameEnabled && viewport) {
    viewport.dataset.auditFrameReady = "1";
    viewport.dataset.auditFrameTime = auditFrameTime.toFixed(3);
  }
  if (settledFrameRate) {
    const settledInterval = 1000 / settledFrameRate;
    do {
      settledRenderDeadline += settledInterval;
    } while (settledRenderDeadline <= frameTimestamp);
  }
  if (continuousMotion) scheduleContinuousFrame(settledFrameRate);
}

function scheduleContinuousFrame(settledFrameRate = 0) {
  if (renderFrame || renderDelayTimer || !isActive || isDisposed || isContextLost || document.hidden) return;
  // A tiny idle window keeps controls, focus and capture responsive even when
  // the settled terminal contains thousands of lit precision parts. The
  // elapsed-time gate in renderNow owns the exact 30/24 fps ceilings.
  if (settledFrameRate > 0) {
    renderDelayTimer = window.setTimeout(() => {
      renderDelayTimer = 0;
      if (!isActive || isDisposed || isContextLost || document.hidden) return;
      renderFrame = window.requestAnimationFrame(renderNow);
    }, 6);
    return;
  }
  renderFrame = window.requestAnimationFrame(renderNow);
}

function requestRender() {
  if (renderFrame || !isActive || isDisposed || isContextLost || document.hidden) return;
  if (renderDelayTimer) {
    window.clearTimeout(renderDelayTimer);
    renderDelayTimer = 0;
  }
  renderFrame = window.requestAnimationFrame(renderNow);
}

function resize() {
  if (!renderer || !camera || !canvas || isDisposed) return;
  const bounds = canvas.getBoundingClientRect();
  viewportWidth = Math.max(1, bounds.width || window.innerWidth);
  viewportHeight = Math.max(1, bounds.height || window.innerHeight);
  const devicePixelRatio = window.devicePixelRatio || 1;
  // Preserve fine machined edges on Retina displays while still bounding the
  // fill-rate cost of the competition-grade scene.
  const pixelBudget = 3200000;
  const budgetPixelRatio = Math.sqrt(pixelBudget / (viewportWidth * viewportHeight));
  const pixelRatio = Math.min(devicePixelRatio, 1.55, budgetPixelRatio);
  renderer.setPixelRatio(pixelRatio);
  if (foregroundRenderer && !isForegroundContextLost) {
    foregroundRenderer.setPixelRatio(pixelRatio);
    foregroundRenderer.setSize(viewportWidth, viewportHeight, false);
  }
  if (sparkMaterial?.uniforms?.uPixelRatio) sparkMaterial.uniforms.uPixelRatio.value = pixelRatio;
  renderer.setSize(viewportWidth, viewportHeight, false);
  if (viewport) {
    viewport.dataset.rendererDpr = pixelRatio.toFixed(2);
    viewport.dataset.rendererPixels = String(Math.round(viewportWidth * viewportHeight * pixelRatio * pixelRatio));
    viewport.dataset.rendererPixelBudget = String(pixelBudget);
    viewport.dataset.rendererStableFps = "30";
    viewport.dataset.rendererResultStableFps = "24";
  }
  camera.aspect = viewportWidth / viewportHeight;
  camera.updateProjectionMatrix();
  projectionDirty = true;
  requestRender();
}

function setProgress(progress) {
  currentProgress = clamp(Number(progress) || 0);
  if (Math.abs(currentProgress - lastRequestedProgress) <= 1e-7) return;
  lastRequestedProgress = currentProgress;
  if (viewport) {
    viewport.dataset.machineProgress = currentProgress.toFixed(4);
    if (auditFrameEnabled) viewport.dataset.auditFrameReady = "0";
  }
  projectionDirty = true;
  requestRender();
}

function setMode(mode) {
  const normalizedMode = mode === "result" ? "result" : "planner";
  mountForegroundCanvas(normalizedMode);
  const previousModeTarget = resultModeTarget;
  resultModeTarget = normalizedMode === "result" ? 1 : 0;
  const modeChanged = resultModeTarget !== previousModeTarget;
  const needsTerminalCamera = resultModeTarget === 1 && currentProgress < 1;
  if (!modeChanged && !needsTerminalCamera) return;
  // A saved result can be opened without replaying the scroll journey. In that
  // case move the established camera to its unchanged terminal endpoint; the
  // lift itself still performs the full staged mechanical changeover.
  if (resultModeTarget === 1 && currentProgress < 1) {
    currentProgress = 1;
    if (viewport) viewport.dataset.machineProgress = "1.0000";
  }
  if (viewport) {
    viewport.dataset.machineMode = normalizedMode;
    if (auditFrameEnabled) viewport.dataset.auditFrameReady = "0";
  }
  projectionDirty = true;
  requestRender();
}

function setActive(active) {
  const nextActive = Boolean(active);
  if (nextActive === isActive) return;
  isActive = nextActive;
  foregroundCanvas?.classList.toggle(
    "is-active",
    isActive && Boolean(foregroundRenderer) && !isForegroundContextLost
  );
  if (isActive) projectionDirty = true;
  if (isActive) requestRender();
  else {
    lastAnimationTimestamp = 0;
    settledRenderDeadline = 0;
    settledRenderRate = 0;
    if (renderDelayTimer) {
      window.clearTimeout(renderDelayTimer);
      renderDelayTimer = 0;
    }
    if (renderFrame) {
      window.cancelAnimationFrame(renderFrame);
      renderFrame = 0;
    }
  }
}

function dispose() {
  if (isDisposed) return;
  isDisposed = true;
  cancelProgramWarmup();
  if (renderFrame) window.cancelAnimationFrame(renderFrame);
  renderFrame = 0;
  if (renderDelayTimer) window.clearTimeout(renderDelayTimer);
  renderDelayTimer = 0;
  lastAnimationTimestamp = 0;
  settledRenderDeadline = 0;
  settledRenderRate = 0;
  window.removeEventListener("resize", resize);
  window.removeEventListener("hashchange", handleAuditHashChange);
  document.removeEventListener("visibilitychange", handleVisibility);
  canvas?.removeEventListener("webglcontextlost", handleContextLost);
  canvas?.removeEventListener("webglcontextrestored", handleContextRestored);
  foregroundCanvas?.removeEventListener("webglcontextlost", handleForegroundContextLost);
  foregroundCanvas?.removeEventListener("webglcontextrestored", handleForegroundContextRestored);
  renderer?.dispose();
  foregroundRenderer?.dispose();
  studioEnvironment?.dispose();
  studioEnvironment = null;
  geometryCache.forEach(geometry => geometry.dispose());
  disposableMaterials.forEach(surface => surface.dispose());
  viewport?.classList.remove("is-webgl");
  foregroundCanvas?.classList.remove("is-active");
}

function handleVisibility() {
  if (document.hidden) {
    if (renderFrame) window.cancelAnimationFrame(renderFrame);
    renderFrame = 0;
    if (renderDelayTimer) window.clearTimeout(renderDelayTimer);
    renderDelayTimer = 0;
    lastAnimationTimestamp = 0;
    settledRenderDeadline = 0;
    settledRenderRate = 0;
    return;
  }
  requestRender();
}

function handleContextLost(event) {
  event.preventDefault();
  isContextLost = true;
  cancelProgramWarmup(true);
  if (renderFrame) window.cancelAnimationFrame(renderFrame);
  renderFrame = 0;
  if (renderDelayTimer) window.clearTimeout(renderDelayTimer);
  renderDelayTimer = 0;
  lastAnimationTimestamp = 0;
  settledRenderDeadline = 0;
  settledRenderRate = 0;
  viewport?.classList.remove("is-webgl");
  foregroundCanvas?.classList.remove("is-active");
  document.documentElement.classList.add("timetable-webgl-context-lost");
  window.dispatchEvent(new CustomEvent("concourse:timetable-machine-failed", {
    detail: { reason: "context-lost" }
  }));
}

function handleContextRestored() {
  if (isDisposed) return;
  isContextLost = false;
  lastAnimationTimestamp = 0;
  document.documentElement.classList.remove("timetable-webgl-context-lost");
  viewport?.classList.add("is-webgl");
  foregroundCanvas?.classList.toggle("is-active", isActive && !isForegroundContextLost);
  resize();
  scheduleProgramWarmup();
  requestRender();
}

function handleForegroundContextLost(event) {
  event.preventDefault();
  isForegroundContextLost = true;
  foregroundCanvas?.classList.remove("is-active");
  if (foregroundCanvas) foregroundCanvas.dataset.rendererState = "context-lost";
}

function handleForegroundContextRestored() {
  if (isDisposed) return;
  isForegroundContextLost = false;
  if (foregroundCanvas) foregroundCanvas.dataset.rendererState = "ready";
  foregroundCanvas?.classList.toggle("is-active", isActive && !isContextLost);
  resize();
  requestRender();
}

function initialize() {
  if (!canvas || !viewport) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compactViewport = window.matchMedia("(max-width: 760px)").matches;
  const saveData = Boolean(navigator.connection?.saveData);
  if (reducedMotion || compactViewport || saveData) return;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false
    });
  } catch (error) {
    document.documentElement.classList.add("timetable-webgl-failed");
    window.dispatchEvent(new CustomEvent("concourse:timetable-machine-failed", {
      detail: { reason: "initialization-failed" }
    }));
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .97;
  renderer.shadowMap.enabled = true;
  // Current Three releases fold the soft PCF path into PCFShadowMap; selecting
  // the deprecated enum produces a console warning without changing output.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  viewport.dataset.rendererShadows = "pcf";
  if (auditFrameEnabled) {
    readAuditHashState();
    machineRunTime = auditFrameTime;
    sparkRunTime = auditFrameTime;
    viewport.dataset.auditFrame = "deterministic";
    viewport.dataset.auditFrameReady = "0";
    viewport.dataset.auditFrameTime = auditFrameTime.toFixed(3);
    viewport.dataset.auditResultBlend = auditResultBlend === null
      ? "auto"
      : auditResultBlend.toFixed(4);
    window.addEventListener("hashchange", handleAuditHashChange);
  }
  renderer.setClearColor(0x030302, 1);
  initializeForegroundRenderer();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030302);
  scene.fog = new THREE.FogExp2(0x030302, .0036);
  createProceduralStudioEnvironment();
  createForegroundCompositeScene();
  camera = new THREE.PerspectiveCamera(43, 1, .018, 90);
  cameraPath = new THREE.CatmullRomCurve3([
    // The fully modeled FAN-T111 sits inside the 16 × 10.67 presentation
    // frame. The camera then descends to a real center vent and crosses its
    // physical front and rear faces without substituting a raster surface.
    new THREE.Vector3(0, 2.693, 25.25),
    new THREE.Vector3(0, 2.693, 21.7),
    new THREE.Vector3(0, 2.05, 18),
    new THREE.Vector3(0, .78, 14.4),
    // Finish the vertical descent before the front lip. The following five
    // stations share one optical axis, yielding a continuous bevel → throat →
    // liner → plenum traversal rather than a late diagonal wall strike.
    new THREE.Vector3(0, 0, 12.65),
    new THREE.Vector3(0, 0, 12.15),
    new THREE.Vector3(0, 0, 11.7),
    new THREE.Vector3(0, 0, 10.8),
    new THREE.Vector3(0, 0, 8.05),
    new THREE.Vector3(0, 0, 4.2),
    new THREE.Vector3(0, .04, -2.4),
    new THREE.Vector3(-.18, .1, -5.9),
    new THREE.Vector3(.22, .22, -10.7),
    new THREE.Vector3(.16, .05, -14.7),
    new THREE.Vector3(0, 0, -16.6),
    // Stop in the unobstructed center aisle, ahead of the -21.4 portal rib.
    // This closer inspection station enlarges every projected carrier without
    // changing its physical aperture, hinge sweep, or reversible deployment.
    new THREE.Vector3(0, 0, -18.65)
  ], false, "centripetal", .48);

  createLights();
  createMechanicalInterior();
  createGeometricBackplane();
  setMode(document.body.classList.contains("schedule-active") ? "result" : "planner");
  resize();
  viewport.classList.add("is-webgl");
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);
  canvas.addEventListener("webglcontextlost", handleContextLost, false);
  canvas.addEventListener("webglcontextrestored", handleContextRestored, false);
  foregroundCanvas?.addEventListener("webglcontextlost", handleForegroundContextLost, false);
  foregroundCanvas?.addEventListener("webglcontextrestored", handleForegroundContextRestored, false);
  scheduleProgramWarmup();
  window.dispatchEvent(new CustomEvent("concourse:timetable-machine-ready"));
}

window.ConcourseTimetableMachine = Object.freeze({
  setProgress,
  setMode,
  setActive,
  resize,
  dispose,
  get supported() {
    return Boolean(renderer);
  }
});

initialize();
