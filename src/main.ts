import { startMIDI } from './midi';
import { Piano } from './piano';

const numKeys = 88;


const piano = Piano(numKeys);
piano.animate();

startMIDI({
  onKeyPressed: (key, velocity) => {
    piano.keyPressed(key - 12 * 2, velocity / 128.0);
  },
  onKeyReleased: (key) => {
    piano.keyReleased(key - 12 * 2);
  }
});

// play random note every second
// setInterval(() => {
//   const key = Math.floor(Math.random() * numKeys);
//   piano.keyPressed(key, 0.5);
//   setTimeout(() => piano.keyReleased(key), 1000);
// }, 1000);