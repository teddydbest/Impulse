import * as THREE from 'three';
import { Player }      from './Player.js';
import { World }       from './World.js';
import { FileManager } from './FileManager.js';
import { UI }          from './UI.js';

// ─── Pixel scale (3 = each rendered pixel = 3x3 screen pixels) ───
const PIXEL_SCALE = 3;

class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this._transitioning = false;

    this._setupRenderer();
    this._setupScene();

    this.fileManager = new FileManager();
    this.world       = new World(this.scene, this.fileManager);
    this.player      = new Player(this.camera, this.renderer.domElement);
    this.ui          = new UI(this.fileManager);

    this.world.build();

    // Expose for FileManager callback
    window._game = this;

    this._setupLockScreen();
    this._setupFileManagerListeners();
    this._animate();
  }

  // ─── Renderer ─────────────────────────────────────────────────
  _setupRenderer() {
    const W = Math.floor(window.innerWidth  / PIXEL_SCALE);
    const H = Math.floor(window.innerHeight / PIXEL_SCALE);

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(1);

    const canvas = this.renderer.domElement;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    canvas.style.imageRendering = 'pixelated';
    document.body.appendChild(canvas);

    window.addEventListener('resize', () => {
      const W2 = Math.floor(window.innerWidth  / PIXEL_SCALE);
      const H2 = Math.floor(window.innerHeight / PIXEL_SCALE);
      this.renderer.setSize(W2, H2);
      canvas.style.width  = window.innerWidth  + 'px';
      canvas.style.height = window.innerHeight + 'px';
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080810);
    this.scene.fog = new THREE.FogExp2(0x080810, 0.055);

    this.camera = new THREE.PerspectiveCamera(
      78, window.innerWidth / window.innerHeight, 0.08, 40
    );
    this.camera.position.set(0, 1.7, 7);
  }

  // ─── Lock screen ──────────────────────────────────────────────
  _setupLockScreen() {
    const ls = document.getElementById('lock-screen');

    ls.addEventListener('click', () => {
      if (this.fileManager.isAnyUIOpen()) return;
      this.player.lock();
    });

    this.player.onLock(() => {
      ls.style.display = 'none';
    });

    this.player.onUnlock(() => {
      // Only show lock screen if no UI is open
      if (!this.fileManager.isAnyUIOpen()) {
        ls.style.display = 'flex';
        // Update prompt text
        const clickPrompt = ls.querySelector('.click-prompt');
        if (clickPrompt) clickPrompt.textContent = '[ CLICK TO RESUME ]';
      }
    });
  }

  // Called by FileManager when cabinet UI closes
  onUIClose() {
    if (!this.player.isLocked()) {
      const ls = document.getElementById('lock-screen');
      ls.style.display = 'flex';
      const cp = ls.querySelector('.click-prompt');
      if (cp) cp.textContent = '[ CLICK TO RESUME ]';
    }
  }

  _setupFileManagerListeners() {
    // Refresh gallery when images are added while in gallery room
    this.fileManager.on('add', (file) => {
      if (this.world.currentRoom === 'gallery' && file.cat === 'image') {
        this.world._refreshGallery();
      }
      if (this.world.currentRoom === 'theater' && file.cat === 'video') {
        this.world._refreshTheater();
      }
    });
  }

  // ─── Room transition ──────────────────────────────────────────
  transitionTo(roomId) {
    if (this._transitioning) return;
    this._transitioning = true;

    const fade = document.getElementById('fade');
    fade.classList.add('black');

    setTimeout(() => {
      this.world.activateRoom(roomId);
      this.ui.setRoom(this.world.getRoomName(roomId));

      // Reset player position
      const spawn = this.world.getSpawn(roomId);
      this.camera.position.copy(spawn);

      // Face into the room (south = toward +z where spawn is, look toward -z / north)
      // PointerLockControls: yaw object is controls.getObject(), pitch is camera itself
      if (this.player.controls) {
        this.player.controls.getObject().rotation.y = 0; // yaw
        this.camera.rotation.x = 0;                      // pitch
      }

      setTimeout(() => {
        fade.classList.remove('black');
        this._transitioning = false;
      }, 350);
    }, 420);
  }

  // ─── Main loop ────────────────────────────────────────────────
  _animate() {
    requestAnimationFrame(() => this._animate());
    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (!this.fileManager.isAnyUIOpen()) {
      this.player.update(
        delta,
        this.world.getColliders(),
        this.world.getInteractables()
      );

      if (!this._transitioning) {
        const portal = this.world.checkPortal(this.camera.position);
        if (portal) this.transitionTo(portal.targetRoom);
      }
    }

    this.world.update(delta);
    this.ui.update(this.player);

    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
