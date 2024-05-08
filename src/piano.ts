import Stats from 'stats.js';
import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { KeyMap, codeToCharMap } from './keyboard';
import { PedalType } from './midi';

const pianoHeight = 8;
const keyDistance = 1;
const minIntensity = 0.05;
const keyFlowYOffset = 0;
const initialKeyFlowHeight = 0.1;
const keyBlack = {
    width: 0.4,
    height: pianoHeight * 0.8,
    thickness: 0.2,
    color: 0xaaaaaa,
    z: (0.5 + 0.2) / 2,
};

const keyWhite: typeof keyBlack = {
    width: 0.9,
    height: pianoHeight,
    thickness: 0.5,
    color: 0xffffff,
    z: 0,
};

const keyGeometryBlack = new THREE.BoxGeometry(
    keyBlack.width,
    keyBlack.height,
    keyBlack.thickness
);
const keyMaterialBlack = new THREE.MeshStandardMaterial({
    color: keyBlack.color,
});
const keyGeometryWhite = new THREE.BoxGeometry(
    keyWhite.width,
    keyWhite.height,
    keyWhite.thickness
);
const keyMaterialWhite = new THREE.MeshStandardMaterial({
    color: keyWhite.color,
});
const pedalGeometry = new THREE.BoxGeometry(0.7, 0.2, 3);
const pedalMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

type Key = {
    isBlack: boolean;
    width: number;
    x: number;
    mesh: THREE.Object3D;
    pressedTimestamp: number | null;
    light: THREE.PointLight;
    activeKeyFlow: KeyFlow | null;
};

type Lights = {
    ambientLight: THREE.AmbientLight;
};

type KeyFlow = {
    active: boolean;
    timestamp: number;
    mesh: THREE.Mesh;
};

type Pedal = {
    x: number;
    mesh: THREE.Object3D;
    light: THREE.PointLight;
};

type Config = {
    numKeys: number;
    lowestMidiNote: number;
    keyOffset: number;
};

export type RuntimeConfig = {
    showKeys: boolean;
    keyMap: KeyMap;
    particles: {
        spawnCount: number;
        phaseFactor: number;
        amplitude: number;
        omega: number;
        despawnMs: number;
    };
};

type PianoState = {
    config: Config;
    runtimeConfig: RuntimeConfig;
    animationRunning: boolean;

    //main three.js objects
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;

    //things that make up the scene
    lights: Lights;
    keys: Key[];
    keyFlows: KeyFlow[];
    keyboardMappingOverlay: THREE.Mesh<
        TextGeometry,
        THREE.MeshBasicMaterial,
        THREE.Object3DEventMap
    >[];
    pedals: {
        soft: Pedal;
        sostenuto: Pedal;
        sustain: Pedal;
    };
    particles: THREE.Points;

    //development helpers
    stats: Stats | null;
};

export type Piano = {
    keyPressed: (note: number, velocity: number) => void;
    keyReleased: (note: number) => void;
    pedalPressed: (pedal: PedalType, value: number) => void;
    animate: () => void;
    onWindowResize: () => void;
    configUpdated: () => void;
    runtimeConfig: RuntimeConfig;
};

