import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const pianoHeight = 8;
const keyThicknessWhite = 0.5;
const keyThicknessBlack = 0.2;
const minIntensity = 0.05;

let animationRunning = false;
const clock = new THREE.Clock();
let frameCount = 0;

type Lights = {
    ambientLight: THREE.AmbientLight;
    pointLights: Array<THREE.PointLight | null>;
};

type KeyFlow = {
    timestamp: number;
    mesh: THREE.Mesh;
};

type Config = {
    numKeys: number;
    lowestMidiNote: number;
    keyOffset: number;
};

type Piano = {
    config: Config;

    //main three.js objects
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;

    //things that make up the scene
    lights: Lights;
    keys: THREE.Mesh[];
    keyFlows: KeyFlow[];
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
    const piano = {
        config,

        scene,
        camera,
        renderer,

        lights: createLights(scene, config),
        keys: createKeys(scene, config),
        keyFlows: [],
    };

    if (import.meta.env.MODE === 'development') {
        addDebugHelpers(piano);
    }

    const startAnimation = () => {
        //only start animation if it's not active yet
        if (!animationRunning) {
            animate(piano);
        }
    };

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        startAnimation();
    }
    window.addEventListener('resize', onWindowResize);

    return {
        keyPressed: (note: number, velocity: number) => {
            lightUpKey(piano, (note - config.lowestMidiNote), velocity);
            startAnimation();
        },
        keyReleased: (note: number) => turnOffKey(piano, (note - config.lowestMidiNote)),
        animate: startAnimation
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
        console.error("unsupported keyboard size");
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
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xbcbcbc, roughness: 0.2, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);

    floor.position.y = -pianoHeight;
    scene.add(floor);

    return scene;
}

function createCamera() {
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight);
    camera.position.set(0, 0, 50);

    return camera;
}

function createRenderer() {
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer;
}

function createKey(scene: THREE.Scene, x: number, isBlack: boolean) {
    const keyWidth = isBlack ? 0.4 : 0.9;
    const keyHeight = isBlack ? pianoHeight * 0.8 : pianoHeight;

    //TODO combine into single mesh
    const geometry = new THREE.BoxGeometry(keyWidth, keyHeight, isBlack ? keyThicknessBlack : keyThicknessWhite);
    const material = new THREE.MeshStandardMaterial({ color: isBlack ? 0xaaaaaa : 0xffffff });
    const key = new THREE.Mesh(geometry, material);
    key.position.x = isBlack ? x - 0.5 : x;
    key.position.y = - keyHeight / 2;
    key.position.z = isBlack ? keyThicknessWhite / 2 + keyThicknessBlack / 2 : 0;
    scene.add(key);

    return key;
}

function createKeys(scene: THREE.Scene, config: Config) {
    const keys = [];
    const blackKeys = [1, 3, 6, 8, 10];
    //center the keyboard around x=0, and align to have white keys between gridlines
    let x = -Math.floor(config.numKeys / 12) * 7 / 2;

    for (let i = 0; i < config.numKeys; i++) {
        const isBlack = blackKeys.includes((i + config.keyOffset) % 12);
        const key = createKey(scene, x, isBlack);
        keys.push(key);

        if (!isBlack) {
            x += 1;
        }
    }

    return keys;
}

const createLights = (scene: THREE.Scene, config: Config): Lights => {
    const ambientLight = new THREE.AmbientLight(0x404040, 1); // soft white light
    scene.add(ambientLight);
    return {
        ambientLight,
        pointLights: new Array(config.numKeys).fill(null)
    };
};

