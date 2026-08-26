/**
 * Avatar Character Manager
 * Real-time Green Screen Removal (Chroma Key) with Animated Presenter Mode
 * - Alternates (intercalates) between 2 Idle videos: Waving/Blinking & Holding Notebook
 * - Transitions to Thinking video (Hand on Chin) when AI responds.
 */

const idleVideo1Url = './Character_waving_and_blinking_eyes_202608252332.mp4';
const idleVideo2Url = './Character_holding_notebook_with_…_202608260005.mp4';
const thinkingVideoUrl = './Woman_resting_hand_on_chin_202608252343.mp4';

export class AvatarCharacter {
  constructor(options = {}) {
    this.containerId = options.containerId || 'avatar-character-widget';
    this.idle1Url = options.idle1Url || idleVideo1Url;
    this.idle2Url = options.idle2Url || idleVideo2Url;
    this.thinkingUrl = options.thinkingUrl || thinkingVideoUrl;

    this.currentState = 'idle';      // 'idle' | 'thinking'
    this.targetState = 'idle';       // 'idle' | 'thinking'
    this.currentIdleIndex = 0;       // 0: waving, 1: notebook
    
    this.isAnimRunning = false;
    this.isVisible = true;

    this.init();
  }

  init() {
    // Clean up existing widget if present
    const existing = document.getElementById(this.containerId);
    if (existing) existing.remove();

    // Create widget container
    this.widget = document.createElement('div');
    this.widget.id = this.containerId;
    this.widget.className = 'avatar-widget';

    // Create Idle Video 1 (Waving & Blinking)
    this.idleVideo1 = document.createElement('video');
    this.idleVideo1.src = this.idle1Url;
    this.idleVideo1.autoplay = true;
    this.idleVideo1.muted = true;
    this.idleVideo1.playsInline = true;
    this.idleVideo1.style.display = 'none';

    // Create Idle Video 2 (Holding Notebook)
    this.idleVideo2 = document.createElement('video');
    this.idleVideo2.src = this.idle2Url;
    this.idleVideo2.muted = true;
    this.idleVideo2.playsInline = true;
    this.idleVideo2.style.display = 'none';

    // Create Thinking Video (Hand on Chin)
    this.thinkingVideo = document.createElement('video');
    this.thinkingVideo.src = this.thinkingUrl;
    this.thinkingVideo.muted = true;
    this.thinkingVideo.playsInline = true;
    this.thinkingVideo.style.display = 'none';

    // Active video pointer
    this.currentVideo = this.idleVideo1;

    // Canvas element for chroma-key rendering
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'avatar-canvas';
    this.canvas.title = 'Assistente Vixer';
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.widget.appendChild(this.idleVideo1);
    this.widget.appendChild(this.idleVideo2);
    this.widget.appendChild(this.thinkingVideo);
    this.widget.appendChild(this.canvas);

    document.body.appendChild(this.widget);

    // Event listeners on video ended -> smooth transition at cycle completion
    this.idleVideo1.addEventListener('ended', () => {
      this.handleVideoEnded('idle1');
    });

    this.idleVideo2.addEventListener('ended', () => {
      this.handleVideoEnded('idle2');
    });

    this.thinkingVideo.addEventListener('ended', () => {
      this.handleVideoEnded('thinking');
    });

    // Autoplay unblock on user click
    const unblockAutoplay = () => {
      if (this.currentVideo.paused) {
        this.currentVideo.play().catch(() => {});
      }
    };
    window.addEventListener('click', unblockAutoplay, { once: true });
    window.addEventListener('touchstart', unblockAutoplay, { once: true });

    // Start initial video playback
    this.idleVideo1.play().then(() => {
      if (!this.isAnimRunning) {
        this.isAnimRunning = true;
        this.renderLoop();
      }
    }).catch(() => {
      // Autoplay blocked until user interaction
    });
  }

  /**
   * Toggle Presenter Mode:
   * When active (true): Character slides UP, Chat Input slides DOWN.
   * When inactive (false): Character slides DOWN, Chat Input slides UP.
   */
  showPresenterMode(active) {
    const inputWrapper = document.querySelector('.chat-input-wrapper');
    if (active) {
      this.widget.classList.add('active-presenter');
      if (inputWrapper) inputWrapper.classList.add('hidden-for-avatar');
    } else {
      this.widget.classList.remove('active-presenter');
      if (inputWrapper) inputWrapper.classList.remove('hidden-for-avatar');
    }
  }

