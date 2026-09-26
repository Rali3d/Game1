import { Assets } from './engine/Assets.js';
import { Game } from './Game.js';

const bar = document.querySelector('#loading .fill');
const label = document.querySelector('#loading .what');

try {
  await Assets.load((progress, path) => {
    bar.style.width = `${Math.round(progress * 100)}%`;
    label.textContent = path.split('/').pop().replace(/\.(gltf|glb)$/, '').replace(/_/g, ' ');
  });
  document.getElementById('loading').remove();
  window.game = new Game(); // exposed for debugging from the console
} catch (err) {
  console.error(err);
  document.getElementById('boot-error').textContent = `Failed to start: ${err.message}`;
  document.getElementById('boot-error').classList.remove('hidden');
}
