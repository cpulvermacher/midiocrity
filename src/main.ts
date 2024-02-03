import { Piano } from './piano';

const numKeys = 88;

const piano = Piano(numKeys);
piano.animate();

// play random note every second
setInterval(() => {
  piano.lightUpKey(Math.floor(Math.random() * numKeys));
}, 1000);