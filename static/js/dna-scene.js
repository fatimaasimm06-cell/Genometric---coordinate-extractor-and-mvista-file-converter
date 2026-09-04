/**
 * NEXUS GENOME // 3D WEBGL DNA DOUBLE HELIX & NUCLEOTIDE STREAM
 * Powered by Three.js with custom particle shaders, glowing base pairs & laser scanner
 */

class DnaSceneEngine {
  constructor() {
    this.canvas = document.getElementById('dnaCanvas');
    this.container = document.getElementById('dnaCanvasContainer');
    if (!this.canvas) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.helixGroup = null;
    this.particleSystem = null;
    this.scannerGroup = null;
    this.scannerPos = 0;
    this.scannerDirection = 1;
    this.showScanner = true;
    this.showParticles = true;

    // Track 3D world positions of Gene loci for SVG connector projection
    this.locusPoints = {
      gene1: new THREE.Vector3(),
      gene2: new THREE.Vector3(),
      gene3: new THREE.Vector3()
    };

    this.locusNodes = {
      gene1: null,
      gene2: null,
      gene3: null
    };

    this.rungs = [];
    this.clock = new THREE.Clock();

    this.init();
  }

  init() {
    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b1320, 0.022);

    // 2. Camera Setup (Positioned diagonally to guide the eye)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(12, 4, 38);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.enableZoom = true;
      this.controls.minDistance = 15;
      this.controls.maxDistance = 65;
      this.controls.maxPolarAngle = Math.PI / 1.5;
      this.controls.minPolarAngle = Math.PI / 4;
      this.controls.autoRotate = false;
    }

    // 5. Lighting
    this.setupLighting();

    // 6. Build Double Helix & Nucleotide Rungs
    this.buildDoubleHelix();

    // 7. Build Streaming Nucleotide Particles
    this.buildNucleotideParticleStream();

    // 8. Build Scanner Laser Beam
    this.buildScannerBeam();

    // 9. Resize and Render Loop
    window.addEventListener('resize', () => this.onWindowResize());
    this.animate();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x0b1a30, 1.8);
    this.scene.add(ambientLight);

    // Cyan Key Light
    const cyanLight = new THREE.PointLight(0x00f0ff, 3.5, 80);
    cyanLight.position.set(20, 15, 20);
    this.scene.add(cyanLight);

    // Teal Fill Light
    const tealLight = new THREE.PointLight(0x38ef7d, 2.5, 60);
    tealLight.position.set(-20, -10, 15);
    this.scene.add(tealLight);

    // Magenta Rim Light
    const magentaLight = new THREE.PointLight(0xff2a85, 2.0, 70);
    magentaLight.position.set(0, -20, -15);
    this.scene.add(magentaLight);
  }

  buildDoubleHelix() {
    this.helixGroup = new THREE.Group();
    // Tilt the double helix diagonally across the screen
    this.helixGroup.rotation.z = -0.42;
    this.helixGroup.rotation.x = 0.28;
    this.helixGroup.position.set(6, -2, -5);

    const length = 48; // Total height of the strand
    const numRungs = 64; // Number of base pairs
    const radius = 3.8; // Helix radius
    const turns = 3.5; // Number of full helical turns

    const curve1Points = [];
    const curve2Points = [];

    // Base pair types & palette
    const pairColors = [
      { a: 0x00f0ff, b: 0xffb300, name: 'A-T' }, // Cyan - Amber
      { a: 0x38ef7d, b: 0xff2a85, name: 'G-C' }, // Emerald - Magenta
      { a: 0xffb300, b: 0x00f0ff, name: 'T-A' },
      { a: 0xff2a85, b: 0x38ef7d, name: 'C-G' }
    ];

    // Build rungs and helical spine points
    for (let i = 0; i <= numRungs; i++) {
      const t = i / numRungs;
      const y = (t - 0.5) * length;
      const angle = t * Math.PI * 2 * turns;

      const x1 = Math.cos(angle) * radius;
      const z1 = Math.sin(angle) * radius;

      const x2 = Math.cos(angle + Math.PI) * radius;
      const z2 = Math.sin(angle + Math.PI) * radius;

      curve1Points.push(new THREE.Vector3(x1, y, z1));
      curve2Points.push(new THREE.Vector3(x2, y, z2));

      // Build Base Pair Rung
      if (i < numRungs) {
        const pair = pairColors[i % pairColors.length];
        const rungGroup = new THREE.Group();

        // Half-cylinder 1 (Strand 1 to Center)
        const rungGeo1 = new THREE.CylinderGeometry(0.18, 0.18, radius, 8);
        const rungMat1 = new THREE.MeshStandardMaterial({
          color: pair.a,
          emissive: pair.a,
          emissiveIntensity: 0.65,
          roughness: 0.3,
          metalness: 0.8
        });
        const half1 = new THREE.Mesh(rungGeo1, rungMat1);
        half1.position.y = radius / 2;

        // Half-cylinder 2 (Center to Strand 2)
        const rungGeo2 = new THREE.CylinderGeometry(0.18, 0.18, radius, 8);
        const rungMat2 = new THREE.MeshStandardMaterial({
          color: pair.b,
          emissive: pair.b,
          emissiveIntensity: 0.65,
          roughness: 0.3,
          metalness: 0.8
        });
        const half2 = new THREE.Mesh(rungGeo2, rungMat2);
        half2.position.y = -radius / 2;

        // Hydrogen Bond Center Sphere
        const centerGeo = new THREE.SphereGeometry(0.32, 12, 12);
        const centerMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0x00f0ff,
          emissiveIntensity: 0.8
        });
        const centerSphere = new THREE.Mesh(centerGeo, centerMat);

        rungGroup.add(half1);
        rungGroup.add(half2);
        rungGroup.add(centerSphere);

        // Position & align rung
        rungGroup.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
        rungGroup.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(x1 - x2, 0, z1 - z2).normalize()
        );

        this.helixGroup.add(rungGroup);
        this.rungs.push({
          group: rungGroup,
          y: y,
          centerSphere: centerSphere,
          mat1: rungMat1,
          mat2: rungMat2,
          index: i
        });

        // Designate Target Loci for Gene 1, Gene 2, Gene 3
        if (i === 18) {
          this.attachLocusMarker(rungGroup, 'gene1', 0x00f0ff, 'GENE 1: BRCA1');
        } else if (i === 34) {
          this.attachLocusMarker(rungGroup, 'gene2', 0x38ef7d, 'GENE 2: TP53');
        } else if (i === 48) {
          this.attachLocusMarker(rungGroup, 'gene3', 0xff2a85, 'GENE 3: EGFR');
        }
      }
    }

    // Sugar-Phosphate Backbones (Dual Glowing Helical Tubes)
    const spineCurve1 = new THREE.CatmullRomCurve3(curve1Points);
    const spineCurve2 = new THREE.CatmullRomCurve3(curve2Points);

    const tubeGeo1 = new THREE.TubeGeometry(spineCurve1, 160, 0.38, 12, false);
    const tubeGeo2 = new THREE.TubeGeometry(spineCurve2, 160, 0.38, 12, false);

    const backboneMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0077aa,
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.85
    });

    const backbone1 = new THREE.Mesh(tubeGeo1, backboneMat);
    const backbone2 = new THREE.Mesh(tubeGeo2, backboneMat);

    this.helixGroup.add(backbone1);
    this.helixGroup.add(backbone2);

    this.scene.add(this.helixGroup);
  }

  // Attach a glowing targeting ring to a specific gene locus
  attachLocusMarker(parentGroup, geneKey, colorHex, label) {
    const markerGroup = new THREE.Group();

    // Glowing Target Ring
    const ringGeo = new THREE.TorusGeometry(1.2, 0.08, 12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;

    // Center Beacon Point
    const beaconGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 1.5
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);

    markerGroup.add(ring);
    markerGroup.add(beacon);
    parentGroup.add(markerGroup);

    this.locusNodes[geneKey] = {
      group: markerGroup,
      ring: ring,
      parent: parentGroup
    };
  }

  // Streaming Nucleotide Cloud (Letters & glowing particles floating along the helix)
  buildNucleotideParticleStream() {
    const particleCount = 650;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);
    const offsets = new Float32Array(particleCount);

    const colorPalette = [
      new THREE.Color(0x00f0ff), // A (Cyan)
      new THREE.Color(0xffb300), // T (Amber)
      new THREE.Color(0x38ef7d), // G (Emerald)
      new THREE.Color(0xff2a85)  // C (Magenta)
    ];

    for (let i = 0; i < particleCount; i++) {
      const t = Math.random();
      const angle = t * Math.PI * 2 * 3.5 + (Math.random() - 0.5) * 1.5;
      const r = 3.8 + (Math.random() - 0.5) * 2.2;
      const y = (t - 0.5) * 48;

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      speeds[i] = 0.05 + Math.random() * 0.12;
      offsets[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Material
    const material = new THREE.PointsMaterial({
      size: 0.65,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.particleSystem.userData = { speeds, offsets, positions };
    this.helixGroup.add(this.particleSystem);
  }

  // Variant Holographic Scanner Laser Beam
  buildScannerBeam() {
    this.scannerGroup = new THREE.Group();

    // Laser Ring
    const laserRingGeo = new THREE.TorusGeometry(5.2, 0.08, 16, 48);
    const laserRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9
    });
    const laserRing = new THREE.Mesh(laserRingGeo, laserRingMat);
    laserRing.rotation.x = Math.PI / 2;

    // Laser Plane Disc Glow
    const discGeo = new THREE.CircleGeometry(5.0, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = Math.PI / 2;

    this.scannerGroup.add(laserRing);
    this.scannerGroup.add(disc);
    this.scannerPos = -22;
    this.scannerGroup.position.y = this.scannerPos;

    this.helixGroup.add(this.scannerGroup);
  }

  // Animation & Render Loop
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Continuous slow rotation of the double helix
    if (this.helixGroup) {
      this.helixGroup.rotation.y += delta * 0.35;

      // Update locus points in 3D world space
      if (this.locusNodes.gene1) {
        this.locusNodes.gene1.group.getWorldPosition(this.locusPoints.gene1);
        this.locusNodes.gene1.ring.rotation.z += delta * 1.5;
      }
      if (this.locusNodes.gene2) {
        this.locusNodes.gene2.group.getWorldPosition(this.locusPoints.gene2);
        this.locusNodes.gene2.ring.rotation.z -= delta * 1.8;
      }
      if (this.locusNodes.gene3) {
        this.locusNodes.gene3.group.getWorldPosition(this.locusPoints.gene3);
        this.locusNodes.gene3.ring.rotation.z += delta * 2.0;
      }

      // 2. Animate Nucleotide Particle Stream
      if (this.particleSystem && this.showParticles) {
        const positions = this.particleSystem.geometry.attributes.position.array;
        const { speeds } = this.particleSystem.userData;

        for (let i = 0; i < speeds.length; i++) {
          positions[i * 3 + 1] += speeds[i];
          if (positions[i * 3 + 1] > 24) {
            positions[i * 3 + 1] = -24;
          }
        }
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
      }

      // 3. Animate Scanner Laser Beam
      if (this.scannerGroup && this.showScanner) {
        this.scannerPos += delta * 12 * this.scannerDirection;
        if (this.scannerPos > 23) {
          this.scannerPos = 23;
          this.scannerDirection = -1;
          if (window.biotechAudio) window.biotechAudio.playScannerBeep();
        } else if (this.scannerPos < -23) {
          this.scannerPos = -23;
          this.scannerDirection = 1;
        }
        this.scannerGroup.position.y = this.scannerPos;

        // Base pair scanner excitation pulse
        this.rungs.forEach(r => {
          const dist = Math.abs(r.y - this.scannerPos);
          if (dist < 1.8) {
            r.mat1.emissiveIntensity = 1.6;
            r.mat2.emissiveIntensity = 1.6;
          } else {
            r.mat1.emissiveIntensity = 0.65;
            r.mat2.emissiveIntensity = 0.65;
          }
        });
      }
    }

    // 4. Update OrbitControls
    if (this.controls) {
      this.controls.update();
    }

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);

    // 6. Update Dynamic SVG Laser Connectors linking 3D DNA to HUD Cards
    if (window.hudConnectors) {
      window.hudConnectors.updateConnectors(this.locusPoints, this.camera, this.renderer);
    }
  }

  // Focus camera on a specific gene locus
  focusGene(geneKey) {
    if (!this.locusPoints[geneKey]) return;

    if (window.biotechAudio) {
      window.biotechAudio.playTargetLock();
    }

    const targetPos = this.locusPoints[geneKey];

    // Smooth camera shift
    const startCamPos = this.camera.position.clone();
    const targetCamPos = new THREE.Vector3(targetPos.x + 8, targetPos.y + 2, targetPos.z + 18);
    let progress = 0;

    const animateCam = () => {
      progress += 0.05;
      this.camera.position.lerpVectors(startCamPos, targetCamPos, progress);
      this.camera.lookAt(targetPos);
      if (progress < 1) {
        requestAnimationFrame(animateCam);
      }
    };
    animateCam();
  }

  // Reset Camera View
  resetCamera() {
    this.camera.position.set(12, 4, 38);
    this.camera.lookAt(0, 0, 0);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
    }
    if (window.biotechAudio) {
      window.biotechAudio.playClick(600);
    }
  }

  // Toggle Scanner
  toggleScanner() {
    this.showScanner = !this.showScanner;
    if (this.scannerGroup) {
      this.scannerGroup.visible = this.showScanner;
    }
    return this.showScanner;
  }

  // Toggle Particles
  toggleParticles() {
    this.showParticles = !this.showParticles;
    if (this.particleSystem) {
      this.particleSystem.visible = this.showParticles;
    }
    return this.showParticles;
  }

  onWindowResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.dnaScene = new DnaSceneEngine();
});
