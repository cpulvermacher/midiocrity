import { startMIDI } from './midi';
import { createPiano } from './piano';

const numKeys = 88;

const piano = createPiano(numKeys);
window.addEventListener('resize', piano.onWindowResize);
piano.animate();

startMIDI({
    onKeyPressed: (key, velocity) => piano.keyPressed(key, velocity / 128.0),
    onKeyReleased: piano.keyReleased,
    onInit: () => {
        document.getElementById('loading')!.style.display = 'none';
    },
    onInitFailure: (reason) => {
        document.getElementById('loading')!.style.display = 'none';
        if (reason === 'nopermissions') {
            document.getElementById('no-permission')!.style.display = 'flex';
        } else if (reason === 'unsupported') {
            document.getElementById('no-webmidi')!.style.display = 'flex';
        }
    },
});

// demo mode: play random notes
let demoLoop: number | null = null;
window.addEventListener('keydown', function (event) {
    if (event.key === 'd') {
        if (demoLoop !== null) {
            clearInterval(demoLoop);
            demoLoop = null;
        } else {
            demoLoop = setInterval(() => {
                const key = Math.floor(Math.random() * numKeys);
                piano.keyPressed(21 + key, 0.5);
                setTimeout(() => piano.keyReleased(21 + key), 3000);
            }, 500);
        }
    }
});