export function createPiano(numKeys = 88): Piano {
    const config: Config = {
        numKeys: numKeys,
        lowestMidiNote: getLowestMidiNote(numKeys), // needed for translating MIDI note range of e.g. 21 - 108 for 88-key piano to 0 based index
        keyOffset: getKeyOffset(numKeys),
    };
    const runtimeConfig: RuntimeConfig = {
        showKeys: false,
        keyMap: {},
        particles: {
            spawnCount: 10,
            phaseFactor: 3400,
            amplitude: 0.2,
            omega: 0.882,
            despawnMs: 1000,
        },
    };

    const scene = createScene();
    const camera = createCamera();
    const renderer = createRenderer();
    const keys = createKeys(scene, config);
    const piano: PianoState = {
        config,
        runtimeConfig,
        animationRunning: false,

        scene,
        camera,
        renderer,

        lights: createLights(scene),
        keys,
        keyFlows: [],
        keyboardMappingOverlay: [],
        pedals: {
            soft: createPedal(scene, -1),
            sostenuto: createPedal(scene, 0),
            sustain: createPedal(scene, 1),
        },
        particles: createParticles(scene),

        stats: null,
    };

    if (import.meta.env.MODE === 'development') {
        addDebugHelpers(piano);
    }

    function startAnimation() {
        //only start animation if it's not active yet
        if (!piano.animationRunning) {
            animate(piano);
        }
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        startAnimation();
    }

    function configUpdated() {
        piano.keyboardMappingOverlay.forEach((mesh) => {
            piano.scene.remove(mesh);
        });
        piano.keyboardMappingOverlay = [];
        if (piano.runtimeConfig.showKeys) {
            piano.keyboardMappingOverlay = createKeyMappingOverlay(
                piano,
                piano.runtimeConfig.keyMap
            );
        } else {
            startAnimation();
        }
    }

    configUpdated();

    return {
        keyPressed: (note: number, velocity: number) => {
            keyPressed(piano, note - config.lowestMidiNote, velocity);
            startAnimation();
        },
        keyReleased: (note: number) => {
            keyReleased(piano, note - config.lowestMidiNote);
            startAnimation();
        },
        pedalPressed: (pedal: PedalType, value: number) => {
            pedalPressed(piano, pedal, value);
            startAnimation();
        },
        animate: startAnimation,
        onWindowResize,
        configUpdated,
        runtimeConfig,
    };
}

function getLowestMidiNote(numKeys: number): number {
    if (numKeys === 49 || numKeys === 61) {
        return 36; // C2
    } else if (numKeys === 76) {
        return 28; // E1
    } else if (numKeys === 88) {
        return 21; // A0
    } else {
        console.error('unsupported keyboard size');
        return 0;
    }
}

function getKeyOffset(numKeys: number): number {
    if (numKeys === 76) {
        return 4; // E1
    } else if (numKeys === 88) {
        return 9; // A0
    }
    //for 49, 61 keys
    return 0;
}

function createScene() {
    const scene = new THREE.Scene();

    const floorGeometry = new THREE.BoxGeometry(2000, 0.1, 2000);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.2,
        metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);

    floor.position.y = -pianoHeight;
    scene.add(floor);

    return scene;
}

function createCamera() {
    const camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight
    );
    camera.position.set(0, 0, 50);

    return camera;
}

function createRenderer() {
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer;
}

function createKey(scene: THREE.Scene, x: number, isBlack: boolean): Key {
    const keyConfig = isBlack ? keyBlack : keyWhite;

    //TODO combine into single mesh
    const mesh = new THREE.Mesh(
        isBlack ? keyGeometryBlack : keyGeometryWhite,
        isBlack ? keyMaterialBlack : keyMaterialWhite
    );
    mesh.position.x = isBlack ? x - keyDistance / 2 : x;
    mesh.position.y = -keyConfig.height / 2;
    mesh.position.z = keyConfig.z;
    scene.add(mesh);

    const light = new THREE.PointLight(0xff0000);
    light.visible = false;
    light.position.set(
        mesh.position.x,
        mesh.position.y - 2.5,
        mesh.position.z + keyWhite.thickness
    );
    scene.add(light);

    return {
        isBlack,
        width: keyConfig.width,
        x: mesh.position.x,
        mesh,
        pressedTimestamp: null,
        light,
        activeKeyFlow: null,
    };
}

function createKeys(scene: THREE.Scene, config: Config) {
    const keys = [];
    const blackKeys = [1, 3, 6, 8, 10];
    //center the keyboard around x=0, and align to have white keys between gridlines
    let x = ((-Math.floor(config.numKeys / 12) * 7) / 2) * keyDistance;

    for (let i = 0; i < config.numKeys; i++) {
        const isBlack = blackKeys.includes((i + config.keyOffset) % 12);
        const key = createKey(scene, x, isBlack);
        keys.push(key);

        if (!isBlack) {
            x += keyDistance;
        }
    }

    return keys;
}

