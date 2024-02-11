import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActiveChannels, StartMidiArgs, startMIDI } from '../midi';

describe('startMIDI', () => {
    const args: StartMidiArgs = {
        onKeyPressed: vi.fn(),
        onKeyReleased: vi.fn(),
        onInitFailure: vi.fn(),
        onPedalPressed: vi.fn(),
        onPedalReleased: vi.fn()
    };

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

    it('returns active channels object', () => {
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
        let activeChannels: ActiveChannels;

        beforeEach(async () => {
            const midiAccess = {
                inputs: midiInputs,
                onstatechange: vi.fn()
            } as unknown as MIDIAccess;
            vi.mocked(navigator).requestMIDIAccess.mockResolvedValue(midiAccess);
            ({ activeChannels } = startMIDI(args));


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

        [1, 16].forEach((channel) => {
            it(`sends note on messages for channel ${channel}`, () => {
                const message = { data: [0x90 + channel - 1, 60, 100] };
                midiInputs[0].onmidimessage!(message as unknown as Event);
                expect(args.onKeyPressed).toHaveBeenCalledWith(60, 100);

                for (let i = 1; i <= 16; i++) {
                    expect(activeChannels[i], `channel ${i}`).toBe(i === channel);
                }
            });

            it(`sends note off messages for channel ${channel}`, () => {
                const message = { data: [0x80 + channel - 1, 60, 100] };
                midiInputs[0].onmidimessage!(message as unknown as Event);
                expect(args.onKeyReleased).toHaveBeenCalledWith(60);

                for (let i = 1; i <= 16; i++) {
                    expect(activeChannels[i], `channel ${i}`).toBe(i === channel);
                }
            });

            it(`sends sustain pressed messages for channel ${channel}`, () => {
                const message = { data: [0xB0 + channel - 1, 64, 127] };
                midiInputs[0].onmidimessage!(message as unknown as Event);
                expect(args.onPedalPressed).toHaveBeenCalledWith('sustain');

                for (let i = 1; i <= 16; i++) {
                    expect(activeChannels[i], `channel ${i}`).toBe(i === channel);
                }
            });

            it(`sends sustain released messages for channel ${channel}`, () => {
                const message = { data: [0xB0 + channel - 1, 64, 0] };
                midiInputs[0].onmidimessage!(message as unknown as Event);
                expect(args.onPedalReleased).toHaveBeenCalledWith('sustain');

                for (let i = 1; i <= 16; i++) {
                    expect(activeChannels[i], `channel ${i}`).toBe(i === channel);
                }
            });

            it(`sends sostenuto pressed messages for channel ${channel}`, () => {
                const message = { data: [0xB0 + channel - 1, 66, 127] };
                midiInputs[0].onmidimessage!(message as unknown as Event);
                expect(args.onPedalPressed).toHaveBeenCalledWith('sostenuto');

                for (let i = 1; i <= 16; i++) {
                    expect(activeChannels[i], `channel ${i}`).toBe(i === channel);
                }
            });

            it(`sends sostenuto released messages for channel ${channel}`, () => {
                const message = { data: [0xB0 + channel - 1, 66, 0] };
                midiInputs[0].onmidimessage!(message as unknown as Event);
                expect(args.onPedalReleased).toHaveBeenCalledWith('sostenuto');

                for (let i = 1; i <= 16; i++) {
                    expect(activeChannels[i], `channel ${i}`).toBe(i === channel);
                }
            });

            it(`sends soft pedal pressed messages for channel ${channel}`, () => {
                const message = { data: [0xB0 + channel - 1, 67, 127] };
                midiInputs[0].onmidimessage!(message as unknown as Event);
                expect(args.onPedalPressed).toHaveBeenCalledWith('soft');

                for (let i = 1; i <= 16; i++) {
                    expect(activeChannels[i], `channel ${i}`).toBe(i === channel);
                }
            });

            it(`sends soft pedal released messages for channel ${channel}`, () => {
                const message = { data: [0xB0 + channel - 1, 67, 0] };
                midiInputs[0].onmidimessage!(message as unknown as Event);
                expect(args.onPedalReleased).toHaveBeenCalledWith('soft');

                for (let i = 1; i <= 16; i++) {
                    expect(activeChannels[i], `channel ${i}`).toBe(i === channel);
                }
            });

        });
    });
});
