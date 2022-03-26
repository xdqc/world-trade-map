import {
  promises as fs
} from 'fs';
import {
  DOMParser
} from 'xmldom';
import canvas from 'canvas';
import fetch from 'node-fetch';
import Canvg, { presets } from 'canvg';

const preset = presets.node({
  DOMParser,
  canvas,
  fetch,
});
preset.ignoreDimensions = true;
preset.scaleWidth = 30000;
preset.scaleHeight = 10000;
// preset.offsetX = -15000;

const { registerFont } = canvas;
registerFont('./Arial.ttf', { family: 'Arial' });

(async (output, input) => {
  const svg = await fs.readFile(input, 'utf8');
  const canvas1 = preset.createCanvas(preset.scaleWidth, preset.scaleHeight);
  const ctx = canvas1.getContext('2d');
  ctx.font = '"Arial"';
  const v = Canvg.fromString(ctx, svg, preset);

  // Render only first frame, ignoring animations.
  await v.render();
  console.log(canvas1)
  const png = canvas1.toBuffer('image/png');

  await fs.writeFile(output, png);
})(
  process.argv.pop(),
  process.argv.pop()
);