import { Game } from './Game.js';

try {
  window.game = new Game(); // exposed for debugging from the console
} catch (err) {
  console.error(err);
  document.getElementById('boot-error').textContent = `Failed to start: ${err.message}`;
  document.getElementById('boot-error').classList.remove('hidden');
}
