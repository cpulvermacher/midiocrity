import { BoxGeometry, Camera, GridHelper, Mesh, MeshBasicMaterial, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function Piano(numKeys = 88) {
    const scene = new Scene();
    const camera = createCamera();
    const renderer = createRenderer();
    const keys = createKeys(scene, numKeys);

    if (import.meta.env.MODE === 'development') {
        addDebugHelpers(scene, camera, renderer);
    }

    return {
        lightUpKey: (keyIndex: number) => lightUpKey(keys, keyIndex),
        animate: () => animate(scene, camera, renderer)
    };
}

function createCamera() {
    const scale = 50;
    const camera = new OrthographicCamera(window.innerWidth / -scale, window.innerWidth / scale, window.innerHeight / scale, window.innerHeight / -scale);
    camera.position.z = 10;
    return camera;
}

function createRenderer() {
    const renderer = new WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer;
}


function createKey(x: number, isBlack: boolean) {
    const keyWidth = isBlack ? 0.4 : 0.9;
    const keyHeight = isBlack ? 6 : 8;

    const geometry = new BoxGeometry(keyWidth, keyHeight, 0.1);
    const material = new MeshBasicMaterial({ color: isBlack ? 0xaaaaaa : 0xffffff });

    const key = new Mesh(geometry, material);
    key.position.x = isBlack ? x - 0.5 : x;
    key.position.y = - keyHeight / 2;
    key.position.z = isBlack ? 0.5 : 0;

    return key;
}

function createKeys(scene: Scene, numKeys: number) {
    const keys = [];
    const blackKeys = [1, 3, 6, 8, 10];
    //center the keyboard around x=0, and align to have white keys between gridlines
    let x = -Math.floor(numKeys / 12) * 7 / 2;

    for (let i = 0; i < numKeys; i++) {
        const isBlack = blackKeys.includes(i % 12);
        const key = createKey(x, isBlack);
        scene.add(key);
        keys.push(key);

        if (!isBlack) {
            x += 1;
        }
    }

    return keys;
}

function lightUpKey(keys: Mesh[], keyIndex: number) {
    if (keyIndex < 0 || keyIndex >= keys.length) {
        console.error('Invalid key index');
        return;
    }
    keys[keyIndex].material = new MeshBasicMaterial({ color: 0xff0000 });
}

function animate(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
    requestAnimationFrame(() => animate(scene, camera, renderer));
    renderer.render(scene, camera);
}

function addDebugHelpers(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
    const gridHelper = new GridHelper(100, 100);
    scene.add(gridHelper);
    gridHelper.rotation.x = Math.PI / 2; // Rotate the gridHelper 90 degrees

    const orbitControls = new OrbitControls(camera, renderer.domElement);

    return { gridHelper, orbitControls };
}
