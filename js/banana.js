/* ==================================================================
   Floating 3D banana.

   The mesh is generated in code — no .glb to download. A circular
   cross-section is swept along a curved spine, the radius tapers to a
   point at both ends, and a 3-lobe modulation gives the slightly
   triangular profile a real banana has. Vertex colours darken the tips.

   Interaction:  tilts toward the pointer, spins a full 360 deg on click,
                 drifts gently when idle.
   Fallback:     if three.js does not load, .is-fallback reveals a flat SVG.
================================================================== */
(function () {
  'use strict';

  var host = document.getElementById('banana');
  if (!host) return;

  if (typeof window.THREE === 'undefined') {   /* CDN blocked or offline */
    host.classList.add('is-fallback');
    return;
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- geometry ---------------- */
  function bananaGeometry() {
    var SEG = 160, RING = 36;
    var pos = [], col = [], idx = [];
    var BEND = Math.PI * 0.62;      /* sweep of the spine — gentler than a boomerang */
    var ARC  = 2.15;                /* spine radius                                  */
    var R    = 0.56;                /* max body radius                               */
    /* Arc length ~4.2 against a ~1.1 diameter puts this near the 4:1 of a real
       banana. The earlier 6.9:1 is what read as a boomerang. */

    var bodyC = new THREE.Color(0xF5CE22);
    var tipC  = new THREE.Color(0x4A3A16);

    for (var i = 0; i <= SEG; i++) {
      var t = i / SEG;
      var a = (t - 0.5) * BEND;
      var cx = Math.sin(a) * ARC;
      var cy = Math.cos(a) * ARC - ARC;

      /* in-plane normal of the spine (spine is planar, so z is the binormal) */
      var nx = Math.sin(a + Math.PI / 2);
      var ny = Math.cos(a + Math.PI / 2);

      /* Stays near full thickness across the middle and only pinches close to
         the ends, instead of tapering from the centre the whole way out. */
      var s = Math.abs(2 * t - 1);
      var r = R * Math.pow(Math.max(1 - Math.pow(s, 2.6), 0), 0.62);
      r *= 1 + 0.10 * (0.5 - t);                   /* stem end slightly slimmer */

      /* darken the last few percent at each end */
      var tipMix = 0;
      if (t < 0.05) tipMix = 1 - t / 0.05;
      else if (t > 0.95) tipMix = (t - 0.95) / 0.05;
      var c = bodyC.clone().lerp(tipC, Math.min(tipMix, 1));

      for (var j = 0; j <= RING; j++) {
        var v = j / RING * Math.PI * 2;
        var lobe = 1 + 0.075 * Math.cos(5 * v);    /* the soft pentagonal section */
        var rr = r * lobe;
        pos.push(
          cx + nx * Math.cos(v) * rr,
          cy + ny * Math.cos(v) * rr,
          Math.sin(v) * rr
        );
        col.push(c.r, c.g, c.b);
      }
    }
    for (var s = 0; s < SEG; s++) {
      for (var k = 0; k < RING; k++) {
        var A = s * (RING + 1) + k, B = A + RING + 1, C = A + 1, D = B + 1;
        idx.push(A, B, C, C, B, D);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    g.center();
    return g;
  }

  /* ---------------- scene ---------------- */
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 6.9);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.insertBefore(renderer.domElement, host.firstChild);

  var mesh = new THREE.Mesh(
    bananaGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.44, metalness: 0.06 })
  );
  /* Stand it up on a diagonal so it reads as a banana at a glance */
  mesh.rotation.z = -0.55;
  var pivot = new THREE.Group();
  pivot.add(mesh);
  scene.add(pivot);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 6, 6);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xD9FF00, 1.15);   /* accent rim light */
  rim.position.set(-6, -2, -4);
  scene.add(rim);
  var fill = new THREE.DirectionalLight(0x6FA0B0, 0.6);
  fill.position.set(-4, 3, 5);
  scene.add(fill);

  function resize() {
    var w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  /* ---------------- interaction ---------------- */
  var targetX = 0, targetY = 0;     /* pointer-driven tilt   */
  var curX = 0, curY = 0;
  var spin = 0, spinTo = 0;         /* click spin            */
  var t0 = performance.now();

  window.addEventListener('mousemove', function (e) {
    /* Normalised to the viewport so the banana reacts across the whole hero */
    var nx = (e.clientX / window.innerWidth) * 2 - 1;
    var ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetY = nx * 0.75;
    targetX = ny * 0.55;
  }, { passive: true });

  renderer.domElement.addEventListener('click', function () {
    spinTo += Math.PI * 2;
  });
  host.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spinTo += Math.PI * 2; }
  });

  function frame(now) {
    var t = (now - t0) / 1000;

    curX += (targetX - curX) * 0.055;
    curY += (targetY - curY) * 0.055;
    spin += (spinTo - spin) * 0.075;
    if (Math.abs(spinTo - spin) < 0.001) { spin = spinTo; }

    pivot.rotation.x = curX;
    pivot.rotation.y = curY + spin;

    if (!reduceMotion) {
      pivot.position.y = Math.sin(t * 1.15) * 0.17;          /* float  */
      pivot.rotation.z = Math.sin(t * 0.75) * 0.06;          /* sway   */
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
