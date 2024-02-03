import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export function Piano() {
    const scene = new Scene();
    const camera = createCamera();
    const renderer = createRenderer();
    const keys = createKeys(scene);

    return {
        lightUpKey: (keyIndex: number) => lightUpKey(keys, keyIndex),
        animate: () => animate(scene, camera, renderer)
    };
}

function createCamera() {
    const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;
    return camera;
}

function createRenderer() {
    const renderer = new WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    return renderer;
}

function createKey(x: number) {
    const geometry = new BoxGeometry(1, 0.1, 3);
    const material = new MeshBasicMaterial({ color: 0xffffff });
    const key = new Mesh(geometry, material);
    key.position.x = x;
    return key;
}

function createKeys(scene: Scene) {
    const keys = Array.from({ length: 88 }, (_, i) => createKey(i - 44));
    keys.forEach(key => scene.add(key));
    return keys;
}

function lightUpKey(keys: Mesh[], keyIndex: number) {
    if (keyIndex < 0 || keyIndex >= keys.length) {
        console.error('Invalid key index');
        return;
    }
    keys[keyIndex].material = new MeshBasicMaterial({ color: 0xff0000 });
}

function animate(scene: Scene, camera: PerspectiveCamera, renderer: WebGLRenderer) {
    requestAnimationFrame(() => animate(scene, camera, renderer));
    renderer.render(scene, camera);
}
