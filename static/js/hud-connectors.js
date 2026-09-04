/**
 * NEXUS GENOME // DYNAMIC HUD CONNECTORS
 * Maps 3D WebGL Vector3 Locus coordinates to 2D Screen Space and renders animated SVG Bezier Lasers
 */

class HudConnectorsEngine {
  constructor() {
    this.svg = document.getElementById('hudConnectorSvg');
    this.pathGene1 = document.getElementById('laserGene1');
    this.pathGene2 = document.getElementById('laserGene2');
    this.pathGene3 = document.getElementById('laserGene3');

    this.cardGene1 = document.getElementById('hudGene1');
    this.cardGene2 = document.getElementById('hudGene2');
    this.cardGene3 = document.getElementById('laserGene3');
  }

  // Convert 3D world position to 2D screen coordinates
  toScreenPosition(vector3, camera, renderer) {
    if (!vector3 || !camera || !renderer) return { x: 0, y: 0, visible: false };

    const canvas = renderer.domElement;
    const pos = vector3.clone();
    pos.project(camera);

    const isBehind = pos.z > 1;
    const x = (pos.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (-pos.y * 0.5 + 0.5) * canvas.clientHeight;

    return {
      x: x,
      y: y,
      visible: !isBehind && x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight
    };
  }

  // Calculate smooth SVG Bezier curve path string
  createBezierPath(startX, startY, endX, endY) {
    const dx = endX - startX;
    const cp1x = startX + dx * 0.45;
    const cp1y = startY;
    const cp2x = startX + dx * 0.55;
    const cp2y = endY;

    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
  }

  // Update connectors every frame
  updateConnectors(locusPoints, camera, renderer) {
    if (!locusPoints || !camera || !renderer) return;

    // Gene 1 (BRCA1)
    if (this.pathGene1 && this.cardGene1 && locusPoints.gene1) {
      const screenPos = this.toScreenPosition(locusPoints.gene1, camera, renderer);
      const cardRect = this.cardGene1.getBoundingClientRect();
      const targetX = cardRect.left + 10;
      const targetY = cardRect.top + cardRect.height / 2;

      if (screenPos.visible && cardRect.width > 0) {
        this.pathGene1.setAttribute('d', this.createBezierPath(screenPos.x, screenPos.y, targetX, targetY));
        this.pathGene1.style.opacity = '1';
      } else {
        this.pathGene1.style.opacity = '0';
      }
    }

    // Gene 2 (TP53)
    const card2 = document.getElementById('hudGene2');
    if (this.pathGene2 && card2 && locusPoints.gene2) {
      const screenPos = this.toScreenPosition(locusPoints.gene2, camera, renderer);
      const cardRect = card2.getBoundingClientRect();
      const targetX = cardRect.left + 10;
      const targetY = cardRect.top + cardRect.height / 2;

      if (screenPos.visible && cardRect.width > 0) {
        this.pathGene2.setAttribute('d', this.createBezierPath(screenPos.x, screenPos.y, targetX, targetY));
        this.pathGene2.style.opacity = '1';
      } else {
        this.pathGene2.style.opacity = '0';
      }
    }

    // Gene 3 (EGFR)
    const card3 = document.getElementById('hudGene3');
    if (this.pathGene3 && card3 && locusPoints.gene3) {
      const screenPos = this.toScreenPosition(locusPoints.gene3, camera, renderer);
      const cardRect = card3.getBoundingClientRect();
      const targetX = cardRect.left + 10;
      const targetY = cardRect.top + cardRect.height / 2;

      if (screenPos.visible && cardRect.width > 0) {
        this.pathGene3.setAttribute('d', this.createBezierPath(screenPos.x, screenPos.y, targetX, targetY));
        this.pathGene3.style.opacity = '1';
      } else {
        this.pathGene3.style.opacity = '0';
      }
    }
  }
}

window.hudConnectors = new HudConnectorsEngine();
