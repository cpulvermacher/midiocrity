import { AmbientLight, BoxGeometry, BufferGeometry, Camera, Color, Float32BufferAttribute, GridHelper, Mesh, MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera, PerspectiveCamera, PointLight, Points, PointsMaterial, RectAreaLight, Scene, Vector3, WebGLRenderer } from 'three';
import { RectAreaLightHelper } from 'three/examples/jsm/Addons.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

const pianoHeight = 8;

export function Piano(numKeys = 88) {
    const scene = createScene();
    const camera = createCamera();
    const renderer = createRenderer();
    const keys = createKeys(scene, numKeys);
    const lights = createLights(scene);
    const particleSystem = createParticleSystem(scene);


    if (import.meta.env.MODE === 'development') {
        addDebugHelpers(scene, camera, renderer);
    }

    return {
        lightUpKey: (keyIndex: number) => lightUpKey(particleSystem, keys, keyIndex),
        animate: () => animate(scene, camera, renderer, particleSystem)
    };
}

function createScene() {
    const scene = new Scene();

    RectAreaLightUniformsLib.init();

    const geoFloor = new BoxGeometry(2000, 0.1, 2000);
    const matStdFloor = new MeshStandardMaterial({ color: 0xbcbcbc, roughness: 0.1, metalness: 0 });
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

    const key = new RectAreaLight(isBlack ? 0xaaaaaa : 0xffffff, 0.1, keyWidth, keyHeight);
    key.lookAt(new Vector3(0, 0, 1000));

    key.position.x = isBlack ? x - 0.5 : x;
    key.position.y = - keyHeight / 2;
    key.position.z = isBlack ? 0.5 : 0;

    const lightHelper = new RectAreaLightHelper(key);
    key.add(lightHelper);
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

const createLights = (scene: Scene) => {
    const ambientLight = new AmbientLight(0x404040); // soft white light
    scene.add(ambientLight);

    const pointLight = new PointLight(0xff0000, 1, 100);
    pointLight.position.set(0, 0, 50);
    scene.add(pointLight);

    return { ambientLight, pointLight };
};

const animateLights = (lights: { ambientLight: AmbientLight, pointLight: PointLight; }, time: number) => {
    const color = new Color(0xffffff);
    color.setHSL(Math.sin(time * 0.1), 0.5, 0.5);
    lights.pointLight.color.lerpHSL(color, 0.1);
};


const createParticleSystem = (scene: Scene) => {
    const particles = new BufferGeometry();
    const particleMaterial = new PointsMaterial({ color: 0xffff00, size: 0.1 });

    const positions = [];
    for (let i = 0; i < 100; i++) {
        positions.push(0, 0, 0);
    }
    particles.setAttribute('position', new Float32BufferAttribute(positions, 3));

    const particleSystem = new Points(particles, particleMaterial);
    scene.add(particleSystem);

    return particleSystem;
};

const animateParticles = (particleSystem: Points, deltaTime: number) => {
    const positions = particleSystem.geometry.attributes.position.array as number[];
    for (let i = 0; i < positions.length; i += 3) {
        positions[i] += (Math.random() - 0.5) * deltaTime;
        positions[i + 1] += deltaTime;
    }
    particleSystem.geometry.attributes.position.needsUpdate = true;
};


function lightUpKey(particleSystem: Points, keys: Mesh[], keyIndex: number) {
    if (keyIndex < 0 || keyIndex >= keys.length) {
        console.error('Invalid key index');
        return;
    }
    keys[keyIndex].material = new MeshBasicMaterial({ color: 0xff0000 });


    // Position the particle system at the key and reset the particles
    particleSystem.position.copy(keys[keyIndex].position);
    const positions = particleSystem.geometry.attributes.position.array as number[];
    for (let i = 0; i < positions.length; i += 3) {
        positions[i] = 0;
        positions[i + 1] = 0;
        positions[i + 2] = 0;
    }
}

function animate(scene: Scene, camera: Camera, renderer: WebGLRenderer, particleSystem) {
    const time = Date.now() * 0.0005; // current time in seconds
    // animateLights(lights, time);
    animateParticles(particleSystem, time);
    requestAnimationFrame(() => animate(scene, camera, renderer, particleSystem));
    renderer.render(scene, camera);
}

function addDebugHelpers(scene: Scene, camera: Camera, renderer: WebGLRenderer) {
    const gridHelper = new GridHelper(100, 100);
    scene.add(gridHelper);
    gridHelper.rotation.x = Math.PI / 2; // Rotate the gridHelper 90 degrees

    const orbitControls = new OrbitControls(camera, renderer.domElement);

    return { gridHelper, orbitControls };
}
