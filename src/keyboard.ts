/** a map of KeyboardEvent.code to a note number
 * Note: KeyboardEvent.code should be layout independent, but isn't on Firefox.
 */
export type KeyMap = {
    [key: string]: number;
};

export function createKeyMap(
    firstBottomKey: number = 36,
    firstTopKey: number = 60
): KeyMap {
    return {
        ...toKeyMap(keysBottom, firstBottomKey),
        ...toKeyMap(keysTop, firstTopKey),
        Space: -1, // sustain
    };
}

function toKeyMap(keys: string[], startValue: number) {
    return keys.reduce((obj, key, index) => {
        obj[key] = startValue + index;
        return obj;
    }, {} as KeyMap);
}

const keysTop = [
    'KeyQ',
    'Digit2',
    'KeyW',
    'Digit3',
    'KeyE',
    'KeyR',
    'Digit5',
    'KeyT',
    'Digit6',
    'KeyY',
    'Digit7',
    'KeyU',
    'KeyI',
    'Digit9',
    'KeyO',
    'Digit0',
    'KeyP',
    'BracketLeft',
];

const keysBottom = [
    'KeyZ',
    'KeyS',
    'KeyX',
    'KeyD',
    'KeyC',
    'KeyV',
    'KeyG',
    'KeyB',
    'KeyH',
    'KeyN',
    'KeyJ',
    'KeyM',
    'Comma',
    'KeyL',
    'Period',
    'Semicolon',
    'Slash',
];

/** for displaying key on piano */
export const codeToCharMap: { [code: string]: string } = {
    BracketLeft: '[',
    Comma: ',',
    Digit0: '0',
    Digit1: '1',
    Digit2: '2',
    Digit3: '3',
    Digit4: '4',
    Digit5: '5',
    Digit6: '6',
    Digit7: '7',
    Digit8: '8',
    Digit9: '9',
    KeyA: 'A',
    KeyB: 'B',
    KeyC: 'C',
    KeyD: 'D',
    KeyE: 'E',
    KeyF: 'F',
    KeyG: 'G',
    KeyH: 'H',
    KeyI: 'I',
    KeyJ: 'J',
    KeyK: 'K',
    KeyL: 'L',
    KeyM: 'M',
    KeyN: 'N',
    KeyO: 'O',
    KeyP: 'P',
    KeyQ: 'Q',
    KeyR: 'R',
    KeyS: 'S',
    KeyT: 'T',
    KeyU: 'U',
    KeyV: 'V',
    KeyW: 'W',
    KeyX: 'X',
    KeyY: 'Y',
    KeyZ: 'Z',
    Period: '.',
    Semicolon: ';',
    ShiftLeft: 'Shift',
    Slash: '/',
};
