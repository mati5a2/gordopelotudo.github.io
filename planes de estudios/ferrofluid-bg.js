(function () {
  const canvas = document.getElementById('ferrofluid-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let animationFrame = null;
  let pointer = { x: 0.5, y: 0.5, active: false };

  const blobs = Array.from({ length: 6 }, (_, index) => ({
    seed: index * 0.9,
    x: 0.2 + (index % 3) * 0.25,
    y: 0.2 + Math.floor(index / 3) * 0.3,
    size: 0.22 + (index % 4) * 0.05,
    hue: index
  }));

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onPointerMove(event) {
    pointer.active = true;
    pointer.x = event.clientX / Math.max(width, 1);
    pointer.y = event.clientY / Math.max(height, 1);
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  function render(currentTime) {
    ctx.clearRect(0, 0, width, height);

    const t = currentTime * 0.00045;
    const mouseForceX = pointer.active ? (pointer.x - 0.5) * 70 : 0;
    const mouseForceY = pointer.active ? (pointer.y - 0.5) * 70 : 0;

    ctx.globalCompositeOperation = 'screen';

    blobs.forEach((blob, index) => {
      const orbitX = width * (blob.x + Math.sin(t * 1.2 + blob.seed) * 0.04 + (mouseForceX / width) * 0.22);
      const orbitY = height * (blob.y + Math.cos(t * 1.0 + blob.seed * 1.2) * 0.045 + (mouseForceY / height) * 0.22);
      const radius = Math.min(width, height) * (0.2 + blob.size * 0.16 + Math.sin(t * 0.8 + blob.seed) * 0.02);

      const gradient = ctx.createRadialGradient(orbitX, orbitY, 0, orbitX, orbitY, radius);
      const alphaBase = index === 0 || index === 2 ? 0.42 : 0.26;
      const colors = [
        ['rgba(255,255,255,0.52)', 'rgba(96,165,250,0.38)', 'rgba(0,0,0,0)'],
        ['rgba(255,255,255,0.44)', 'rgba(79,70,229,0.34)', 'rgba(0,0,0,0)'],
        ['rgba(255,255,255,0.38)', 'rgba(45,212,191,0.28)', 'rgba(0,0,0,0)'],
        ['rgba(255,255,255,0.36)', 'rgba(96,165,250,0.26)', 'rgba(0,0,0,0)']
      ][index % 4];

      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(alphaBase, colors[1]);
      gradient.addColorStop(1, colors[2]);

      ctx.filter = 'blur(70px)';
      ctx.beginPath();
      ctx.arc(orbitX, orbitY, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    });

    ctx.filter = 'blur(0px)';
    ctx.globalCompositeOperation = 'overlay';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.2;

    for (let i = 0; i < 3; i += 1) {
      const offset = i * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, height * (0.3 + offset));
      ctx.quadraticCurveTo(width * (0.3 + Math.sin(t + i) * 0.1), height * (0.5 + Math.cos(t * 0.7 + i) * 0.1), width, height * (0.2 + offset));
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(2, 6, 23, 0.12)';
    ctx.fillRect(0, 0, width, height);

    animationFrame = window.requestAnimationFrame(render);
  }

  function start() {
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);
    animationFrame = window.requestAnimationFrame(render);
  }

  start();
})();
