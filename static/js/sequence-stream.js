/**
 * NEXUS GENOME // SEQUENCE STREAM & CHROMATOGRAM ENGINE
 * Manages live FastQ ticker streams and real-time 4-channel Sanger chromatogram peak rendering
 */

class SequenceStreamEngine {
  constructor() {
    this.tickerEl = document.getElementById('fastqStreamTicker');
    this.canvas = document.getElementById('chromatogramCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.bases = ['A', 'T', 'G', 'C'];
    this.colors = {
      A: '#00f0ff', // Cyan
      T: '#ffb300', // Amber
      G: '#38ef7d', // Emerald
      C: '#ff2a85'  // Magenta
    };

    this.peaks = [];
    this.peakOffset = 0;
    this.readIndex = 7810;

    this.initPeaks();
    this.startTickerLoop();
    this.startCanvasLoop();
  }

  initPeaks() {
    // Generate initial peak data points
    for (let i = 0; i < 40; i++) {
      const base = this.bases[Math.floor(Math.random() * this.bases.length)];
      this.peaks.push({
        base: base,
        height: 0.5 + Math.random() * 0.45,
        width: 14 + Math.random() * 8
      });
    }
  }

  // FastQ stream ticker animation
  startTickerLoop() {
    if (!this.tickerEl) return;

    setInterval(() => {
      this.readIndex++;
      let seqHtml = `@READ_${this.readIndex}: `;

      const seqLen = 18;
      const mutIndex = Math.floor(Math.random() * (seqLen - 2)) + 1;

      for (let i = 0; i < seqLen; i++) {
        if (i === mutIndex && Math.random() > 0.4) {
          const from = this.bases[Math.floor(Math.random() * this.bases.length)];
          const to = this.bases.filter(b => b !== from)[Math.floor(Math.random() * 3)];
          seqHtml += `<span class="seq-mut">${from}&gt;${to}</span>`;
        } else {
          const b = this.bases[Math.floor(Math.random() * this.bases.length)];
          seqHtml += `<span class="seq-${b.toLowerCase()}">${b}</span>`;
        }
      }

      this.tickerEl.innerHTML = `<span class="seq-read">${seqHtml}</span>`;
    }, 450);
  }

  // Real-time Chromatogram 4-channel waveform canvas
  startCanvasLoop() {
    if (!this.canvas || !this.ctx) return;

    const render = () => {
      this.peakOffset += 1.2;

      // Add new peak when scrolled
      if (this.peakOffset > 30) {
        this.peakOffset = 0;
        this.peaks.shift();
        const base = this.bases[Math.floor(Math.random() * this.bases.length)];
        this.peaks.push({
          base: base,
          height: 0.45 + Math.random() * 0.5,
          width: 16 + Math.random() * 6
        });
      }

      const width = this.canvas.width;
      const height = this.canvas.height;
      const ctx = this.ctx;

      ctx.clearRect(0, 0, width, height);

      // Background subtle grid
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
      ctx.lineWidth = 1;
      for (let y = 15; y < height; y += 18) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw peaks for each base channel
      const channelBases = ['A', 'T', 'G', 'C'];

      channelBases.forEach(channel => {
        ctx.beginPath();
        ctx.strokeStyle = this.colors[channel];
        ctx.lineWidth = 1.8;
        ctx.shadowColor = this.colors[channel];
        ctx.shadowBlur = 4;

        let started = false;

        for (let i = 0; i < this.peaks.length; i++) {
          const p = this.peaks[i];
          const x = i * 28 - this.peakOffset;
          const isPrimary = (p.base === channel);
          const peakHeight = isPrimary ? (p.height * (height - 18)) : (Math.random() * 6 + 3);
          const y = height - 8 - peakHeight;

          if (!started) {
            ctx.moveTo(x - 14, height - 8);
            started = true;
          }

          // Gaussian bell curve peak approximation
          ctx.bezierCurveTo(
            x - 8, height - 8,
            x - 6, y,
            x, y
          );
          ctx.bezierCurveTo(
            x + 6, y,
            x + 8, height - 8,
            x + 14, height - 8
          );
        }

        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      });

      // Scanline cursor indicator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(width - 60, 0);
      ctx.lineTo(width - 60, height);
      ctx.stroke();
      ctx.setLineDash([]);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }
}

window.sequenceStream = new SequenceStreamEngine();