function createPedal(scene: THREE.Scene, x: number): Pedal {
    const mesh = new THREE.Mesh(pedalGeometry, pedalMaterial);
    mesh.position.x = x;
    mesh.position.y = -pianoHeight;
    mesh.position.z = 1.2 * pianoHeight;
    scene.add(mesh);

    const light = new THREE.PointLight(0xffffff, 0.0, 4.0);
    light.position.set(
        mesh.position.x,
        mesh.position.y + 0.5,
        mesh.position.z + 1
    );
    scene.add(light);

    return {
        x,
        mesh,
        light,
    };
}

function pedalPressed(piano: PianoState, pedalType: PedalType, value: number) {
    const pedal = piano.pedals[pedalType];
    pedal.light.intensity = value * 0.5;
}

function createLights(scene: THREE.Scene): Lights {
    const ambientLight = new THREE.AmbientLight(0x404040, 2); // soft white light
    scene.add(ambientLight);
    return {
        ambientLight,
    };
}

function animateLights(keys: Key[], timestampMs: number) {
    const intensityHalfLifeMs = 5000;
    const color = new THREE.Color();
    const hsl = {} as THREE.HSL;
    let dirty = false;
    for (const key of keys) {
        const light = key.light;
        if (!light.visible || key.pressedTimestamp === null) {
            continue;
        }

        // fade out
        const exponent =
            (timestampMs - key.pressedTimestamp) / intensityHalfLifeMs;
        const intensity = light.intensity * Math.pow(2, -exponent);
        light.color.getHSL(hsl);
        color.setHSL(hsl.h, 0.5, hsl.l);
        light.color.lerpHSL(color, 0.1);
        light.intensity = Math.max(intensity, minIntensity);
        dirty = true;
    }
    return dirty;
}

function getCurrentHue(timestampMs: number) {
    return Math.sin(timestampMs / 20000);
}

function createParticles(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.15,
    });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    return particles;
}

function animateParticles(piano: PianoState, timestampMs: number) {
    const spawnWidth = 0.05;
    const zOffset = 1;

    const color = new THREE.Color();
    let positions: number[] = [];
    if (piano.particles.geometry.getAttribute('position')) {
        positions = [
            ...piano.particles.geometry.getAttribute('position').array,
        ];
    }
    let initialInfo: number[] = [];
    if (piano.particles.geometry.getAttribute('initialInfo')) {
        initialInfo = [
            ...piano.particles.geometry.getAttribute('initialInfo').array,
        ];
    }
    let colors: number[] = [];
    if (piano.particles.geometry.getAttribute('color')) {
        colors = [...piano.particles.geometry.getAttribute('color').array];
    }

    for (const key of piano.keys) {
        if (key.pressedTimestamp === null) {
            continue;
        }

        color.setHSL(getCurrentHue(key.pressedTimestamp), 1.0, 0.5);

        for (let i = 0; i < piano.runtimeConfig.particles.spawnCount; i++) {
            const x0 = key.x + THREE.MathUtils.randFloatSpread(key.width);
            const y0 = THREE.MathUtils.randFloatSpread(spawnWidth);
            const z0 = zOffset + THREE.MathUtils.randFloatSpread(spawnWidth);

            positions.push(x0, y0, z0);
            initialInfo.push(x0, y0, timestampMs);
            colors.push(color.r, color.g, color.b);
        }
    }

    //animate existing particles in x&y along a path based on their z position
    for (let i = 0; i < positions.length; i += 3) {
        const z = positions[i + 2];

        const x0 = initialInfo[i];
        const y0 = initialInfo[i + 1];
        const startT = initialInfo[i + 2];

        const t = timestampMs - startT;

        //despawn after some time
        const randomPhase = z - zOffset;
        const tWithPhase =
            t + randomPhase * piano.runtimeConfig.particles.phaseFactor;
        if (tWithPhase > piano.runtimeConfig.particles.despawnMs) {
            positions.splice(i, 3);
            initialInfo.splice(i, 3);
            colors.splice(i, 3);
            i -= 3;
            continue;
        }

        const omega = randomPhase * piano.runtimeConfig.particles.omega;
        positions[i] = x0 + randomPhase * tWithPhase;
        positions[i + 1] =
            y0 +
            Math.sin(tWithPhase * omega) *
                piano.runtimeConfig.particles.amplitude;
    }

    const positionsDirty =
        positions.length > 0 ||
        piano.particles.geometry.getAttribute('position')?.array.length !==
            positions.length;
    if (positionsDirty) {
        piano.particles.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(positions), 3)
        );
        piano.particles.geometry.setDrawRange(0, positions.length / 3);
    }

    const initialInfoDirty =
        piano.particles.geometry.getAttribute('initialInfo')?.array.length !==
        initialInfo.length;
    if (initialInfoDirty) {
        piano.particles.geometry.setAttribute(
            'initialInfo',
            new THREE.BufferAttribute(new Float32Array(initialInfo), 3)
        );
        piano.particles.geometry.setAttribute(
            'color',
            new THREE.BufferAttribute(new Float32Array(colors), 3)
        );
    }

    return positionsDirty || initialInfoDirty;
}

