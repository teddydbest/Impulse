import * as THREE from 'three';

export class Portal {
  constructor(parentGroup, position, rotationY, targetRoom, label, accentColor = 0x4466ff) {
    this.position = position.clone();
    this.targetRoom = targetRoom;
    this.label = label;
    this.accentColor = accentColor;
    this._time = 0;
    this.triggerRadius = 1.4;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotationY;
    this._build(accentColor);
    parentGroup.add(this.mesh);
  }

  _build(color) {
    // Outer frame (dark wood/metal)
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x1a1420 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.12), frameMat);
    this.mesh.add(frame);

    // Inner bevel
    const bevelMat = new THREE.MeshLambertMaterial({ color: 0x2a2040 });
    const bevel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.1, 0.08), bevelMat);
    bevel.position.z = 0.03;
    this.mesh.add(bevel);

    // Portal surface — glowing pane
    this._portalMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
    });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.9), this._portalMat);
    pane.position.z = 0.07;
    this.mesh.add(pane);

    // Interior "depth" glow (lighter center gradient illusion)
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
    });
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), innerMat);
    inner.position.z = 0.08;
    this.mesh.add(inner);

    // Scanline texture overlay
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 16, 64);
    for (let y = 0; y < 64; y += 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, y, 16, 2);
    }
    const scanTex = new THREE.CanvasTexture(cv);
    scanTex.wrapS = scanTex.wrapT = THREE.RepeatWrapping;
    scanTex.repeat.set(1, 6);
    const scanMat = new THREE.MeshBasicMaterial({
      map: scanTex, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    const scan = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.9), scanMat);
    scan.position.z = 0.09;
    this.mesh.add(scan);

    // Corner accent lights (small emissive boxes)
    const accentMat = new THREE.MeshBasicMaterial({ color });
    const corners = [[-0.88, 1.3], [0.88, 1.3], [-0.88, -1.3], [0.88, -1.3]];
    corners.forEach(([cx, cy]) => {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12), accentMat);
      corner.position.set(cx, cy, 0.06);
      this.mesh.add(corner);
    });
  }

  update(delta) {
    this._time += delta;
    const pulse = 0.5 + 0.5 * Math.sin(this._time * 2.2);
    this._portalMat.opacity = 0.45 + pulse * 0.3;
  }

  isPlayerInside(pos) {
    return pos.distanceTo(this.position) < this.triggerRadius;
  }

  // For raycasting interaction hints (player looks at portal)
  onInteract() {
    // Handled by proximity walk-through
  }
}
