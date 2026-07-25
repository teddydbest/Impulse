// player.js — first-person controller: movement, jump, crouch, gravity,
// collision against the map, headbob and shooting-position source.
import * as THREE from 'three';
import { PointerLockControls } from '../vendor/PointerLockControls.js';

const EYE_STAND = 1.7;
const EYE_CROUCH = 1.05;

export class Player {
  constructor(camera, domElement, map, audio) {
    this.camera = camera;
    this.map = map;
    this.audio = audio;
    this.controls = new PointerLockControls(camera, domElement);
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3(48, EYE_STAND, 48); // open corner, facing center
    this.onGround = true;
    this.crouching = false;
    this.eyeHeight = EYE_STAND;
    this.targetEye = EYE_STAND;
    this.speedScalar = 0;   // 0..1 normalized horizontal speed for viewmodel
    this.airborne = false;

    this.maxHp = 100; this.hp = 100;
    this.maxArmor = 100; this.armor = 100;

    this.keys = {};
    this.bobPhase = 0;
    this.stepDist = 0;

    this._bindKeys();
    // aim the camera toward the arena center at start
    this.controls.getObject().position.copy(this.position);
    camera.lookAt(0, 1.7, 0);
  }

  _bindKeys() {
    this._kd = (e) => {
      this.keys[e.code] = true;
      if (e.code === 'ControlLeft' || e.code === 'KeyC') this.crouching = true;
    };
    this._ku = (e) => {
      this.keys[e.code] = false;
      if (e.code === 'ControlLeft' || e.code === 'KeyC') this.crouching = false;
    };
    document.addEventListener('keydown', this._kd);
    document.addEventListener('keyup', this._ku);
  }

  reset() {
    this.hp = this.maxHp; this.armor = this.maxArmor;
    this.velocity.set(0, 0, 0);
    this.position.set(48, EYE_STAND, 48);
    this.controls.getObject().position.copy(this.position);
    this.camera.lookAt(0, EYE_STAND, 0); // face arena center
    this.crouching = false;
    this.eyeHeight = EYE_STAND;
  }

  get isLocked() { return this.controls.isLocked; }

  takeDamage(amount) {
    if (this.hp <= 0) return;
    // armor absorbs half, degrades
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.5);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.audio.playerHurt();
    return this.hp <= 0;
  }

  heal(hp, armor) {
    this.hp = Math.min(this.maxHp, this.hp + hp);
    if (armor) this.armor = Math.min(this.maxArmor, this.armor + armor);
  }

  update(dt) {
    const obj = this.controls.getObject();
    const speed = this.crouching ? 3.2 : (this.keys['ShiftLeft'] ? 3.0 : 6.4);

    // desired movement dir in local space
    let fwd = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    let str = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    const dir = new THREE.Vector3();
    // camera forward on XZ plane
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    camDir.y = 0; camDir.normalize();
    const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
    dir.addScaledVector(camDir, fwd).addScaledVector(right, str);
    if (dir.lengthSq() > 0) dir.normalize();

    // acceleration toward desired velocity (horizontal)
    const targetVx = dir.x * speed;
    const targetVz = dir.z * speed;
    const accel = this.onGround ? 14 : 4;
    this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, accel * dt);
    this.velocity.z += (targetVz - this.velocity.z) * Math.min(1, accel * dt);

    // jump + gravity
    if (this.keys['Space'] && this.onGround) {
      this.velocity.y = 7.2;
      this.onGround = false;
    }
    this.velocity.y -= 22 * dt;

    // integrate
    const next = obj.position.clone();
    next.x += this.velocity.x * dt;
    next.z += this.velocity.z * dt;

    // crouch smoothing
    this.targetEye = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eyeHeight += (this.targetEye - this.eyeHeight) * Math.min(1, 12 * dt);

    // collide horizontally (feet .. head span)
    const feet = next.y - this.eyeHeight;
    this.map.resolveCollision(next, 0.4, feet, next.y);

    // vertical
    next.y += this.velocity.y * dt;
    const floorY = this.eyeHeight;
    if (next.y <= floorY) {
      next.y = floorY;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    obj.position.copy(next);
    this.position.copy(next);
    this.airborne = !this.onGround;

    // horizontal speed for viewmodel + headbob + footsteps
    const hv = Math.hypot(this.velocity.x, this.velocity.z);
    this.speedScalar = Math.min(1, hv / 6.4);
    if (this.onGround && hv > 1.0) {
      this.stepDist += hv * dt;
      const stride = this.crouching ? 2.6 : 2.0;
      if (this.stepDist > stride) { this.stepDist = 0; this.audio.footstep(); }
    }
  }

  moveState() {
    return { speed: this.speedScalar, airborne: this.airborne, crouching: this.crouching };
  }

  dispose() {
    document.removeEventListener('keydown', this._kd);
    document.removeEventListener('keyup', this._ku);
  }
}
