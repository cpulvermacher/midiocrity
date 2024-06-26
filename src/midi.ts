export type StartMidiArgs = {
    // key is a number from 0 to 127, with 60 being C4, velocity is a number from 0 to 127
    onKeyPressed: (key: number, velocity: number) => void;
    onKeyReleased: (key: number) => void;
    onPedalPressed?: (pedal: PedalType, value: number) => void;
    onPedalReleased?: (pedal: PedalType, value: number) => void;
    onInit: () => void;
    onInitFailure: (reason: 'unsupported' | 'nopermissions') => void;
};

export type PedalType = 'soft' | 'sostenuto' | 'sustain';

export type MidiStatus = {
    connectedInputPorts: string[];
    activeInputChannels: ActiveChannels;
};

// for each MIDI channel from 1 to 16, stores whether messages were received or not
export type ActiveChannels = { [key: number]: boolean };

export function startMIDI(args: StartMidiArgs) {
    const status: MidiStatus = {
        connectedInputPorts: [],
        activeInputChannels: {},
    };
    for (let i = 1; i <= 16; i++) {
        status.activeInputChannels[i] = false;
    }
    let access: MIDIAccess | null = null;

    if (navigator['requestMIDIAccess']) {
        navigator.requestMIDIAccess().then(
            (midiAccess) => {
                onSuccess(midiAccess, args, status);
                access = midiAccess;
                args.onInit();
            },
            () => args.onInitFailure('nopermissions')
        );
    } else {
        args.onInitFailure('unsupported');
    }

    return {
        status,
        sendKeyPress: (key: number) =>
            access?.outputs.forEach((port) =>
                port.send([0x90, key, 0.5 * 127])
            ),
        sendKeyRelease: (key: number) =>
            access?.outputs.forEach((port) =>
                port.send([0x80, key, 0.5 * 127])
            ),
    };
}

function onSuccess(
    midiAccess: MIDIAccess,
    args: StartMidiArgs,
    status: MidiStatus
) {
    const inputs = midiAccess.inputs;

    function onMidiMessage(message: Event) {
        return processMessage(message, args, status.activeInputChannels);
    }
    // Attach MIDI event "midimessage" to each input
    inputs.forEach(function (input) {
        input.onmidimessage = onMidiMessage;
    });

    midiAccess.onstatechange = function (event: Event) {
        const midiEvent = event as MIDIConnectionEvent;
        if (midiEvent.port?.type !== 'input') {
            return;
        }
        const port = midiEvent.port as MIDIInput;
        const name = port.name ?? port.id;
        if (port.state === 'connected') {
            port.onmidimessage = onMidiMessage;
            status.connectedInputPorts.push(name);
        } else {
            port.onmidimessage = null;
            status.connectedInputPorts = status.connectedInputPorts.filter(
                (portName) => portName !== name
            );
        }
    };
}

function processMessage(
    message: Event,
    args: StartMidiArgs,
    activeChannels: ActiveChannels
) {
    if (!('data' in message)) {
        return;
    }
    // parse midi message, see
    // https://www.midi.org/specifications-old/item/table-1-summary-of-midi-message
    const data = message.data as Uint8Array;
    const command = data[0] >> 4; //get first 4 bits
    const statusLowBits = data[0] & 0x0f; // get last 4 bits

    if (command === 8 || command === 9) {
        // note off / note on
        const channel = statusLowBits + 1;
        const note = data[1];
        const velocity = data[2];
        activeChannels[channel] = true;

        if (command === 8 || velocity === 0) {
            args.onKeyReleased(note);
        } else if (command === 9) {
            args.onKeyPressed(note, velocity);
        }
    } else if (command === 11) {
        // control mode / control change (includes pedals)
        // https://www.midi.org/specifications-old/item/table-3-control-change-messages-data-bytes-2
        const controllerNo = data[1];
        const controllerValue = data[2];

        // control change messages
        if (controllerNo < 120) {
            const channel = statusLowBits + 1;
            activeChannels[channel] = true;
            let pedal: PedalType;
            if (controllerNo === 64) {
                pedal = 'sustain';
            } else if (controllerNo === 66) {
                pedal = 'sostenuto';
            } else if (controllerNo === 67) {
                pedal = 'soft';
            } else {
                return;
            }

            const pedalThreshold = 64;
            if (controllerValue >= pedalThreshold) {
                args.onPedalPressed?.(pedal, controllerValue);
            } else {
                args.onPedalReleased?.(pedal, controllerValue);
            }
            //120-127 are reserved for control mode messages
        } else if (controllerNo === 121 && controllerValue === 0) {
            // reset all controllers
            console.debug(
                'Received all controllers off message on channel',
                statusLowBits + 1
            );
        } else if (controllerNo === 123 && controllerValue === 0) {
            // all notes off
            console.debug(
                'Received all notes off message on channel',
                statusLowBits + 1
            );
        } else {
            console.debug(
                `Received unknown control mode MIDI message: ${command} ${statusLowBits} ${controllerNo} ${controllerValue}`
            );
        }
    } else {
        console.debug(
            `Received unknown MIDI message: ${command} ${statusLowBits} ${data} -`
        );
    }
}
