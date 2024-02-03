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
            console.log('Attaching MIDI event "midimessage" to input', input);
            input.onmidimessage = onMIDIMessage;
        });
    }

    function onMIDIMessage(message: { data: Uint8Array; }) {
        // parse midi message and get key
        const command = message.data[0];
        const note = message.data[1];
        const velocity = message.data[2];

        if (command === 144 && typeof note === 'number' && typeof velocity === 'number') {
            args.onKeyPressed(note, velocity);
        } else if (command === 128 && typeof note === 'number') {
            args.onKeyReleased(note);
        }
    }

    navigator.requestMIDIAccess()
        .then(onMIDISuccess, onMIDIFailure);
}

function onMIDIFailure() {
    console.log('Could not access your MIDI devices.');
}