function animateKeyFlow(
    scene: THREE.Scene,
    keyFlows: KeyFlow[],
    timestampMs: number
) {
    const yShiftPerMs = 1 / 1_000;
    const yThresholdForRemoval = 30;

    // shift all keyflows up
    const dirty = keyFlows.length !== 0;
    for (let i = keyFlows.length - 1; i >= 0; i--) {
        const flow = keyFlows[i];
        const shift = (timestampMs - flow.timestamp) * yShiftPerMs;
        if (flow.active) {
            //grow keyflow, keeping bottom fixed
            const keyFlowLength = shift;
            flow.mesh.position.y = keyFlowYOffset + keyFlowLength / 2;
            flow.mesh.scale.y = keyFlowLength / initialKeyFlowHeight;
        } else {
            //only shift
            const keyFlowLength = flow.mesh.scale.y * initialKeyFlowHeight;
            flow.mesh.position.y = keyFlowYOffset + shift - keyFlowLength / 2;

            //remove inactive keyflows if offscreen
            if (flow.mesh.position.y > yThresholdForRemoval) {
                scene.remove(flow.mesh);
                keyFlows.splice(i, 1);
            }
        }
    }

    return dirty;
}

function keyPressed(piano: PianoState, keyIndex: number, velocity: number) {
    if (keyIndex < 0 || keyIndex >= piano.config.numKeys) {
        console.error('Invalid key index', keyIndex);
        return;
    }

    const pressedTimestamp = (document.timeline.currentTime as number) ?? 0;

    const key = piano.keys[keyIndex];
    const color = new THREE.Color();
    color.setHSL(getCurrentHue(pressedTimestamp), 1.0, 0.5);

    key.light.visible = true;
    key.light.intensity = Math.pow(100, velocity) - 1 + minIntensity;
    key.light.color = color;

    //TODO single mesh with emittance as texture?
    const flowGeometry = new THREE.BoxGeometry(
        key.width,
        initialKeyFlowHeight,
        0.1
    );
    const flowMaterial = new THREE.MeshLambertMaterial({ emissive: color });
    const flowMesh = new THREE.Mesh(flowGeometry, flowMaterial);
    flowMesh.position.set(key.x, keyFlowYOffset, -0.5);

    piano.scene.add(flowMesh);
    const keyFlow = {
        active: true,
        timestamp: pressedTimestamp,
        mesh: flowMesh,
    };
    piano.keyFlows.push(keyFlow);
    if (key.activeKeyFlow) {
        key.activeKeyFlow.active = false;
    }
    key.activeKeyFlow = keyFlow;

    key.pressedTimestamp = pressedTimestamp;
}

function keyReleased(piano: PianoState, keyIndex: number) {
    if (keyIndex < 0 || keyIndex >= piano.config.numKeys) {
        console.error('Invalid key index', keyIndex);
        return;
    }
    const key = piano.keys[keyIndex];
    key.pressedTimestamp = null;

    key.light.visible = false;

    if (key.activeKeyFlow) {
        key.activeKeyFlow.active = false;
        key.activeKeyFlow = null;
    }
}

