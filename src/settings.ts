import GUI from 'lil-gui';
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
    const guiSynth = gui.addFolder('Synthesizer');
    guiSynth.close();
    guiSynth.add(config.synthExtra, 'maxGain', 0, 1);
    guiSynth.add(config.synthExtra, 'numOscillators', 1, 40, 1);
    guiSynth.add(config.synthExtra, 'oscillatorType', [
        'sawtooth',
        'sine',
        'square',
        'triangle',
    ]);
    guiSynth.add(config.synthExtra, 'detuneMultiplier', 0, 100);
    guiSynth.add(config.synthExtra, 'attackSeconds', 0, 5);
    guiSynth.add(config.synthExtra, 'decaySeconds', 0, 5);
    guiSynth.add(config.synthExtra, 'sustainLevel', 0, 1);
    guiSynth.add(config.synthExtra, 'releaseSeconds', 0, 5);

    const guiKeyboard = gui.addFolder('Keyboard');
    guiKeyboard.add(config.keyboard, 'midiOutput').name('Send MIDI Output');
    guiKeyboard
        .add(config.keyboard, 'showKeys')
        .name('Show Keys')
        .onChange((value: boolean) => {
            piano.configUpdated({
                showKeys: value,
                keyMap: config.keyboard.keyMap,
            });
        });
    guiKeyboard
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

    guiKeyboard
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
