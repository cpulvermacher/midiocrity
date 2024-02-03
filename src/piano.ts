import { AmbientLight, BoxGeometry, Camera, Color, GridHelper, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, PointLight, RectAreaLight, Scene, Vector3, WebGLRenderer } from 'three';
import { RectAreaLightHelper } from 'three/examples/jsm/Addons.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

const pianoHeight = 8;

type Lights = {
    ambientLight: AmbientLight;
    pointLights: PointLight[];
};

export function Piano(numKeys = 88) {
    const scene = createScene();
    const camera = createCamera();
    const renderer = createRenderer();
    const keys = createKeys(scene, numKeys);
    const lights = createLights(scene);

    if (import.meta.env.MODE === 'development') {
        addDebugHelpers(scene, camera, renderer);
    }

    return {
        lightUpKey: (keyIndex: number) => lightUpKey(scene, lights, keys, keyIndex),
        animate: () => animate(scene, camera, renderer, lights)
    };
}

function createScene() {
    const scene = new Scene();

    RectAreaLightUniformsLib.init();

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

    const light = new RectAreaLight(isBlack ? 0xaaaaaa : 0xffffff, 0.1, keyWidth, keyHeight);
    light.lookAt(new Vector3(0, 0, 1000));

    light.position.copy(key.position);

    const lightHelper = new RectAreaLightHelper(light);
    light.add(lightHelper);
    scene.add(light);
    return light;
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

const createLights = (scene: Scene): Lights => {
    const ambientLight = new AmbientLight(0x404040); // soft white light
    scene.add(ambientLight);
    return { ambientLight, pointLights: [] };
};

const animateLights = (lights: Lights, time: number) => {
    const color = new Color(0xffffff);
    color.setHSL(Math.sin(time * 0.1), 0.5, 0.5);
    for (const light of lights.pointLights) {
        light.color.lerpHSL(color, 0.1);
    }
};

function lightUpKey(scene: Scene, lights: Lights, keys: Object3D[], keyIndex: number) {
    if (keyIndex < 0 || keyIndex >= keys.length) {
        console.error('Invalid key index');
        return;
    }

    const pointLight = new PointLight(0xff0000, 1);
    pointLight.position.set(
        keys[keyIndex].position.x,
        keys[keyIndex].position.y - 2.5,
        keys[keyIndex].position.z + 0.1);
    scene.add(pointLight);
    lights.pointLights.push(pointLight);

}

function animate(scene: Scene, camera: Camera, renderer: WebGLRenderer, lights: Lights) {
    const time = Date.now() * 0.0005; // current time in seconds
    animateLights(lights, time);
    requestAnimationFrame(() => animate(scene, camera, renderer, lights));
    renderer.render(scene, camera);
}

function addDebugHelpers(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
    const gridHelper = new GridHelper(100, 100);
    gridHelper.rotation.x = Math.PI / 2; // Rotate the gridHelper 90 degrees
    // scene.add(gridHelper);

    const orbitControls = new OrbitControls(camera, renderer.domElement);

    return { gridHelper, orbitControls };
}
