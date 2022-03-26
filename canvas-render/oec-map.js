
(function () {
  const svg = document.querySelector('svg');
  const canvas = document.querySelector('canvas');
  canvas.width = 30000
  canvas.height = 10000

  const ctx = canvas.getContext('2d');
  
  v = canvg.Canvg.fromString(ctx, svg.outerHTML, {
    ignoreDimensions: true,

    scaleWidth: 30000,
    scaleHeight: 10000, 
  });

  // Start SVG rendering with animations and mouse handling.
  svg.innerHTML = '';
  v.start();
  setTimeout(() => {
    v.stop();
  }, 60000);
})();
