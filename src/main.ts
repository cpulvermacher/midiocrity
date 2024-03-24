import { startMIDI } from './midi';
import { createPiano } from './piano';

const numKeys = 88;

const piano = createPiano(numKeys);
window.addEventListener('resize', piano.onWindowResize);
piano.animate();

const { status } = startMIDI({
    onKeyPressed: (key, velocity) => piano.keyPressed(key, velocity / 128.0),
    onKeyReleased: piano.keyReleased,
    onPedalPressed: (pedal, value) => piano.pedalPressed(pedal, value / 128.0),
    onPedalReleased: (pedal, value) => piano.pedalPressed(pedal, value / 128.0),
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

setInterval(() => {
    Object.entries(status.activeChannels).forEach(
        ([id, value]) =>
            (document.getElementById(`channel-${id}`)!.className = value
                ? 'dot-on'
                : 'dot-off')
    );

    const portList = document.getElementById('midi-ports')!;
    portList.replaceChildren(
        ...status.connectedPorts.map((port) => {
            const listItem = document.createElement('li');
            listItem.innerText = port;
            return listItem;
        })
    );

    document.getElementById('midi-info-btn')!.className =
        'btn menu-dot-' + (status.connectedPorts.length ? 'on' : 'off');
}, 2000);

// press 'd' to start demo
let demoLoop: number | null = null;
let key = 0;
window.addEventListener('keydown', function (event) {
    if (event.key === 'd') {
        if (demoLoop !== null) {
            clearInterval(demoLoop);
            demoLoop = null;
        } else {
            demoLoop = setInterval(() => {
                const pressedKey = key + 21;
                piano.keyPressed(pressedKey, 0.5);
                key++;
                if (key >= numKeys) {
                    key = 0;
                }
                setTimeout(() => piano.keyReleased(pressedKey), 2000);
            }, 20);
        }
    }
});