function animate(piano: PianoState, timestampMs: number = 0) {
    piano.stats?.begin();
    const lightsDirty = animateLights(piano.keys, timestampMs);
    const keyFlowDirty = animateKeyFlow(
        piano.scene,
        piano.keyFlows,
        timestampMs
    );
    const particlesDirty = animateParticles(piano, timestampMs);
    const cameraDirty = animateCameraToFitScreen(piano);
    piano.animationRunning =
        lightsDirty || keyFlowDirty || particlesDirty || cameraDirty;

    piano.renderer.render(piano.scene, piano.camera);
    piano.stats?.end();

    if (piano.animationRunning) {
        requestAnimationFrame((timestamp) => animate(piano, timestamp));
    }
}

function animateCameraToFitScreen(piano: PianoState) {
    const cameraPosition = new THREE.Vector3();
    piano.camera.getWorldPosition(cameraPosition);
    const viewSize = new THREE.Vector2();
    piano.camera.getViewSize(cameraPosition.z, viewSize);
    const desiredXViewSize = (piano.config.numKeys / 12) * 7 * keyDistance;
    if (Math.abs(viewSize.x - desiredXViewSize) > 0.2) {
        piano.camera.position.z -=
            Math.max(0.1, 0.1 * Math.abs(viewSize.x - desiredXViewSize)) *
            Math.sign(viewSize.x - desiredXViewSize);
        return true;
    }
    return false;
}

/** add FPS graph and scene navigation (removed in production build) */
function addDebugHelpers(piano: PianoState) {
    const gridHelper = new THREE.GridHelper(100, 100);
    gridHelper.rotation.x = Math.PI / 2; // Rotate the gridHelper 90 degrees
    // piano.scene.add(gridHelper);

    const orbitControls = new OrbitControls(
        piano.camera,
        piano.renderer.domElement
    );
    orbitControls.addEventListener('change', () => {
        piano.renderer.render(piano.scene, piano.camera);
    });

    let lastProgramCount = 0;
    function logShaderRecompilations() {
        const programCount = piano.renderer.info.programs?.length || 0;
        if (programCount !== lastProgramCount) {
            console.log(
                'Programs added / shaders recompiled:',
                programCount - lastProgramCount
            );
            lastProgramCount = programCount;
        }
    }
    setInterval(logShaderRecompilations, 1000);

    const stats = new Stats();
    document.body.appendChild(stats.dom);

    piano.stats = stats;
    return { gridHelper, orbitControls, stats };
}

function createKeyMappingOverlay(piano: PianoState, keyMap: KeyMap) {
    if (!keyMap) {
        return [];
    }

    const meshes: THREE.Mesh<
        TextGeometry,
        THREE.MeshBasicMaterial,
        THREE.Object3DEventMap
    >[] = [];
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const loader = new FontLoader();
    loader.load('helvetiker_regular.typeface.json', function (font) {
        const usedNotes: { [key: number]: number } = {};
        for (const [code, note] of Object.entries(keyMap)) {
            const text = codeToCharMap[code] ?? code;

            const geometry = new TextGeometry(text, {
                font,
                size: 0.3,
                depth: 0.001,
                curveSegments: 12,
                bevelEnabled: true,
                bevelThickness: 0.01,
                bevelSize: 0.01,
                bevelOffset: 0,
                bevelSegments: 5,
            });
            geometry.computeBoundingBox();
            geometry.center();

            const mesh = new THREE.Mesh(geometry, material);

            const numUsed = usedNotes[note] ?? 0;
            usedNotes[note] = numUsed + 1;
            const isBlack =
                piano.keys[note - piano.config.lowestMidiNote].isBlack;

            const x = piano.keys[note - piano.config.lowestMidiNote].x;
            const y =
                1 -
                (isBlack ? keyBlack.height : keyWhite.height) +
                numUsed * 0.7;
            mesh.position.set(x, y, 0.5);

            piano.scene.add(mesh);
            meshes.push(mesh);
        }

        //start animation (needs to happen inside load() callback after meshes are added)
        if (!piano.animationRunning) {
            animate(piano);
        }
    });
    return meshes;
}
