import GUI from 'lil-gui';
import { createKeyMap } from './keyboard';
import { Piano } from './piano';
import { Synthesizer } from './synth';

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
            keyMap: createKeyMap(),
        },
        killSwitch: killSwitch,
    };

    const gui = new GUI({ container });
    gui.add(config.synth, 'midiInput').name('Play Sound on MIDI Input');
    const guiSynth = gui.addFolder('Synthesizer Details');
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
    guiSynth.add(config.synthExtra, 'fadeInTimeSeconds', 0, 5);
    guiSynth.add(config.synthExtra, 'fadeOutTimeSeconds', 0, 5);
    guiSynth.add(config.synthExtra, 'sustainDurationSeconds', 0, 5);

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

    gui.add(config, 'killSwitch').name('Release all keys');
    return config;
}
