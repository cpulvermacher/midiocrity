const silenceGain = 0.0001; // avoid zero for exponential ramp

export type OvertoneType = 'none' | 'harmonic' | 'octaves';

export type OvertoneAmplitude = 'constant' | '1/n';

export type SynthesizerConfig = {
    maxGain: number;
    oscillatorType: OscillatorType;
    numOscillators: number;
    overtoneType: OvertoneType;
    overtoneAmplitude: OvertoneAmplitude;
    detuneMultiplier: number;
    attackSeconds: number;
    decaySeconds: number;
    sustainLevel: number;
    releaseSeconds: number;
    compressor: DynamicsCompressorNode;
};

export type Synthesizer = {
    keyPressed: (note: number) => void;
    keyReleased: (note: number) => void;
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
        detuneMultiplier: 10,
        attackSeconds: 0.015,
        decaySeconds: 0.3,
        sustainLevel: 0.5,
        releaseSeconds: 0.5,
        compressor: compressorNode,
    };

    const oscillatorsByKey: (KeyOscillator | null)[] = Array.from(
        { length: 128 },
        () => null
    );

    return {
        keyPressed: (note: number) => {
            if (oscillatorsByKey[note] === null) {
                oscillatorsByKey[note] = startOscillators(
                    config,
                    context,
                    compressorNode,
                    keyToFrequency(note)
                );
            }
        },
        keyReleased: (note: number) => {
            const oscillator = oscillatorsByKey[note];
            if (oscillator !== null) {
                stopOscillators(config, context, oscillator);
                oscillatorsByKey[note] = null;
            }
        },
        config,
    };
}

type KeyOscillator = {
    gainNode: GainNode;
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
): KeyOscillator {
    const gainNode = context.createGain();
    const oscillators = Array.from(
        { length: config.numOscillators },
        (_, i) => {
            const oscillator = context.createOscillator();
            oscillator.type = config.oscillatorType;
            if (config.overtoneType === 'harmonic') {
                oscillator.frequency.value = frequency * (i + 1);
            } else if (config.overtoneType === 'octaves') {
                oscillator.frequency.value = frequency * Math.pow(2, i);
            } else {
                oscillator.frequency.value = frequency;
            }

            if (config.detuneMultiplier !== 0) {
                oscillator.detune.value =
                    Math.sqrt(i) * config.detuneMultiplier;
            }

            if (i > 0 && config.overtoneAmplitude !== 'constant') {
                const gain = 1 / (i + 1);
                const overtoneGain = context.createGain();
                overtoneGain.gain.value = gain;

                oscillator.connect(overtoneGain).connect(gainNode);
            } else {
                oscillator.connect(gainNode);
            }
            return oscillator;
        }
    );

    gainNode.connect(destination);

    gainNode.gain.setValueAtTime(0, context.currentTime); //avoid popping sound
    const maxLevel = config.maxGain / config.numOscillators;
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

function stopOscillators(
    config: SynthesizerConfig,
    context: AudioContext,
    oscillator: KeyOscillator
) {
    const endTime = context.currentTime + config.releaseSeconds;
    oscillator.gainNode.gain.cancelScheduledValues(0);
    const currentValue = Math.max(oscillator.gainNode.gain.value, silenceGain);
    oscillator.gainNode.gain.setValueAtTime(currentValue, context.currentTime);
    oscillator.gainNode.gain.exponentialRampToValueAtTime(silenceGain, endTime);
    oscillator.oscillators.forEach((oscillator) => oscillator.stop(endTime));
}
