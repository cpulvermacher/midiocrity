import { keyMap } from './keyboard';
import { startMIDI } from './midi';
import { createPiano } from './piano';
import { createSettings } from './settings';
import { startSynthesizer } from './synth';

const numKeys = 88;

const piano = createPiano(numKeys, keyMap);
const synth = startSynthesizer();
const config = createSettings(document.getElementById('gui')!, synth, piano);

window.addEventListener('resize', piano.onWindowResize);
piano.animate();

const { status, sendKeyPress, sendKeyRelease } = startMIDI({
    onKeyPressed: (key, velocity) => {
        if (config.synth.midiInput) {
            synth.keyPressed(key);
        }
        piano.keyPressed(key, velocity / 128.0);
    },
    onKeyReleased: (key) => {
        if (config.synth.midiInput) {
            synth.keyReleased(key);
        }
        piano.keyReleased(key);
    },
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
    Object.entries(status.activeInputChannels).forEach(
        ([id, value]) =>
            (document.getElementById(`channel-${id}`)!.className = value
                ? 'dot-on'
                : 'dot-off')
    );

    const anyChannelActive = Object.values(status.activeInputChannels).some(
        (v) => v
    );
    document.getElementById('midi-info-btn')!.className =
        'btn menu-dot-' + (anyChannelActive ? 'on' : 'off');

    const portList = document.getElementById('midi-ports')!;
    portList.replaceChildren(
        ...status.connectedInputPorts.map((port) => {
            const listItem = document.createElement('li');
            listItem.innerText = port;
            return listItem;
        })
    );
}, 2000);

let demoLoop: number | null = null;
let lastDemoKey = 0;
window.addEventListener('keydown', function (event) {
    if (event.repeat) {
        return;
    }

    if (event.key === '`') {
        // demo mode
        if (demoLoop !== null) {
            clearInterval(demoLoop);
            demoLoop = null;
        } else {
            demoLoop = setInterval(() => {
                const pressedKey = lastDemoKey + 21;
                piano.keyPressed(pressedKey, 0.5);
                synth.keyPressed(pressedKey);
                lastDemoKey++;
                if (lastDemoKey >= numKeys) {
                    lastDemoKey = 0;
                }
                setTimeout(() => {
                    piano.keyReleased(pressedKey);
                    synth.keyReleased(pressedKey);
                }, 200);
            }, 20);
        }
    } else {
        if (event.code in keyMap) {
            const key = keyMap[event.code];
            synth.keyPressed(key);
            if (config.keyboard.midiOutput) {
                sendKeyPress(key);
            } else {
                piano.keyPressed(key, 0.5);
            }
        }
    }
});

window.addEventListener('keyup', function (event) {
    if (event.code in keyMap) {
        const key = keyMap[event.code];
        synth.keyReleased(key);
        if (config.keyboard.midiOutput) {
            sendKeyRelease(key);
        } else {
            piano.keyReleased(key);
        }
    }
});
