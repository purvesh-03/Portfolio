(() => {
  'use strict';

  /* ==========================================================================
     CONFIGURATION & CONSTANTS
     ========================================================================== */
  const TOTAL_FRAMES = 192;
  const FRAME_WIDTH = 1280;
  const FRAME_HEIGHT = 720;

  // DOM Elements
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const canvasScrim = document.getElementById('canvas-scrim');
  const bgToggleBtn = document.getElementById('bg-toggle-btn');

  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderPercent = document.getElementById('loader-percent');
  const loaderCount = document.getElementById('loader-count');

  const progressContainer = document.querySelector('.progress-container');
  const progressBar = document.getElementById('progress-bar');
  const scrubLabel = document.getElementById('scrub-label');

  // Modal Elements
  const projectModal = document.getElementById('project-modal');
  const modalContent = document.getElementById('modal-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const openEducationBtn = document.getElementById('open-education-btn');
  const viewAllBtn = document.getElementById('view-all-btn');

  // Animation State
  const frames = new Array(TOTAL_FRAMES);
  const isLoaded = new Array(TOTAL_FRAMES).fill(false);
  let loadedCount = 0;

  let targetFrame = 0;
  let currentFrame = 0;
  let renderedIndex = -1;
  let isTicking = false;

  // Background Scrim Modes: balanced (default), vivid, stealth
  const scrimModes = [
    { opacity: '0.70', label: 'BG: BALANCED' },
    { opacity: '0.28', label: 'BG: VIVID 3D' },
    { opacity: '0.90', label: 'BG: SUBTLE' }
  ];
  let currentScrimIndex = 0;

  /* ==========================================================================
     FRAME PATH GENERATOR
     ========================================================================== */
  function getFramePath(index) {
    return `frame_${String(index).padStart(4, '0')}.webp`;
  }

  /* ==========================================================================
     RESIZE & CANVAS SETUP
     ========================================================================== */
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    renderedIndex = -1;
    drawFrame(Math.round(currentFrame));
  }

  /* ==========================================================================
     DRAW FRAME (OBJECT-FIT: COVER MATH)
     ========================================================================== */
  function drawFrame(index) {
    if (index === renderedIndex && renderedIndex !== -1) return;

    let frameToDraw = null;

    // Direct loaded frame or fallback to nearest loaded frame
    if (isLoaded[index] && frames[index]) {
      frameToDraw = frames[index];
    } else {
      let minDiff = Infinity;
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if (isLoaded[i] && frames[i]) {
          const diff = Math.abs(i - index);
          if (diff < minDiff) {
            minDiff = diff;
            frameToDraw = frames[i];
          }
        }
      }
    }

    if (!frameToDraw) return;

    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;

    const scale = Math.max(viewWidth / FRAME_WIDTH, viewHeight / FRAME_HEIGHT);
    const drawWidth = FRAME_WIDTH * scale;
    const drawHeight = FRAME_HEIGHT * scale;
    const dx = (viewWidth - drawWidth) / 2;
    const dy = (viewHeight - drawHeight) / 2;

    ctx.fillStyle = '#08080b';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    ctx.drawImage(frameToDraw, dx, dy, drawWidth, drawHeight);

    renderedIndex = index;

    if (scrubLabel) {
      scrubLabel.textContent = `FRAME ${String(index).padStart(3, '0')} / ${TOTAL_FRAMES - 1}`;
    }
  }

  /* ==========================================================================
     SMOOTH LERP ANIMATION LOOP
     ========================================================================== */
  function tick() {
    const delta = targetFrame - currentFrame;

    if (Math.abs(delta) < 0.002) {
      currentFrame = targetFrame;
      drawFrame(Math.round(currentFrame));
      isTicking = false;
      return;
    }

    currentFrame += delta * 0.18;
    drawFrame(Math.round(currentFrame));

    requestAnimationFrame(tick);
  }

  function triggerTick() {
    if (!isTicking) {
      isTicking = true;
      requestAnimationFrame(tick);
    }
  }

  /* ==========================================================================
     SCROLL HANDLER
     ========================================================================== */
  function onScroll() {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, scrollY / maxScroll));

    targetFrame = progress * (TOTAL_FRAMES - 1);
    triggerTick();

    if (progressBar) {
      progressBar.style.transform = `scaleX(${progress})`;
    }
  }

  /* ==========================================================================
     ASSET PRELOADING PIPELINE
     ========================================================================== */
  function updateProgress() {
    const pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
    if (loaderBar) loaderBar.style.width = `${pct}%`;
    if (loaderPercent) loaderPercent.textContent = `${pct}%`;
    if (loaderCount) loaderCount.textContent = `${loadedCount} / ${TOTAL_FRAMES}`;

    // Release preloader as soon as 30 frames are loaded for immediate user interaction
    if (loadedCount >= 30 && loader && !loader.classList.contains('loaded')) {
      setTimeout(() => {
        loader.classList.add('loaded');
      }, 200);
    }

    if (loadedCount === TOTAL_FRAMES && loader) {
      loader.classList.add('loaded');
    }
  }

  function loadFrames() {
    // 1. Immediately load frame 0 for instant visual response
    const firstImg = new Image();
    firstImg.src = getFramePath(0);
    firstImg.onload = () => {
      frames[0] = firstImg;
      isLoaded[0] = true;
      loadedCount++;
      updateProgress();
      drawFrame(0);

      // 2. Stream subsequent frames
      loadRemainingFrames();
    };
    firstImg.onerror = () => {
      console.warn('Failed to load initial frame');
      loadRemainingFrames();
    };
  }

  function loadRemainingFrames() {
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);

      img.onload = () => {
        frames[i] = img;
        isLoaded[i] = true;
        loadedCount++;
        updateProgress();

        if (Math.round(currentFrame) === i) {
          drawFrame(i);
        }
      };

      img.onerror = () => {
        loadedCount++;
        updateProgress();
      };
    }
  }

  /* ==========================================================================
     BACKGROUND AMBIENCE TOGGLE
     ========================================================================== */
  if (bgToggleBtn && canvasScrim) {
    bgToggleBtn.addEventListener('click', () => {
      currentScrimIndex = (currentScrimIndex + 1) % scrimModes.length;
      const mode = scrimModes[currentScrimIndex];
      canvasScrim.style.opacity = mode.opacity;
      const textSpan = bgToggleBtn.querySelector('span');
      if (textSpan) textSpan.textContent = mode.label;
    });
  }

  /* ==========================================================================
     INTERACTIVE SCRUBBER ON PROGRESS BAR
     ========================================================================== */
  if (progressContainer) {
    let isScrubbing = false;

    const scrub = (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo({ top: ratio * maxScroll, behavior: 'auto' });
    };

    progressContainer.addEventListener('mousedown', (e) => {
      isScrubbing = true;
      scrub(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (isScrubbing) scrub(e);
    });

    window.addEventListener('mouseup', () => {
      isScrubbing = false;
    });

    progressContainer.addEventListener('touchstart', (e) => {
      isScrubbing = true;
      scrub(e);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isScrubbing) scrub(e);
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isScrubbing = false;
    });
  }

  /* ==========================================================================
     PROJECT DETAILS DATA & MODAL CONTROLLER
     ========================================================================== */
  const projectsData = {
    'friend-rec': {
      title: 'Social Network Friend Recommendation System',
      category: 'Data Structures • Graph Algorithms • AI',
      tags: ['Python', 'Graph Theory', 'BFS', 'Adjacency List', 'DSA'],
      image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      description: 'A Python-based graph application that explores social network topologies, analyzes mutual connections, and delivers accurate friend recommendations using graph traversal algorithms.',
      highlights: [
        'Implemented custom Breadth-First Search (BFS) for exploring multi-hop node connections.',
        'Calculated mutual friend intersection coefficients to rank recommendation relevance.',
        'Engineered an intuitive command-line and visual graph inspection interface.',
        'Optimized graph adjacency matrices and lists for scalable relationship lookups.'
      ],
      techStack: 'Python 3, NetworkX, Graph Theory, Algorithm Design'
    },
    'task-tick': {
      title: 'Task Tick – Task Management System',
      category: 'Frontend Engineering • Productivity • UI/UX',
      tags: ['JavaScript', 'HTML5', 'CSS3', 'Local Storage', 'UI Design'],
      image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1200&q=80',
      description: 'A sleek, focused task management application created to organize daily schedules, manage project priorities, track deadlines, and supercharge personal productivity.',
      highlights: [
        'Dynamic priority matrix (Urgent, High, Medium, Low) with custom sorting.',
        'Interactive checklist with progress tracking meters and completion statistics.',
        'Persistent client-side state management using browser LocalStorage.',
        'Fluid dark-mode glassmorphic interface inspired by luxury modern design systems.'
      ],
      techStack: 'Vanilla JavaScript (ES6+), Modern CSS3, HTML5 Semantics'
    },
    'ai-generator': {
      title: 'AI Website Generator',
      category: 'Generative AI • Web Prototyping • Fullstack',
      tags: ['Python', 'Streamlit', 'Generative AI', 'Web Development'],
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      description: 'An experimental website-generation tool that turns natural language prompts and structural wireframe instructions into functional, production-ready web pages.',
      highlights: [
        'Built with Python and Streamlit for an interactive real-time development playground.',
        'Parses design requirements and synthesizes clean HTML5, CSS3, and layout grids.',
        'Instant live preview sandbox allowing users to inspect and copy generated code.',
        'Engineered prompt optimization templates for consistent aesthetic output.'
      ],
      techStack: 'Python, Streamlit, Prompt Engineering, Web Synthesizer'
    },
    'pest-detection': {
      title: 'Pest Detection AI Project',
      category: 'Artificial Intelligence • Computer Vision • Agri-Tech',
      tags: ['AI/ML', 'Python', 'Computer Vision', 'Agri-Tech', 'Deep Learning'],
      image: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=1200&q=80',
      description: 'An agricultural technology project exploring automated pest and plant disease detection through an accessible digital application interface.',
      highlights: [
        'Automated classification pipeline analyzing leaf images for signs of damage or infestation.',
        'Explored CNN architectures for multi-class identification of crop pests.',
        'Designed simple diagnostic reporting so farmers and researchers can take immediate preventive action.',
        'Targeted for lightweight deployment on mobile and edge devices.'
      ],
      techStack: 'Python, OpenCV, PyTorch / TensorFlow, Streamlit UI'
    }
  };

  function openProjectModal(key) {
    const data = projectsData[key];
    if (!data) return;

    modalContent.innerHTML = `
      <div style="margin-bottom: 20px;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--gold-primary); letter-spacing: 0.15em; text-transform: uppercase;">${data.category}</span>
        <h2 style="font-family: var(--font-serif); font-size: clamp(1.4rem, 2.2vw, 1.9rem); color: #fff; margin-top: 6px; line-height: 1.25;">${data.title}</h2>
      </div>
      
      <div style="width: 100%; aspect-ratio: 16/9; border-radius: 12px; overflow: hidden; margin-bottom: 24px; border: 1px solid var(--gold-border);">
        <img src="${data.image}" alt="${data.title}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>

      <p style="font-size: 14.5px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 20px;">${data.description}</p>

      <h4 style="font-family: var(--font-mono); font-size: 12px; color: var(--gold-light); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 12px;">Key Highlights &amp; Architecture:</h4>
      <ul style="margin-left: 20px; font-size: 13.5px; color: var(--text-secondary); line-height: 1.8; margin-bottom: 24px;">
        ${data.highlights.map(h => `<li>${h}</li>`).join('')}
      </ul>

      <div style="background: rgba(222, 197, 165, 0.05); border: 1px solid var(--gold-border); border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--gold-primary); font-weight: 700; display: block; margin-bottom: 4px;">TECH STACK:</span>
        <span style="font-family: var(--font-mono); font-size: 13px; color: #fff;">${data.techStack}</span>
      </div>

      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <a href="#contact" class="btn-primary" onclick="document.getElementById('project-modal').classList.remove('open');">
          <span>Discuss This Project</span>
        </a>
      </div>
    `;

    projectModal.classList.add('open');
    projectModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function openEducationModal() {
    modalContent.innerHTML = `
      <div style="margin-bottom: 24px;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--gold-primary); letter-spacing: 0.15em; text-transform: uppercase;">ACADEMIC PROFILE &amp; ROADMAP</span>
        <h2 style="font-family: var(--font-serif); font-size: clamp(1.4rem, 2.2vw, 1.9rem); color: #fff; margin-top: 6px;">Purvesh Pathekar — Academic Excellence</h2>
      </div>

      <div style="background: rgba(18, 18, 24, 0.8); border: 1px solid var(--gold-border); border-radius: 12px; padding: 22px; margin-bottom: 24px;">
        <h3 style="font-family: var(--font-serif); font-size: 17px; color: #fff; margin-bottom: 6px;">Bachelor of Technology (B.Tech)</h3>
        <p style="font-size: 13.5px; color: var(--gold-light); margin-bottom: 4px;">Shri B. J. Institute, Nagpur (SB Jain)</p>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">Specialization: <strong>Artificial Intelligence &amp; Machine Learning</strong> (2nd Year)</p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div style="background: rgba(10, 10, 14, 0.6); border: 1px solid var(--gold-border); padding: 14px; border-radius: 8px;">
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--gold-muted);">SEMESTER 1</span>
            <div style="font-family: var(--font-mono); font-size: 26px; font-weight: 800; color: #34d399;">9.55 <small style="font-size: 12px; color: var(--gold-primary);">SGPA</small></div>
            <span style="font-size: 11px; color: var(--text-muted);">Dean's Honor Roll Performance</span>
          </div>
          <div style="background: rgba(10, 10, 14, 0.6); border: 1px solid var(--gold-border); padding: 14px; border-radius: 8px;">
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--gold-muted);">SEMESTER 2</span>
            <div style="font-family: var(--font-mono); font-size: 26px; font-weight: 800; color: var(--gold-light);">8.50 <small style="font-size: 12px; color: var(--gold-primary);">SGPA</small></div>
            <span style="font-size: 11px; color: var(--text-muted);">Core Engineering Foundations</span>
          </div>
        </div>
      </div>

      <h4 style="font-family: var(--font-mono); font-size: 12px; color: var(--gold-light); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 12px;">Core Areas of Study:</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px;">
        <span class="s-tag">Data Structures &amp; Algorithms</span>
        <span class="s-tag">Graph Theory</span>
        <span class="s-tag">Python &amp; Java Programming</span>
        <span class="s-tag">Linear Algebra &amp; Statistics</span>
        <span class="s-tag">AI &amp; Machine Learning Principles</span>
        <span class="s-tag">Database Management Systems</span>
        <span class="s-tag">Object-Oriented Design</span>
      </div>

      <div style="display: flex; gap: 12px;">
        <a href="mailto:purveshpathekar@gmail.com" class="btn-primary" onclick="document.getElementById('project-modal').classList.remove('open');">
          <span>Inquire Academic Transcript</span>
        </a>
      </div>
    `;

    projectModal.classList.add('open');
    projectModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function openAllProjectsModal() {
    modalContent.innerHTML = `
      <div style="margin-bottom: 24px;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--gold-primary); letter-spacing: 0.15em; text-transform: uppercase;">PORTFOLIO DIRECTORY</span>
        <h2 style="font-family: var(--font-serif); font-size: clamp(1.4rem, 2.2vw, 1.9rem); color: #fff; margin-top: 6px;">All Featured Projects &amp; Prototypes</h2>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        ${Object.keys(projectsData).map((k, idx) => {
          const item = projectsData[k];
          return `
            <div style="background: rgba(18, 18, 24, 0.7); border: 1px solid var(--gold-border); border-radius: 10px; padding: 18px; display: flex; justify-content: space-between; align-items: center; gap: 16px; cursor: pointer;" onclick="window.portfolioApp.openProject('${k}')">
              <div>
                <span style="font-family: var(--font-mono); font-size: 11px; color: var(--gold-primary);">0${idx + 1} • ${item.category}</span>
                <h4 style="font-family: var(--font-serif); font-size: 15px; color: #fff; margin: 3px 0;">${item.title}</h4>
                <p style="font-size: 12px; color: var(--text-secondary); max-width: 480px;">${item.description}</p>
              </div>
              <span style="font-family: var(--font-mono); font-size: 12px; color: var(--gold-light); border: 1px solid var(--gold-border); padding: 6px 12px; border-radius: 20px; white-space: nowrap;">Inspect →</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    projectModal.classList.add('open');
    projectModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    projectModal.classList.remove('open');
    projectModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Attach card event listeners
  document.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('click', () => {
      const pKey = card.getAttribute('data-project');
      if (pKey) openProjectModal(pKey);
    });
  });

  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openAllProjectsModal();
    });
  }

  if (openEducationBtn) {
    openEducationBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openEducationModal();
    });
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && projectModal.classList.contains('open')) {
      closeModal();
    }
  });

  // Global namespace for inline modal clicks
  window.portfolioApp = {
    openProject: openProjectModal
  };

  /* ==========================================================================
     SMOOTH KEYBOARD SCROLLING
     ========================================================================== */
  window.addEventListener('keydown', (e) => {
    if (projectModal.classList.contains('open')) return;
    const scrollStep = window.innerHeight * 0.35;
    if (e.key === 'ArrowDown' || e.key === 'j') {
      window.scrollBy({ top: scrollStep, behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      window.scrollBy({ top: -scrollStep, behavior: 'smooth' });
    } else if (e.key === ' ') {
      window.scrollBy({ top: e.shiftKey ? -window.innerHeight : window.innerHeight, behavior: 'smooth' });
    } else if (e.key === 'Home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (e.key === 'End') {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  });

  /* ==========================================================================
     INITIALIZATION & EVENT LISTENERS
     ========================================================================== */
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('scroll', onScroll, { passive: true });

  // Start frame engine
  resizeCanvas();
  loadFrames();
  onScroll();

})();
