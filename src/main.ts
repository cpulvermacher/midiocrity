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

// demo mode: play random notes
let demoLoop: number | null = null;
window.addEventListener('keydown', function (event) {
  if (event.key === 'd') {
    if (demoLoop !== null) {
      clearInterval(demoLoop);
      demoLoop = null;
    } else {
      demoLoop = setInterval(
        () => {
          const key = Math.floor(Math.random() * numKeys);
          piano.keyPressed(key, 0.5);
          setTimeout(() => piano.keyReleased(key), 3000);
        }, 500);
    }
  }
});