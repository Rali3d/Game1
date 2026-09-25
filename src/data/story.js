export const INTRO_LINES = [
  'Grass.',
  'The smell of it, sharp and green.',
  'Wind moving over you like a slow hand.',
  "You don't remember lying down.",
  "You don't remember anything at all.",
];

export const LETTER = {
  kind: 'Found',
  title: 'A Torn Letter',
  body: `<p><i>— if you are reading this, then the crossing worked, and you have already begun to forget. That was always the price. I'm sorry I couldn't tell you more before.</i></p>
<p><i>You will want to go back. Don't. Find the pieces, and find the stones, and whatever you do, do not trust the man in grey who</i></p>
<p class="muted">The rest of the page is torn away.</p>`,
};

// Shown in the order shards are found, not tied to a particular shard.
export const SHARD_MEMORIES = [
  {
    title: 'A Tower of Black Glass',
    body: `<p>An endless stair, and a hand gripping yours, pulling you upward. Your lungs burn.</p>
<p>"Hurry," someone whispers. "They're already inside."</p>`,
  },
  {
    title: 'Rain on a Training Yard',
    body: `<p>A sword too heavy for your arms. Mud to your ankles. You fall, and get up, and fall.</p>
<p>A voice, not unkind: "You'll learn. You'll have to."</p>`,
  },
  {
    title: 'The Burning Circle',
    body: `<p>A ring of standing stones, blazing white. Wind that smells of lightning.</p>
<p>You step into the light, and you are not afraid. <b>You chose this.</b></p>`,
  },
];

export const STONES_REVEAL = {
  kind: 'Memory',
  title: 'The Circle Remembers',
  body: `<p>The altar is warm beneath your palm. One by one the stones wake, humming, and the last memory settles into place like a key turning in a lock.</p>
<p>Your name is <b>Aren</b>.</p>
<p>You came to this meadow to forget something. And something, somewhere, is still looking for you.</p>`,
};

export const CHAPTER_END = {
  kind: 'Chapter I',
  title: 'The Fieldborn',
  body: `<p>You know your name now. It isn't everything, but it's a place to stand.</p>
<p class="muted">The world is still open. Oswin may have more to say, the pinewoods are full of wolves, and the night sky is worth a look.</p>`,
};
