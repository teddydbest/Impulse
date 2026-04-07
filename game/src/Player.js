import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.height = 1.7;
    this.speed = 7;

    this._vel = new THREE.Vector3();
    this._keys = { w: false, a: false, s: false, d: false };
    this._lockCBs = [];
    this._unlockCBs = [];

    // Raycaster for interaction (forward from camera center, 2.8m max)
    this._ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0, 2.8);

    this.canInteract = false;
    this.interactTarget = null;

    this.controls.addEventListener('lock',   () => this._lockCBs.forEach(cb => cb()));
    this.controls.addEventListener('unlock', () => this._unlockCBs.forEach(cb => cb()));

    document.addEventListener('keydown', e => this._onDown(e));
    document.addEventListener('keyup',   e => this._onUp(e));
  }

  onLock(cb)   { this._lockCBs.push(cb); }
  onUnlock(cb) { this._unlockCBs.push(cb); }
  lock()       { this.controls.lock(); }
  isLocked()   { return this.controls.isLocked; }

  _onDown(e) {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup')    this._keys.w = true;
    if (k === 's' || k === 'arrowdown')  this._keys.s = true;
    if (k === 'a' || k === 'arrowleft')  this._keys.a = true;
    if (k === 'd' || k === 'arrowright') this._keys.d = true;
    if (k === 'e') {
      if (this.canInteract && this.interactTarget?.onInteract) {
        this.interactTarget.onInteract();
      }
    }
  }

  _onUp(e) {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup')    this._keys.w = false;
    if (k === 's' || k === 'arrowdown')  this._keys.s = false;
    if (k === 'a' || k === 'arrowleft')  this._keys.a = false;
    if (k === 'd' || k === 'arrowright') this._keys.d = false;
  }

  update(delta, colliders, interactables) {
    if (!this.controls.isLocked) return;

    const dt = Math.min(delta, 0.05);
    const spd = this.speed * dt;

    // Apply friction
    this._vel.x *= 1 - Math.min(dt * 12, 1);
    this._vel.z *= 1 - Math.min(dt * 12, 1);

    if (this._keys.w) this._vel.z -= spd;
    if (this._keys.s) this._vel.z += spd;
    if (this._keys.a) this._vel.x -= spd;
    if (this._keys.d) this._vel.x += spd;

    const before = this.camera.position.clone();

    this.controls.moveRight(this._vel.x);
    this.controls.moveForward(-this._vel.z);
    this.camera.position.y = this.height;

    // Simple AABB collision: push out
    for (const box of colliders) {
      const p = this.camera.position;
      const margin = 0.45;
      if (
        p.x > box.min.x - margin && p.x < box.max.x + margin &&
        p.z > box.min.z - margin && p.z < box.max.z + margin &&
        p.y > box.min.y           && p.y < box.max.y + 0.5
      ) {
        this.camera.position.copy(before);
        this.camera.position.y = this.height;
        this._vel.set(0, 0, 0);
        break;
      }
    }

    this._updateInteraction(interactables);
  }

  _updateInteraction(interactables) {
    if (!interactables?.length) {
      this.canInteract = false;
      this.interactTarget = null;
      return;
    }

    // Cast ray from camera forward
    this._ray.setFromCamera({ x: 0, y: 0 }, this.camera);

    // Collect all child meshes with a back-reference to their interactable
    const meshes = [];
    const map = new Map();

    for (const item of interactables) {
      if (!item.mesh) continue;
      item.mesh.traverse(obj => {
        if (obj.isMesh) {
          meshes.push(obj);
          map.set(obj, item);
        }
      });
    }

    const hits = this._ray.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const target = map.get(hits[0].object);
      if (target) {
        this.canInteract = true;
        this.interactTarget = target;
        return;
      }
    }

    this.canInteract = false;
    this.interactTarget = null;
  }

  get position() { return this.camera.position; }
}