const animateLights = (lights: Lights, timestampMs: number) => {
    const currentHue = getCurrentHue(timestampMs);
    const color = new THREE.Color();
    const hsl = {} as THREE.HSL;
    let dirty = false;
    for (const light of lights.pointLights) {
        if (light) {
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
    }
    return dirty;
};

function getCurrentHue(timestampMs: number) {
    return Math.sin(timestampMs / 20000);
}

function animateKeyFlow(scene: THREE.Scene, keyFlows: KeyFlow[], timestampMs: number) {
    const yShiftPerMs = 1 / 1_000;
    const yOffset = -1;
    const yThresholdForRemoval = 30;

    const dirty = keyFlows.length !== 0;
    for (let i = keyFlows.length - 1; i >= 0; i--) {
        const flow = keyFlows[i];

        if (flow.timestamp === 0) {
            flow.timestamp = timestampMs;
            (flow.mesh.material as THREE.MeshLambertMaterial).emissive.setHSL(getCurrentHue(timestampMs), 1, 0.5);
        }
        flow.mesh.position.y = yOffset + (timestampMs - flow.timestamp) * yShiftPerMs;

        if (flow.mesh.position.y > yThresholdForRemoval) {
            scene.remove(flow.mesh);
            keyFlows.splice(i, 1);
        }
    }

    return dirty;
}


function lightUpKey(piano: Piano, keyIndex: number, velocity: number) {
    if (keyIndex < 0 || keyIndex >= piano.config.numKeys) {
        console.error('Invalid key index', keyIndex);
        return;
    }

    const pointLight = new THREE.PointLight(0xff0000, Math.pow(100, velocity) - 1 + minIntensity);
    pointLight.position.set(
        piano.keys[keyIndex].position.x,
        piano.keys[keyIndex].position.y - 2.5,
        piano.keys[keyIndex].position.z + keyThicknessWhite);
    piano.scene.add(pointLight);
    if (piano.lights.pointLights[keyIndex] !== null) {
        piano.scene.remove(piano.lights.pointLights[keyIndex] as THREE.PointLight);
    }
    piano.lights.pointLights[keyIndex] = pointLight;

    //TODO single mesh with emittance as texture?
    const boundingBox = new THREE.Box3().setFromObject(piano.keys[keyIndex]);
    const size = new THREE.Vector3();
    const flowGeometry = new THREE.BoxGeometry(boundingBox.getSize(size).x, 1, 0.1);
    //TODO adjust size based on length
    const flowMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff });
    const flowMesh = new THREE.Mesh(flowGeometry, flowMaterial);
    flowMesh.position.set(piano.keys[keyIndex].position.x, 0, -0.1);

    piano.scene.add(flowMesh);
    piano.keyFlows.push({ timestamp: 0, mesh: flowMesh });
}

function turnOffKey(piano: Piano, keyIndex: number) {
    if (keyIndex < 0 || keyIndex >= piano.config.numKeys) {
        console.error('Invalid key index', keyIndex);
        return;
    }

    const light = piano.lights.pointLights[keyIndex];
    if (light) {
        piano.scene.remove(light);
        piano.lights.pointLights[keyIndex] = null;
    }
}


function animate(piano: Piano, timestampMs: number = 0) {
    const lightsDirty = animateLights(piano.lights, timestampMs);
    const keyFlowDirty = animateKeyFlow(piano.scene, piano.keyFlows, timestampMs);
    const cameraDirty = animateCameraToFitScreen(piano);
    animationRunning = lightsDirty || keyFlowDirty || cameraDirty;

    if (animationRunning) {
        requestAnimationFrame((timestamp) => animate(piano, timestamp));
    }
    piano.renderer.render(piano.scene, piano.camera);

    frameCount++;
    const delta = clock.getElapsedTime();
    if (delta > 1) {
        const fps = frameCount / delta;
        console.log(`FPS: ${fps}`);

        frameCount = 0;
        clock.start();
    }
}

function animateCameraToFitScreen(piano: Piano) {
    const cameraPosition = new THREE.Vector3();
    piano.camera.getWorldPosition(cameraPosition);
    const viewSize = new THREE.Vector2();
    piano.camera.getViewSize(cameraPosition.z, viewSize);
    const desiredXViewSize = piano.config.numKeys / 12 * 7;
    if (Math.abs(viewSize.x - desiredXViewSize) > 0.2) {
        piano.camera.position.z -= Math.max(0.1, 0.1 * Math.abs((viewSize.x - desiredXViewSize))) * Math.sign(viewSize.x - desiredXViewSize);
        return true;
    }
    return false;
}

function addDebugHelpers(piano: Piano) {
    const gridHelper = new THREE.GridHelper(100, 100);
    gridHelper.rotation.x = Math.PI / 2; // Rotate the gridHelper 90 degrees
    // scene.add(gridHelper);

    const orbitControls = new OrbitControls(piano.camera, piano.renderer.domElement);
    orbitControls.addEventListener('change', () => {
        piano.renderer.render(piano.scene, piano.camera);
    });

    return { gridHelper, orbitControls };
}