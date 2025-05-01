import type { PedalType } from './midi';

const silenceGain = 0.0001; // avoid zero for exponential ramp

export type OvertoneType = 'none' | 'harmonic' | 'octaves' | 'drawbars';

export type OvertoneAmplitude = 'constant' | '1/n';

export type SynthesizerConfig = {
    maxGain: number;
    oscillatorType: OscillatorType;
    numOscillators: number;
    overtoneType: OvertoneType;
    overtoneAmplitude: OvertoneAmplitude;
    detuneMultiplier: number;
    drawbars: {
        subFundamental: number;
        subThird: number;
        fundamental: number;
        second: number;
        third: number;
        fourth: number;
        fifth: number;
        sixth: number;
        eighth: number;
    };
    attackSeconds: number;
    decaySeconds: number;
    sustainLevel: number;
    releaseSeconds: number;
    compressor: DynamicsCompressorNode;
};

export type Synthesizer = {
    keyPressed: (note: number) => void;
    keyReleased: (note: number) => void;
    pedalPressed: (pedal: PedalType, value: number) => void;
    config: SynthesizerConfig;
};

export function startSynthesizer(context = new AudioContext()): Synthesizer {
    const compressorNode = new DynamicsCompressorNode(context);
    compressorNode.connect(context.destination);

    const config: SynthesizerConfig = {
        maxGain: 0.4,
        numOscillators: 3,
        oscillatorType: 'sine',
        overtoneType: 'none',
        overtoneAmplitude: 'constant',
        drawbars: {
            subFundamental: 0,
            subThird: 0,
            fundamental: 8,
            second: 0,
            third: 0,
            fourth: 0,
            fifth: 0,
            sixth: 0,
            eighth: 0,
        },
        detuneMultiplier: 10,
        attackSeconds: 0.015,
        decaySeconds: 0.3,
        sustainLevel: 0.5,
        releaseSeconds: 0.5,
        compressor: compressorNode,
    };

    const statusByKey: KeyStatus[] = Array.from({ length: 128 }, () => ({
        pressed: false,
        gainNode: null,
        oscillators: [],
    }));
    let sustainPedalValue = 0;

    return {
        keyPressed: (note: number) => {
            if (!statusByKey[note].pressed) {
                statusByKey[note].pressed = true;

                if (!statusByKey[note].gainNode) {
                    statusByKey[note] = {
                        ...statusByKey[note],
                        ...startOscillators(
                            config,
                            context,
                            compressorNode,
                            keyToFrequency(note)
                        ),
                    };
                }
            }
        },
        keyReleased: (note: number) => {
            const status = statusByKey[note];
            if (status.pressed) {
                status.pressed = false;
                if (sustainPedalValue === 0) {
                    stopOscillators(config, context, status);
                }
            }
        },
        pedalPressed: (pedal: PedalType, value: number) => {
            if (pedal === 'sustain') {
                console.log('sustain', value);
                sustainPedalValue = value;

                // when releasing the pedal, adjust gain of all active notes (where pressed = false)
                statusByKey.forEach((status) => {
                    if (!status.pressed && status.gainNode) {
                        if (value === 0) {
                            stopOscillators(config, context, status);
                        } else {
                            setGainForSustainedNote(
                                status.gainNode,
                                context,
                                value,
                                config
                            );
                        }
                    }
                });
            }
        },
        config,
    };
}

type KeyStatus = {
    pressed: boolean;
    gainNode: GainNode | null;
    oscillators: OscillatorNode[];
};

/** convert MIDI key (0..127) to frequency (equal temperament) */
export function keyToFrequency(key: number): number {
    const referenceFrequency = 440; // frequency of A4
    const referenceKey = 69; // key number of A4
    return referenceFrequency * Math.pow(2, (key - referenceKey) / 12);
}

