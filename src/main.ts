import { startMIDI } from './midi';
import { createPiano } from './piano';
import { createSettings } from './settings';
import { startSynthesizer } from './synth';

const piano = createPiano();
const synth = startSynthesizer();
const config = createSettings(document.getElementById('gui')!, synth, piano);

const version = import.meta.env.VITE_GIT_VERSION ?? 'dev';
document.getElementById('git-version')!.innerText = `Version: ${version}`;

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
    onPedalPressed: (pedal, value) => {
        if (config.synth.midiInput) {
            synth.pedalPressed(pedal, value / 128.0);
        }
        piano.pedalPressed(pedal, value / 128.0);
    },
    onPedalReleased: (pedal, value) => {
        if (config.synth.midiInput) {
            synth.pedalPressed(pedal, value / 128.0);
        }
        piano.pedalPressed(pedal, value / 128.0);
    },
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
                if (lastDemoKey >= 88) {
                    lastDemoKey = 0;
                }
                setTimeout(() => {
                    piano.keyReleased(pressedKey);
                    synth.keyReleased(pressedKey);
                }, 200);
            }, 20);
        }
    } else {
        if (config.keyboard.keyMap && event.code in config.keyboard.keyMap) {
            const key = config.keyboard.keyMap[event.code];
            if (typeof key === 'number') {
                synth.keyPressed(key);
                if (config.keyboard.midiOutput) {
                    sendKeyPress(key);
                } else {
                    piano.keyPressed(key, 0.5);
                }
            } else {
                synth.pedalPressed(key, 1);
                piano.pedalPressed(key, 1);
            }
        }
    }
});

window.addEventListener('keyup', function (event) {
    if (config.keyboard.keyMap && event.code in config.keyboard.keyMap) {
        const key = config.keyboard.keyMap[event.code];
        if (typeof key === 'number') {
            synth.keyReleased(key);
            if (config.keyboard.midiOutput) {
                sendKeyRelease(key);
            } else {
                piano.keyReleased(key);
            }
        } else {
            synth.pedalPressed(key, 0);
            piano.pedalPressed(key, 0);
        }
    }
});
