import { AmbientLight, BoxGeometry, Camera, Color, GridHelper, HSL, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, PointLight, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const pianoHeight = 8;
const minIntensity = 0.05;
let animationRunning = false;

type Lights = {
    ambientLight: AmbientLight;
    pointLights: Array<PointLight | null>;
};

export function Piano(numKeys = 88) {
    const scene = createScene();
    const camera = createCamera();
    const renderer = createRenderer();
    const lights = createLights(scene, numKeys);
    const keys = createKeys(scene, numKeys);

    if (import.meta.env.MODE === 'development') {
        addDebugHelpers(scene, camera, renderer);
    }

    const startAnimation = () => {
        //only start animation if it's not active yet
        if (!animationRunning) {
            animate(scene, camera, renderer, lights);
        }
    };
    return {
        keyPressed: (key: number, velocity: number) => {
            lightUpKey(scene, lights, keys, key, velocity);
            startAnimation();
        },
        keyReleased: (key: number) => turnOffKey(scene, lights, keys, key),
        animate: startAnimation
    };
}

function createScene() {
    const scene = new Scene();

    const geoFloor = new BoxGeometry(2000, 0.1, 2000);
    const matStdFloor = new MeshStandardMaterial({ color: 0xbcbcbc, roughness: 0.1, metalness: 0.4 });
    const mshStdFloor = new Mesh(geoFloor, matStdFloor);

    mshStdFloor.position.y = -pianoHeight;
    scene.add(mshStdFloor);

    return scene;
}

function createCamera() {

    const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 0, 70);

    return camera;
}

function createRenderer() {
    const renderer = new WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer;
}

function createKey(scene: Scene, x: number, isBlack: boolean) {
    const keyWidth = isBlack ? 0.4 : 0.9;
    const keyHeight = isBlack ? pianoHeight * 0.8 : pianoHeight;

    const geometry = new BoxGeometry(keyWidth, keyHeight, 0.1);
    const material = new MeshStandardMaterial({ color: isBlack ? 0xaaaaaa : 0xffffff });
    const key = new Mesh(geometry, material);
    key.position.x = isBlack ? x - 0.5 : x;
    key.position.y = - keyHeight / 2;
    key.position.z = isBlack ? 0.5 : 0;
    scene.add(key);

    return key;
}

function createKeys(scene: Scene, numKeys: number) {
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

const createLights = (scene: Scene, numKeys: number): Lights => {
    const ambientLight = new AmbientLight(0x404040, 1); // soft white light
    scene.add(ambientLight);
    return {
        ambientLight,
        pointLights: new Array(numKeys).fill(null)
    };
};

const animateLights = (lights: Lights, timestampMs: number) => {
    const hue = Math.sin(timestampMs / 20_000);
    const color = new Color();
    const hsl = {} as HSL;
    let dirty = false;
    for (const light of lights.pointLights) {
        if (light) {
            //TODO intensity fade depends on FPS
            color.setHSL(hue, 0.5, light.color.getHSL(hsl).l);
            light.color.lerpHSL(color, 0.1);
            light.intensity = Math.max(light.intensity * 0.93, minIntensity);
            dirty = true;
        }
    }
    return dirty;
};

function lightUpKey(scene: Scene, lights: Lights, keys: Object3D[], keyIndex: number, velocity: number) {
    if (keyIndex < 0 || keyIndex >= keys.length) {
        console.error('Invalid key index', keyIndex);
        return;
    }

    const pointLight = new PointLight(0xff0000, Math.pow(100, velocity) - 1 + minIntensity);
    pointLight.position.set(
        keys[keyIndex].position.x,
        keys[keyIndex].position.y - 2.5,
        keys[keyIndex].position.z + 0.1);
    scene.add(pointLight);
    if (lights.pointLights[keyIndex] !== null) {
        scene.remove(lights.pointLights[keyIndex] as PointLight);
    }
    lights.pointLights[keyIndex] = pointLight;
}

function turnOffKey(scene: Scene, lights: Lights, keys: Object3D[], keyIndex: number) {
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


function animate(scene: Scene, camera: Camera, renderer: WebGLRenderer, lights: Lights, timestampMs: number = 0) {
    animationRunning = animateLights(lights, timestampMs);
    if (animationRunning) {
        requestAnimationFrame((timestamp) => animate(scene, camera, renderer, lights, timestamp));
    }
    renderer.render(scene, camera);
}

function addDebugHelpers(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
    const gridHelper = new GridHelper(100, 100);
    gridHelper.rotation.x = Math.PI / 2; // Rotate the gridHelper 90 degrees
    // scene.add(gridHelper);

    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.addEventListener('change', () => {
        renderer.render(scene, camera);
    });

    return { gridHelper, orbitControls };
}