function startOscillators(
    config: SynthesizerConfig,
    context: AudioContext,
    destination: AudioNode,
    frequency: number
) {
    const gainNode = context.createGain();
    const numOscillators =
        config.overtoneType === 'drawbars' ? 9 : config.numOscillators;
    const oscillators: OscillatorNode[] = [];
    for (let i = 0; i < numOscillators; i++) {
        const gain = getGain(config, i);
        if (gain === 0) {
            continue;
        }
        const oscillator = context.createOscillator();
        oscillator.type = config.oscillatorType;
        oscillator.frequency.value = getFrequency(config, frequency, i);

        if (config.detuneMultiplier !== 0) {
            oscillator.detune.value = Math.sqrt(i) * config.detuneMultiplier;
        }

        if (gain !== 1) {
            const overtoneGain = context.createGain();
            overtoneGain.gain.value = gain;

            oscillator.connect(overtoneGain).connect(gainNode);
        } else {
            oscillator.connect(gainNode);
        }
        oscillators.push(oscillator);
    }

    gainNode.connect(destination);

    gainNode.gain.setValueAtTime(0, context.currentTime); //avoid popping sound
    const maxLevel = config.maxGain / oscillators.length;
    gainNode.gain.linearRampToValueAtTime(
        maxLevel,
        context.currentTime + config.attackSeconds
    );
    if (config.sustainLevel < 1) {
        gainNode.gain.exponentialRampToValueAtTime(
            config.sustainLevel * maxLevel || silenceGain,
            context.currentTime + config.attackSeconds + config.decaySeconds
        );
    }

    oscillators.forEach((oscillator) => oscillator.start());
    return {
        gainNode,
        oscillators,
    };
}

function getFrequency(config: SynthesizerConfig, baseFreq: number, i: number) {
    if (config.overtoneType === 'harmonic') {
        return baseFreq * (i + 1);
    } else if (config.overtoneType === 'octaves') {
        return baseFreq * Math.pow(2, i);
    } else if (config.overtoneType === 'drawbars') {
        switch (i) {
            case 0: // sub-fundamental (16')
                return baseFreq / 2;
            case 1: // sub-third (5 1/3')
                return (baseFreq * 3) / 2;
            case 2: // fundamental (8')
                return baseFreq;
            case 3: // second (4')
                return baseFreq * 2;
            case 4: // third (2 2/3')
                return baseFreq * 3;
            case 5: // fourth (2')
                return baseFreq * 4;
            case 6: // fifth (1 3/5')
                return baseFreq * 5;
            case 7: // sixth (1 1/3')
                return baseFreq * 6;
            case 8: // eighth (1')
                return baseFreq * 8;
            default:
                throw new Error('Invalid drawbar index: ' + i);
        }
    } else {
        return baseFreq;
    }
}

function getGain(config: SynthesizerConfig, i: number): number {
    if (config.overtoneType === 'drawbars') {
        switch (i) {
            case 0:
                return config.drawbars.subFundamental / 8;
            case 1:
                return config.drawbars.subThird / 8;
            case 2:
                return config.drawbars.fundamental / 8;
            case 3:
                return config.drawbars.second / 8;
            case 4:
                return config.drawbars.third / 8;
            case 5:
                return config.drawbars.fourth / 8;
            case 6:
                return config.drawbars.fifth / 8;
            case 7:
                return config.drawbars.sixth / 8;
            case 8:
                return config.drawbars.eighth / 8;
            default:
                throw new Error('Invalid drawbar index: ' + i);
        }
    } else if (i > 0 && config.overtoneAmplitude !== 'constant') {
        return 1 / (i + 1);
    } else {
        return 1;
    }
}

function stopOscillators(
    config: SynthesizerConfig,
    context: AudioContext,
    status: KeyStatus
) {
    const endTime = context.currentTime + config.releaseSeconds;
    if (status.gainNode) {
        status.gainNode.gain.cancelScheduledValues(0);
        const currentGain = Math.max(status.gainNode.gain.value, silenceGain);
        status.gainNode.gain.setValueAtTime(currentGain, context.currentTime);
        status.gainNode.gain.exponentialRampToValueAtTime(silenceGain, endTime);
        status.gainNode = null;
    }
    status.oscillators.forEach((oscillator) => oscillator.stop(endTime));
    status.oscillators = [];
}

function setGainForSustainedNote(
    gainNode: GainNode,
    context: AudioContext,
    sustainValue: number, // in (0, 1]
    config: SynthesizerConfig
) {
    gainNode.gain.cancelScheduledValues(0);
    const currentGain = Math.max(gainNode.gain.value, silenceGain);
    gainNode.gain.setValueAtTime(currentGain, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
        currentGain * sustainValue,
        context.currentTime + config.releaseSeconds //TODO check if the time scale is what I want
    );
}
