import Stats from 'stats.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
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
    light: THREE.PointLight | null;
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

type Piano = {
    config: Config;
    animationRunning: boolean;

    //main three.js objects
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;

    //things that make up the scene
    lights: Lights;
    keys: Key[];
    keyFlows: KeyFlow[];
    pedals: {
        soft: Pedal;
        sostenuto: Pedal;
        sustain: Pedal;
    };

    //development helpers
    stats: Stats | null;
};

export function createPiano(numKeys = 88) {
    const config: Config = {
        numKeys: numKeys,
        lowestMidiNote: getLowestMidiNote(numKeys), // needed for translating MIDI note range of e.g. 21 - 108 for 88-key piano to 0 based index
        keyOffset: getKeyOffset(numKeys),
    };

    const scene = createScene();
    const camera = createCamera();
    const renderer = createRenderer();
    const piano: Piano = {
        config,
        animationRunning: false,

        scene,
        camera,
        renderer,

        lights: createLights(scene),
        keys: createKeys(scene, config),
        keyFlows: [],
        pedals: {
            soft: createPedal(scene, -1),
            sostenuto: createPedal(scene, 0),
            sustain: createPedal(scene, 1),
        },

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
        color: 0xbcbcbc,
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

    return {
        isBlack,
        width: keyConfig.width,
        x: mesh.position.x,
        mesh,
        pressedTimestamp: null,
        light: null,
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

function pedalPressed(piano: Piano, pedalType: PedalType, value: number) {
    const pedal = piano.pedals[pedalType];
    pedal.light.intensity = value * 0.5;
}

function createLights(scene: THREE.Scene): Lights {
    const ambientLight = new THREE.AmbientLight(0x404040, 1); // soft white light
    scene.add(ambientLight);
    return {
        ambientLight,
    };
}

function animateLights(keys: Key[], timestampMs: number) {
    const currentHue = getCurrentHue(timestampMs);
    const color = new THREE.Color();
    const hsl = {} as THREE.HSL;
    let dirty = false;
    for (const key of keys) {
        const light = key.light;
        if (!light) {
            continue;
        }

        //TODO intensity fade depends on FPS
        light.color.getHSL(hsl);
        if (hsl.h === 0) {
            //set hue based on current timestamp
            light.color.setHSL(currentHue, hsl.s, hsl.l);
        } else {
            // fade out
            color.setHSL(hsl.h, 0.5, hsl.l);
            light.color.lerpHSL(color, 0.1);
            light.intensity = Math.max(light.intensity * 0.93, minIntensity);
        }
        dirty = true;
    }
    return dirty;
}

function getCurrentHue(timestampMs: number) {
    return Math.sin(timestampMs / 20000);
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

function keyPressed(piano: Piano, keyIndex: number, velocity: number) {
    if (keyIndex < 0 || keyIndex >= piano.config.numKeys) {
        console.error('Invalid key index', keyIndex);
        return;
    }

    const pressedTimestamp = (document.timeline.currentTime as number) ?? 0;

    const key = piano.keys[keyIndex];
    const pointLight = new THREE.PointLight(
        0xff0000,
        Math.pow(100, velocity) - 1 + minIntensity
    );
    pointLight.position.set(
        key.mesh.position.x,
        key.mesh.position.y - 2.5,
        key.mesh.position.z + keyWhite.thickness
    );
    piano.scene.add(pointLight);
    if (key.light !== null) {
        piano.scene.remove(key.light);
        key.light.dispose();
    }
    key.light = pointLight;

    //TODO single mesh with emittance as texture?
    const color = new THREE.Color();
    color.setHSL(getCurrentHue(pressedTimestamp), 1.0, 0.5);

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

function keyReleased(piano: Piano, keyIndex: number) {
    if (keyIndex < 0 || keyIndex >= piano.config.numKeys) {
        console.error('Invalid key index', keyIndex);
        return;
    }
    const key = piano.keys[keyIndex];
    key.pressedTimestamp = null;

    if (key.light) {
        piano.scene.remove(key.light);
        key.light.dispose();
        key.light = null;
    }

    if (key.activeKeyFlow) {
        key.activeKeyFlow.active = false;
        key.activeKeyFlow = null;
    }
}

function animate(piano: Piano, timestampMs: number = 0) {
    piano.stats?.begin();
    const lightsDirty = animateLights(piano.keys, timestampMs);
    const keyFlowDirty = animateKeyFlow(
        piano.scene,
        piano.keyFlows,
        timestampMs
    );
    const cameraDirty = animateCameraToFitScreen(piano);
    piano.animationRunning = lightsDirty || keyFlowDirty || cameraDirty;

    piano.renderer.render(piano.scene, piano.camera);
    piano.stats?.end();

    if (piano.animationRunning) {
        requestAnimationFrame((timestamp) => animate(piano, timestamp));
    }
}

function animateCameraToFitScreen(piano: Piano) {
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
function addDebugHelpers(piano: Piano) {
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

    const stats = new Stats();
    document.body.appendChild(stats.dom);

    piano.stats = stats;
    return { gridHelper, orbitControls, stats };
}
