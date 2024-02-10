import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startMIDI } from '../midi';

describe('startMIDI', () => {
    const args = { onKeyPressed: vi.fn(), onKeyReleased: vi.fn(), onInitFailure: vi.fn() };

    beforeEach(() => {
        navigator = { requestMIDIAccess: vi.fn(), } as unknown as Navigator;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls onInitFailure if WebMIDI is not available', () => {
        (vi.mocked(navigator).requestMIDIAccess as unknown as undefined) = undefined;

        startMIDI(args);

        expect(args.onInitFailure).toHaveBeenCalledWith('unsupported');
    });

    it('calls onInitFailure if requestMIDIAccess rejects', async () => {
        vi.mocked(navigator).requestMIDIAccess.mockRejectedValue(new Error('Failed to access'));

        startMIDI(args);

        expect(vi.mocked(navigator).requestMIDIAccess).toHaveBeenCalled();

        await vi.waitFor(() =>
            expect(args.onInitFailure).toHaveBeenCalledWith('nopermissions')
        );
    });

    it('should return active channels object', () => {
        vi.mocked(navigator).requestMIDIAccess.mockResolvedValue({
            inputs: {
                forEach: vi.fn()
            }
        } as unknown as MIDIAccess
        );


        const returnValue = startMIDI(args);

        expect(returnValue).toHaveProperty('activeChannels');
        expect(typeof returnValue!.activeChannels).toBe('object');
    });

    it('should attach onMidiMessage to each input', async () => {
        const midiInputs = [
            { name: 'input1', state: 'connected', onmidimessage: null },
            { name: 'input2', state: 'connected', onmidimessage: null },
        ];
        const midiAccess = {
            inputs: midiInputs,
            onstatechange: vi.fn()
        } as unknown as MIDIAccess;

        vi.mocked(navigator).requestMIDIAccess.mockResolvedValue(midiAccess);

        startMIDI(args);

        await vi.waitFor(() => {
            expect(midiInputs[0].onmidimessage).toBeDefined();
            expect(midiInputs[1].onmidimessage).toBeDefined();
        });
    });

    it('should attach/detach onMidiMessage to connected/disconnected inputs', async () => {
        const midiAccess = {
            inputs: [],
            onstatechange: null
        } as unknown as MIDIAccess;

        vi.mocked(navigator).requestMIDIAccess.mockResolvedValue(midiAccess);

        startMIDI(args);
        await vi.waitFor(() => {
            expect(midiAccess.onstatechange).toBeTruthy();
        });

        //connect port
        const midiInput = { name: 'input1', type: 'input', state: 'connected', onmidimessage: null };
        midiAccess.onstatechange!({ port: midiInput } as unknown as MIDIConnectionEvent);

        await vi.waitFor(() => {
            expect(midiInput.onmidimessage).toBeTruthy();
        });

        //disconnect port
        midiInput.state = 'disconnected';
        midiAccess.onstatechange!({ port: midiInput } as unknown as MIDIConnectionEvent);

        await vi.waitFor(() => {
            expect(midiInput.onmidimessage).toBeNull();
        });
    });

    describe('parses MIDI messages', () => {

        //setup some shared ports
        const midiInputs = [
            { name: 'input1', state: 'connected', onmidimessage: null },
            { name: 'input2', state: 'connected', onmidimessage: null },
        ] as MIDIInput[];
        beforeEach(async () => {
            const midiAccess = {
                inputs: midiInputs,
                onstatechange: vi.fn()
            } as unknown as MIDIAccess;
            vi.mocked(navigator).requestMIDIAccess.mockResolvedValue(midiAccess);
            startMIDI(args);

            await vi.waitFor(() => {
                expect(midiInputs[0].onmidimessage).toBeDefined();
                expect(midiInputs[1].onmidimessage).toBeDefined();
            });
        });

        [0, 1].forEach((port) => {
            it(`should call onKeyPressed when a note is pressed (port ${port})`, () => {
                const message = { data: [0x90, 60, 100] };
                midiInputs[0].onmidimessage!(message as unknown as Event);

                expect(args.onKeyPressed).toHaveBeenCalledWith(60, 100);
            });

            it(`should call onKeyReleased when a note is released (port ${port})`, () => {
                const message = { data: [0x80, 60, 100] };
                midiInputs[0].onmidimessage!(message as unknown as Event);

                expect(args.onKeyReleased).toHaveBeenCalledWith(60);
            });
        });
    });
});
