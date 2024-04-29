export type SynthesizerConfig = {
    maxGain: number;
    numOscillators: number;
    oscillatorType: OscillatorType;
    detuneMultiplier: number;
    fadeInTimeSeconds: number;
    fadeOutTimeSeconds: number;
    sustainDurationSeconds: number;
};

export type Synthesizer = {
    keyPressed: (note: number) => void;
    keyReleased: (note: number) => void;
    config: SynthesizerConfig;
};

export function startSynthesizer(context = new AudioContext()): Synthesizer {
    const config: SynthesizerConfig = {
        maxGain: 0.4,
        numOscillators: 3,
        oscillatorType: 'sine',
        detuneMultiplier: 10,
        fadeInTimeSeconds: 0.015,
        fadeOutTimeSeconds: 0.5,
        sustainDurationSeconds: 0,
    };
    const oscillatorsByKey: (KeyOscillator | null)[] = Array.from(
        { length: 128 },
        () => null
    );

    const compressorNode = new DynamicsCompressorNode(context);
    compressorNode.connect(context.destination);

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
            // oscillator.frequency.value = frequency * (i + 1);
            // oscillator.frequency.value = frequency * (1 + 0.001 * i);
            oscillator.frequency.value = frequency;
            oscillator.detune.value = Math.sqrt(i) * config.detuneMultiplier;
            oscillator.connect(gainNode);
            return oscillator;
        }
    );

    gainNode.connect(destination);

    gainNode.gain.setValueAtTime(0, context.currentTime); //avoid popping sound
    gainNode.gain.linearRampToValueAtTime(
        config.maxGain / config.numOscillators,
        context.currentTime + config.fadeInTimeSeconds
    );
    if (config.sustainDurationSeconds > 0) {
        gainNode.gain.exponentialRampToValueAtTime(
            0.001,
            context.currentTime + config.sustainDurationSeconds
        );
    }

    oscillators.forEach((oscillator) => {
        oscillator.start();
    });
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
    const endTime = context.currentTime + config.fadeOutTimeSeconds;
    oscillator.gainNode.gain.cancelScheduledValues(0);
    const currentValue = Math.max(oscillator.gainNode.gain.value, 0.001);
    oscillator.gainNode.gain.setValueAtTime(currentValue, context.currentTime);
    oscillator.gainNode.gain.exponentialRampToValueAtTime(0.001, endTime);
    oscillator.oscillators.forEach((oscillator) => {
        oscillator.stop(endTime);
    });
}
