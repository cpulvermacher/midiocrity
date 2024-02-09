// See the following for detailed description of fields
// https://www.midi.org/specifications-old/item/table-1-summary-of-midi-message


type StartMidiArgs = {
    // key is a number from 0 to 127, with 60 being C4
    onKeyPressed: (key: number, velocity: number) => void;
    onKeyReleased: (key: number) => void;
};

// for each MIDI channel from 1 to 16, stores whether messages were received or not
type ActiveChannels = { [key: number]: boolean; };


export function startMIDI(args: StartMidiArgs) {
    if (!('requestMIDIAccess' in navigator)) {
        console.log('WebMIDI is not supported in this browser.');
        return;
    }

    const activeChannels: ActiveChannels = {};

    navigator.requestMIDIAccess()
        .then((midiAccess) => onSuccess(midiAccess, args, activeChannels))
        .catch(onFailure);

    return { activeChannels };
}

function onFailure() {
    console.log('Could not access your MIDI devices.');
}

function onSuccess(midiAccess: MIDIAccess, args: StartMidiArgs, activeChannels: ActiveChannels) {
    const inputs = midiAccess.inputs;

    const onMidiMessage = (message: Event) => processMessage(message, args, activeChannels);
    // Attach MIDI event "midimessage" to each input
    inputs.forEach(function (input) {
        console.log('Found MIDI input:', input.name, ", state: ", input.state);
        input.onmidimessage = onMidiMessage;
    });

    midiAccess.onstatechange = function (event: Event) {
        const midiEvent = event as MIDIConnectionEvent;
        if (midiEvent.port.type !== 'input') {
            return;
        }
        const port = midiEvent.port as MIDIInput;
        console.log('MIDI state change:', port.name, ", state: ", port.state);
        if (port.state === 'connected') {
            port.onmidimessage = onMidiMessage;
        } else {
            port.onmidimessage = null;
        }
    };
}

function processMessage(message: Event, args: StartMidiArgs, activeChannels: ActiveChannels) {
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
        activeChannels[channel] = true;
        if (velocity === 0) {
            args.onKeyReleased(note);
        } else {
            args.onKeyPressed(note, velocity);
        }

    } else if (command === 8 && typeof note === 'number') {
        activeChannels[channel] = true;
        args.onKeyReleased(note);
    } else {
        console.log("other midi msg", command, channel, note);
    }
}
