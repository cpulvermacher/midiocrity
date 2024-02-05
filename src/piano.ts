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

export function Piano(numKeys = 88) {
    const scene = createScene();
    const camera = createCamera();
    const renderer = createRenderer();
    const lights = createLights(scene, numKeys);
    const keys = createKeys(scene, numKeys);
    const keyFlows: KeyFlow[] = [];

    if (import.meta.env.MODE === 'development') {
        addDebugHelpers(scene, camera, renderer);
    }

    const startAnimation = () => {
        //only start animation if it's not active yet
        if (!animationRunning) {
            animate(scene, camera, renderer, lights, keyFlows);
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
        keyPressed: (key: number, velocity: number) => {
            lightUpKey(scene, lights, keyFlows, keys, key, velocity);
            startAnimation();
        },
        keyReleased: (key: number) => turnOffKey(scene, lights, keys, key),
        animate: startAnimation
    };
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

function createKeys(scene: THREE.Scene, numKeys: number) {
    const keys = [];
    const blackKeys = [1, 3, 6, 8, 10];
    //center the keyboard around x=0, and align to have white keys between gridlines
    let x = -Math.floor(numKeys / 12) * 7 / 2;

    for (let i = 0; i < numKeys; i++) {
        const isBlack = blackKeys.includes(i % 12);
        const key = createKey(scene, x, isBlack);
        keys.push(key);

        if (!isBlack) {
            x += 1;
        }
    }

    return keys;
}

const createLights = (scene: THREE.Scene, numKeys: number): Lights => {
    const ambientLight = new THREE.AmbientLight(0x404040, 1); // soft white light
    scene.add(ambientLight);
    return {
        ambientLight,
        pointLights: new Array(numKeys).fill(null)
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


function lightUpKey(scene: THREE.Scene, lights: Lights, keyFlows: KeyFlow[], keys: THREE.Object3D[], keyIndex: number, velocity: number) {
    if (keyIndex < 0 || keyIndex >= keys.length) {
        console.error('Invalid key index', keyIndex);
        return;
    }

    const pointLight = new THREE.PointLight(0xff0000, Math.pow(100, velocity) - 1 + minIntensity);
    pointLight.position.set(
        keys[keyIndex].position.x,
        keys[keyIndex].position.y - 2.5,
        keys[keyIndex].position.z + keyThicknessWhite);
    scene.add(pointLight);
    if (lights.pointLights[keyIndex] !== null) {
        scene.remove(lights.pointLights[keyIndex] as THREE.PointLight);
    }
    lights.pointLights[keyIndex] = pointLight;

    //TODO single mesh with emittance as texture?
    const boundingBox = new THREE.Box3().setFromObject(keys[keyIndex]);
    const size = new THREE.Vector3();
    const flowGeometry = new THREE.BoxGeometry(boundingBox.getSize(size).x, 1, 0.1);
    //TODO adjust size based on length
    const flowMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff });
    const flowMesh = new THREE.Mesh(flowGeometry, flowMaterial);
    flowMesh.position.set(keys[keyIndex].position.x, 0, -0.1);

    scene.add(flowMesh);
    keyFlows.push({ timestamp: 0, mesh: flowMesh });
}

function turnOffKey(scene: THREE.Scene, lights: Lights, keys: THREE.Object3D[], keyIndex: number) {
    if (keyIndex < 0 || keyIndex >= keys.length) {
        console.error('Invalid key index', keyIndex);
        return;
    }

    const light = lights.pointLights[keyIndex];
    if (light) {
        scene.remove(light);
        lights.pointLights[keyIndex] = null;
    }
}


function animate(scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, lights: Lights, keyFlows: KeyFlow[], timestampMs: number = 0) {
    const lightsDirty = animateLights(lights, timestampMs);
    const keyFlowDirty = animateKeyFlow(scene, keyFlows, timestampMs);
    const cameraDirty = animateCameraToFitScreen(camera);
    animationRunning = lightsDirty || keyFlowDirty || cameraDirty;

    if (animationRunning) {
        requestAnimationFrame((timestamp) => animate(scene, camera, renderer, lights, keyFlows, timestamp));
    }
    renderer.render(scene, camera);

    frameCount++;
    const delta = clock.getElapsedTime();
    if (delta > 1) {
        const fps = frameCount / delta;
        console.log(`FPS: ${fps}`);

        frameCount = 0;
        clock.start();
    }

}

function animateCameraToFitScreen(camera: THREE.PerspectiveCamera) {
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    const viewSize = new THREE.Vector2();
    camera.getViewSize(cameraPosition.z, viewSize);
    const desiredXViewSize = 54; // TODO numkeys / 12 * 7
    if (Math.abs(viewSize.x - desiredXViewSize) > 0.2) {
        camera.position.z -= Math.max(0.1, 0.1 * Math.abs((viewSize.x - desiredXViewSize))) * Math.sign(viewSize.x - desiredXViewSize);
        return true;
    }
    return false;
}

function addDebugHelpers(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    const gridHelper = new THREE.GridHelper(100, 100);
    gridHelper.rotation.x = Math.PI / 2; // Rotate the gridHelper 90 degrees
    // scene.add(gridHelper);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.addEventListener('change', () => {
        renderer.render(scene, camera);
    });

    return { gridHelper, orbitControls };
}