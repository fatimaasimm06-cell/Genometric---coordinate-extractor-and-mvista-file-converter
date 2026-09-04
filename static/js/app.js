/**
 * NEXUS GENOME // GENBANK & MVISTA CONVERTER APPLICATION LOGIC
 */

document.addEventListener('DOMContentLoaded', () => {
  // Mode Tabs
  const tabBtnExtractor = document.getElementById('tabBtnExtractor');
  const tabBtnMvista = document.getElementById('tabBtnMvista');
  const viewExtractor = document.getElementById('viewExtractor');
  const viewMvista = document.getElementById('viewMvista');

  // Action Buttons
  const btnOpenExtractModal = document.getElementById('btnOpenExtractModal');
  const btnOpenMvistaModal = document.getElementById('btnOpenMvistaModal');
  const btnLaunchConverter = document.getElementById('btnLaunchConverter');
  const audioToggleBtn = document.getElementById('audioToggleBtn');
  const audioIcon = document.getElementById('audioIcon');

  // 3D Viewport Controls
  const btnResetView = document.getElementById('btnResetView');
  const btnToggleScanner = document.getElementById('btnToggleScanner');
  const btnToggleParticles = document.getElementById('btnToggleParticles');

  // Modal Elements
  const analysisModal = document.getElementById('analysisModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const modalHeaderTitle = document.getElementById('modalHeaderTitle');
  const modalHeaderSubtitle = document.getElementById('modalHeaderSubtitle');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('genbankFileInput');
  const selectedFileName = document.getElementById('selectedFileName');
  const vistaOutputDisplay = document.getElementById('vistaOutputDisplay');
  const featuresCount = document.getElementById('featuresCount');
  const btnExecuteConvert = document.getElementById('btnExecuteConvert');
  const btnCopyResults = document.getElementById('btnCopyResults');
  const btnDownloadVista = document.getElementById('btnDownloadVista');
  const statusExtractedCount = document.getElementById('statusExtractedCount');
  const statusExtractedBar = document.getElementById('statusExtractedBar');
  const featureCheckboxes = document.querySelectorAll('.feature-checkbox');

  let currentMode = 'mvista'; // 'extractor' or 'mvista'
  let selectedFile = null;
  let extractedText = "";

  // 1. Tab Switching Logic
  function switchTab(mode) {
    currentMode = mode;
    if (mode === 'extractor') {
      if (tabBtnExtractor) tabBtnExtractor.classList.add('active');
      if (tabBtnMvista) tabBtnMvista.classList.remove('active');
      if (viewExtractor) viewExtractor.style.display = 'block';
      if (viewMvista) viewMvista.style.display = 'none';
      showToast('MODE: GENBANK COORDINATE EXTRACTOR');
    } else {
      if (tabBtnMvista) tabBtnMvista.classList.add('active');
      if (tabBtnExtractor) tabBtnExtractor.classList.remove('active');
      if (viewExtractor) viewExtractor.style.display = 'none';
      if (viewMvista) viewMvista.style.display = 'block';
      showToast('MODE: MVISTA FORMAT CONVERTER');
    }
    if (window.biotechAudio) window.biotechAudio.playClick(850);
  }

  if (tabBtnExtractor) tabBtnExtractor.addEventListener('click', () => switchTab('extractor'));
  if (tabBtnMvista) tabBtnMvista.addEventListener('click', () => switchTab('mvista'));

  // 2. Audio Toggle
  if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', () => {
      const isEnabled = window.biotechAudio ? window.biotechAudio.toggle() : false;
      if (isEnabled) {
        audioToggleBtn.classList.add('active');
        audioToggleBtn.querySelector('.audio-tag').textContent = 'AUDIO: LIVE';
        audioIcon.className = 'fa-solid fa-volume-high';
        showToast('BIOTECH AUDIO: ACTIVE');
        window.biotechAudio.playTargetLock();
      } else {
        audioToggleBtn.classList.remove('active');
        audioToggleBtn.querySelector('.audio-tag').textContent = 'AUDIO: OFF';
        audioIcon.className = 'fa-solid fa-volume-xmark';
        showToast('AUDIO: MUTED');
      }
    });
  }

  // 3. 3D Viewport Controls
  if (btnResetView) {
    btnResetView.addEventListener('click', () => {
      if (window.dnaScene) window.dnaScene.resetCamera();
      showToast('3D CAMERA: VIEWPORT RESET');
    });
  }

  if (btnToggleScanner) {
    btnToggleScanner.addEventListener('click', () => {
      if (window.dnaScene) {
        const isScanning = window.dnaScene.toggleScanner();
        btnToggleScanner.classList.toggle('active', isScanning);
        showToast(isScanning ? 'SCANNER: ACTIVE' : 'SCANNER: PAUSED');
      }
    });
  }

  if (btnToggleParticles) {
    btnToggleParticles.addEventListener('click', () => {
      if (window.dnaScene) {
        const hasParticles = window.dnaScene.toggleParticles();
        btnToggleParticles.classList.toggle('active', hasParticles);
        showToast(hasParticles ? 'STREAM: FLOWING' : 'STREAM: PAUSED');
      }
    });
  }

  // 4. Modal Open / Close Logic
  function openModal(mode = 'mvista') {
    currentMode = mode;
    if (mode === 'mvista') {
      if (modalHeaderTitle) modalHeaderTitle.textContent = 'MVISTA GUIDELINE CONVERTER';
      if (modalHeaderSubtitle) modalHeaderSubtitle.textContent = 'Upload GenBank (.gb/.gbk) to generate compliant mVISTA annotation files';
      if (btnExecuteConvert) btnExecuteConvert.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Convert to mVISTA`;
      if (btnDownloadVista) btnDownloadVista.innerHTML = `<i class="fa-solid fa-download"></i> Download .vista`;
    } else {
      if (modalHeaderTitle) modalHeaderTitle.textContent = 'GENBANK COORDINATE EXTRACTOR';
      if (modalHeaderSubtitle) modalHeaderSubtitle.textContent = 'Extract CDS & Gene Coordinates with 1-based indexing';
      if (btnExecuteConvert) btnExecuteConvert.innerHTML = `<i class="fa-solid fa-bolt"></i> Extract Coordinates`;
      if (btnDownloadVista) btnDownloadVista.innerHTML = `<i class="fa-solid fa-download"></i> Download .txt`;
    }

    if (analysisModal) {
      analysisModal.classList.add('active');
      analysisModal.setAttribute('aria-hidden', 'false');
      if (window.biotechAudio) window.biotechAudio.playClick(900);
    }
  }

  function closeModal() {
    if (analysisModal) {
      analysisModal.classList.remove('active');
      analysisModal.setAttribute('aria-hidden', 'true');
      if (window.biotechAudio) window.biotechAudio.playClick(500);
    }
  }

  if (btnOpenExtractModal) btnOpenExtractModal.addEventListener('click', () => openModal('extractor'));
  if (btnOpenMvistaModal) btnOpenMvistaModal.addEventListener('click', () => openModal('mvista'));
  if (btnLaunchConverter) btnLaunchConverter.addEventListener('click', () => openModal('mvista'));
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

  if (analysisModal) {
    analysisModal.addEventListener('click', (e) => {
      if (e.target === analysisModal) closeModal();
    });
  }

  // 5. File Selection & Drag & Drop
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--emerald-accent)';
      dropZone.style.background = 'rgba(56, 239, 125, 0.12)';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--cyan-bright)';
      dropZone.style.background = 'rgba(0, 240, 255, 0.04)';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--cyan-bright)';
      dropZone.style.background = 'rgba(0, 240, 255, 0.04)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });
  }

  function handleFileSelection(file) {
    selectedFile = file;
    if (selectedFileName) {
      selectedFileName.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color: var(--emerald-accent); font-size: 0.95rem;"></i> <strong style="color: #ffffff;">${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB) - Ready`;
    }
    if (dropZone) {
      dropZone.style.borderColor = 'var(--emerald-accent)';
    }
    showToast(`FILE LOADED: ${file.name}`);
    if (window.biotechAudio) window.biotechAudio.playClick(850);
  }

  // 6. Execute Conversion via POST
  if (btnExecuteConvert) {
    btnExecuteConvert.addEventListener('click', async () => {
      if (!selectedFile) {
        showToast('PLEASE SELECT A GENBANK FILE FIRST');
        if (window.biotechAudio) window.biotechAudio.playClick(400);
        return;
      }

      // Collect checked feature types
      const checkedFeatures = Array.from(featureCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value)
        .join(',');

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('features', checkedFeatures);

      const endpoint = (currentMode === 'mvista') ? '/convert-mvista' : '/extract';
      btnExecuteConvert.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
      btnExecuteConvert.disabled = true;

      if (vistaOutputDisplay) {
        vistaOutputDisplay.textContent = "Processing GenBank record with BioPython SeqIO...";
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (response.ok && (data.mvista_data || data.vista_data)) {
          extractedText = data.mvista_data || data.vista_data;
          const totalCount = data.total_count || data.total_features || 0;

          if (vistaOutputDisplay) vistaOutputDisplay.textContent = extractedText;
          if (featuresCount) featuresCount.textContent = `${totalCount} features`;

          if (statusExtractedCount) {
            statusExtractedCount.innerHTML = `${totalCount} <span class="telem-unit">Features</span>`;
          }
          if (statusExtractedBar) {
            statusExtractedBar.style.width = '100%';
          }

          showToast(`SUCCESS: ${totalCount} FEATURES GENERATED`);
          if (window.biotechAudio) window.biotechAudio.playTargetLock();

          // Dynamically update HUD preview with top 3 extracted lines
          updateHudWithExtractedLines(extractedText);
        } else {
          if (vistaOutputDisplay) {
            vistaOutputDisplay.textContent = `Error: ${data.error || 'Failed to process file'}`;
          }
          showToast(`ERROR: ${data.error || 'Failed'}`);
        }
      } catch (err) {
        if (vistaOutputDisplay) {
          vistaOutputDisplay.textContent = `Network error: ${err.message}`;
        }
        showToast('NETWORK ERROR CONNECTING TO SERVER');
      } finally {
        btnExecuteConvert.innerHTML = (currentMode === 'mvista')
          ? `<i class="fa-solid fa-wand-magic-sparkles"></i> Convert to mVISTA`
          : `<i class="fa-solid fa-bolt"></i> Extract Coordinates`;
        btnExecuteConvert.disabled = false;
      }
    });
  }

  // Update HUD Cards with top extracted genes
  function updateHudWithExtractedLines(rawText) {
    const lines = rawText.trim().split('\n');
    if (lines.length > 0 && document.getElementById('card1Symbol')) {
      const p1 = lines[0].split(' ');
      if (p1.length >= 5) {
        document.getElementById('card1Symbol').textContent = p1[4];
        document.getElementById('card1Locus').innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> ${p1[0]} ${p1[1]} - ${p1[2]} (${p1[3]})`;
      }
    }
    if (lines.length > 1 && document.getElementById('card2Symbol')) {
      const p2 = lines[1].split(' ');
      if (p2.length >= 5) {
        document.getElementById('card2Symbol').textContent = p2[4];
        document.getElementById('card2Locus').innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> ${p2[0]} ${p2[1]} - ${p2[2]} (${p2[3]})`;
      }
    }
    if (lines.length > 2 && document.getElementById('card3Symbol')) {
      const p3 = lines[2].split(' ');
      if (p3.length >= 5) {
        document.getElementById('card3Symbol').textContent = p3[4];
        document.getElementById('card3Locus').innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> ${p3[0]} ${p3[1]} - ${p3[2]} (${p3[3]})`;
      }
    }
  }

  // 7. Copy Output to Clipboard
  if (btnCopyResults) {
    btnCopyResults.addEventListener('click', () => {
      if (!extractedText) {
        showToast('NO EXTRACTED TEXT TO COPY');
        return;
      }
      navigator.clipboard.writeText(extractedText).then(() => {
        showToast('ANNOTATIONS COPIED TO CLIPBOARD');
        if (window.biotechAudio) window.biotechAudio.playClick(1000);
      });
    });
  }

  // 8. Download Output File (.vista or .txt)
  if (btnDownloadVista) {
    btnDownloadVista.addEventListener('click', () => {
      if (!extractedText) {
        showToast('NO DATA TO DOWNLOAD');
        return;
      }
      const ext = (currentMode === 'mvista') ? 'vista' : 'txt';
      const blob = new Blob([extractedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "annotation"}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`DOWNLOADED AS .${ext.toUpperCase()} FILE`);
    });
  }

  // 9. Toast Notifications
  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.innerHTML = `<i class="fa-solid fa-dna" style="color: var(--cyan-bright)"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
});
