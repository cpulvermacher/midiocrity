import GUI, { Controller } from 'lil-gui';
import { createKeyMap } from './keyboard';
import { Piano } from './piano';
import { Synthesizer } from './synth';

const firstBottomKey = 36;
const firstTopKey = 60;
const firstKeyOptions = {
    C1: 24,
    C2: 36,
    C3: 48,
    'C4 (middle C)': 60,
    C5: 72,
    C6: 84,
};

export function createSettings(
    container: HTMLElement,
    synth: Synthesizer,
    piano: Piano
) {
    function killSwitch() {
        for (let i = 0; i < 127; i++) {
            synth.keyReleased(i);
            piano.keyReleased(i);
        }
    }
    const config = {
        synth: {
            midiInput: true,
        },
        synthExtra: synth.config,
        keyboard: {
            midiOutput: false,
            showKeys: false,
            firstBottomKey,
            firstTopKey,
            keyMap: createKeyMap(firstBottomKey, firstTopKey),
        },
        killSwitch: killSwitch,
    };

    const gui = new GUI({ container });
    gui.add(config.synth, 'midiInput').name('Play Sound on MIDI Input');

    const synthesizer = gui.addFolder('Synthesizer');
    synthesizer.close();
    synthesizer.add(config.synthExtra, 'maxGain', 0, 1);
    synthesizer.add(config.synthExtra, 'numOscillators', 1, 40, 1);
    synthesizer.add(config.synthExtra, 'oscillatorType', [
        'sawtooth',
        'sine',
        'square',
        'triangle',
    ]);
    synthesizer.add(config.synthExtra, 'detuneMultiplier', 0, 100);
    const envelope = synthesizer.addFolder('Envelope');
    envelope.add(config.synthExtra, 'attackSeconds', 0, 5);
    envelope.add(config.synthExtra, 'decaySeconds', 0, 5);
    envelope.add(config.synthExtra, 'sustainLevel', 0, 1);
    envelope.add(config.synthExtra, 'releaseSeconds', 0, 5);
    envelope.close();

    const compressor = synthesizer.addFolder('Compressor');
    addAudioParam(compressor, config.synthExtra.compressor, 'threshold');
    addAudioParam(compressor, config.synthExtra.compressor, 'knee');
    addAudioParam(compressor, config.synthExtra.compressor, 'ratio');
    addAudioParam(compressor, config.synthExtra.compressor, 'attack');
    addAudioParam(compressor, config.synthExtra.compressor, 'release');
    compressor.close();

    const keyboard = gui.addFolder('Keyboard');
    keyboard.add(config.keyboard, 'midiOutput').name('Send MIDI Output');
    keyboard
        .add(config.keyboard, 'showKeys')
        .name('Show Keys')
        .onChange((value: boolean) => {
            piano.configUpdated({
                showKeys: value,
                keyMap: config.keyboard.keyMap,
            });
        });
    keyboard
        .add(config.keyboard, 'firstBottomKey', firstKeyOptions)
        .name('Bottom Row Start')
        .onChange((value: number) => {
            config.keyboard.keyMap = createKeyMap(
                value,
                config.keyboard.firstTopKey
            );
            piano.configUpdated({
                showKeys: config.keyboard.showKeys,
                keyMap: config.keyboard.keyMap,
            });
        });

    keyboard
        .add(config.keyboard, 'firstTopKey', firstKeyOptions)
        .name('Top Row Start')
        .onChange((value: number) => {
            config.keyboard.keyMap = createKeyMap(
                config.keyboard.firstBottomKey,
                value
            );
            piano.configUpdated({
                showKeys: config.keyboard.showKeys,
                keyMap: config.keyboard.keyMap,
            });
        });

    gui.add(config, 'killSwitch').name('Release all keys');
    return config;
}

function addAudioParam<T extends object>(
    gui: GUI,
    obj: T,
    key: keyof T,
    step?: number
): Controller {
    if (!(obj[key] instanceof AudioParam)) {
        throw Error(`${String(key)} is not an AudioParam, ${obj[key]}`);
    }

    const param = obj[key] as AudioParam;
    Object.defineProperty(obj, key, {
        get: () => Number(param.value.toPrecision(3)),
        set: (value: number) => (param.value = value),
    });
    return gui.add(obj, String(key), param.minValue, param.maxValue, step);
}