  /**
   * Set desired state ('thinking' or 'idle')
   */
  setThinking(isThinking) {
    this.targetState = isThinking ? 'thinking' : 'idle';
    this.showPresenterMode(isThinking);
  }

  handleVideoEnded(videoType) {
    if (videoType === 'idle1' || videoType === 'idle2') {
      if (this.targetState === 'thinking') {
        // User asked a question -> Transition to Thinking video
        this.currentState = 'thinking';
        this.currentVideo.pause();
        this.currentVideo = this.thinkingVideo;
        this.thinkingVideo.currentTime = 0;
        this.thinkingVideo.play().catch(() => {});
      } else {
        // Alternate (intercalate) between Idle Video 1 and Idle Video 2
        const nextIdleIndex = videoType === 'idle1' ? 1 : 0;
        const nextIdleVideo = nextIdleIndex === 0 ? this.idleVideo1 : this.idleVideo2;
        
        this.currentIdleIndex = nextIdleIndex;
        this.currentVideo.pause();
        this.currentVideo = nextIdleVideo;
        nextIdleVideo.currentTime = 0;
        nextIdleVideo.play().catch(() => {});
      }
    } else if (videoType === 'thinking') {
      if (this.targetState === 'idle') {
        // AI finished response -> Return to current/next Idle video in sequence
        this.currentState = 'idle';
        const targetIdleVideo = this.currentIdleIndex === 0 ? this.idleVideo1 : this.idleVideo2;
        this.thinkingVideo.pause();
        this.currentVideo = targetIdleVideo;
        targetIdleVideo.currentTime = 0;
        targetIdleVideo.play().catch(() => {});
      } else {
        // Continue looping Thinking video
        this.thinkingVideo.currentTime = 0;
        this.thinkingVideo.play().catch(() => {});
      }
    }
  }

  renderLoop() {
    if (!this.isAnimRunning) return;

    const vid = this.currentVideo;
    if (this.isVisible && vid && !vid.paused && vid.videoWidth > 0) {
      const vWidth = vid.videoWidth;
      const vHeight = vid.videoHeight;
      
      // Full native video resolution rendering (up to 720px width for maximum crispness)
      const targetWidth = Math.min(vWidth, 720);
      const targetHeight = Math.round(targetWidth * (vHeight / vWidth));

      if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
        this.canvas.width = targetWidth;
        this.canvas.height = targetHeight;
      }

      // Draw current video frame to canvas
      this.ctx.drawImage(vid, 0, 0, targetWidth, targetHeight);

      // Extract frame pixels for chroma keying
      const frame = this.ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = frame.data;
      const len = data.length;

      // Green screen removal algorithm
      for (let i = 0; i < len; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const maxRB = Math.max(r, b);
        const greenDominance = g - maxRB;

        if (greenDominance > 25 && g > 65) {
          if (greenDominance > 55) {
            // Pure green background -> fully transparent
            data[i + 3] = 0;
          } else {
            // Edge anti-aliasing & spill suppression
            const alphaFactor = 1 - (greenDominance - 25) / 30;
            data[i + 3] = Math.floor(alphaFactor * 255);
            data[i + 1] = maxRB; // Suppress green tint on edges
          }
        }
      }

      // Write processed frame back to canvas
      this.ctx.putImageData(frame, 0, 0);

      // Render frame to Welcome Screen Hero Canvas if present
      const heroCanvas = document.getElementById('welcome-avatar-hero-canvas');
      if (heroCanvas && heroCanvas.offsetParent !== null) {
        if (heroCanvas.width !== targetWidth || heroCanvas.height !== targetHeight) {
          heroCanvas.width = targetWidth;
          heroCanvas.height = targetHeight;
        }
        const heroCtx = heroCanvas.getContext('2d');
        heroCtx.putImageData(frame, 0, 0);
      }
    }

    requestAnimationFrame(() => this.renderLoop());
  }
}
