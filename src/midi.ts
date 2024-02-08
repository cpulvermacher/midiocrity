// See the following for detailed description of fields
// https://www.midi.org/specifications-old/item/table-1-summary-of-midi-message

type StartMidiArgs = {
    // key is a number from 0 to 127, with 60 being C4
    onKeyPressed: (key: number, velocity: number) => void;
    onKeyReleased: (key: number) => void;
};

export function startMIDI(args: StartMidiArgs) {
    if (!('requestMIDIAccess' in navigator)) {
        console.log('WebMIDI is not supported in this browser.');
        return;
    }

    function onMIDISuccess(midiAccess: MIDIAccess) {
        const inputs = midiAccess.inputs;

        // Attach MIDI event "midimessage" to each input
        inputs.forEach(function (input) {
            console.log('Found MIDI input:', input.name, ", state: ", input.state);
            input.onmidimessage = onMIDIMessage;
        });

        midiAccess.onstatechange = function (event: Event) {
            const midiEvent = event as MIDIConnectionEvent;
            if (midiEvent.port.type !== 'input') {
                return;
            }
            const port = midiEvent.port as MIDIInput;
            console.log('MIDI state change:', port.name, ", state: ", port.state);
            if (port.state === 'connected') {
                port.onmidimessage = onMIDIMessage;
            } else {
                port.onmidimessage = null;
            }
        };
    }

    function onMIDIMessage(message: Event) {
        if (!("data" in message)) {
            return;
        }
        // parse midi message
        const data = message.data as Uint8Array;
        const command = data[0] >> 4; //get first 4 bits
        const channel = data[0] & 0x0F; // get last 4 bits
        const note = data[1];
        const velocity = data[2];

        if (command === 9 && typeof note === 'number' && typeof velocity === 'number') {
            if (velocity === 0) {
                args.onKeyReleased(note);
            } else {
                args.onKeyPressed(note, velocity);
            }

        } else if (command === 8 && typeof note === 'number') {
            args.onKeyReleased(note);
        } else {
            console.log("other midi msg", command, channel, note);
        }
    }

    navigator.requestMIDIAccess()
        .then(onMIDISuccess, onMIDIFailure);
}

function onMIDIFailure() {
    console.log('Could not access your MIDI devices.');
}
