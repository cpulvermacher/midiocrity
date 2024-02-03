import { startMIDI } from './midi';
import { Piano } from './piano';

const numKeys = 88;


const piano = Piano(numKeys);
piano.animate();

startMIDI({
  onKey: (key, velocity) => {
    piano.lightUpKey(key - 12 * 2);
  }
});

// play random note every second
// setInterval(() => {
//   piano.lightUpKey(Math.floor(Math.random() * numKeys));
// }, 1000);