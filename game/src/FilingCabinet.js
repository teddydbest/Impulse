import * as THREE from 'three';

const MAT = {
  body:   new THREE.MeshLambertMaterial({ color: 0x5a6070 }),
  dark:   new THREE.MeshLambertMaterial({ color: 0x3a4050 }),
  handle: new THREE.MeshLambertMaterial({ color: 0x9aaabb }),
  label:  new THREE.MeshBasicMaterial({ color: 0xffffcc }),
  tab: (hex) => new THREE.MeshBasicMaterial({ color: hex }),
};

const TAB_COLORS = [0xff4455, 0x44aaff, 0x44ee88, 0xffaa44, 0xff44cc, 0x44ffff, 0xbbff44];

export class FilingCabinet {
  constructor(parentGroup, position, rotation = 0, category = 'all', fileManager) {
    this.parentGroup = parentGroup;
    this.position = position.clone();
    this.category = category;
    this.fileManager = fileManager;
    this.isOpen = false;

    // Drawer animation state
    this._drawerZ = 0;      // current draw extension (world units)
    this._drawerTarget = 0;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotation;
    this._build();
    parentGroup.add(this.mesh);

    // Axis-aligned collider (world space, approximate)
    const hw = 0.55, hd = 0.5, h = 1.85;
    this.collider = new THREE.Box3(
      new THREE.Vector3(position.x - hw, 0,         position.z - hd),
      new THREE.Vector3(position.x + hw, h,         position.z + hd)
    );
  }

  _build() {
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.8), MAT.body);
    body.position.y = 0.9;
    this.mesh.add(body);

    // Top cap
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.04, 0.82), MAT.dark);
    top.position.y = 1.82;
    this.mesh.add(top);

    // Three drawers
    this._drawers = [];
    for (let i = 0; i < 3; i++) {
      const dg = this._makeDrawer(i);
      dg.position.set(0, 0.28 + i * 0.52, 0);
      this.mesh.add(dg);
      this._drawers.push(dg);
    }

    // Label strip (top of cabinet front)
    const lbl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.02), MAT.label);
    lbl.position.set(0, 1.73, 0.42);
    this.mesh.add(lbl);
  }

  _makeDrawer(idx) {
    const group = new THREE.Group();

    // Drawer face
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.46, 0.05), MAT.body);
    face.position.z = 0.38;
    group.add(face);

    // Drawer body (inside)
    const inside = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.40, 0.70), MAT.dark);
    inside.position.z = 0.02;
    group.add(inside);

    // Handle bar
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.04), MAT.handle);
    handle.position.set(0, 0, 0.42);
    group.add(handle);

    // File tabs (hidden until opened)
    this._tabs = this._tabs || [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const tab = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.12, 0.02),
        MAT.tab(TAB_COLORS[i % TAB_COLORS.length])
      );
      tab.position.set(-0.38 + i * 0.15, 0.26, 0.25);
      tab.visible = false;
      group.add(tab);
      if (idx === 0) this._tabs.push(tab);
    }

    // Divider lines on face
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.01, 0.01), MAT.dark);
    divider.position.set(0, -0.22, 0.41);
    group.add(divider);

    return group;
  }

  onInteract() {
    this.isOpen = !this.isOpen;
    this._drawerTarget = this.isOpen ? 0.55 : 0;

    if (this._tabs) {
      this._tabs.forEach(t => { t.visible = this.isOpen; });
    }

    if (this.isOpen) {
      this.fileManager.openCabinetUI(this);
    } else {
      this.fileManager.closeCabinetUI();
    }
  }

  forceClose() {
    if (this.isOpen) {
      this.isOpen = false;
      this._drawerTarget = 0;
      if (this._tabs) this._tabs.forEach(t => { t.visible = false; });
    }
  }

  update(delta) {
    if (!this._drawers[0]) return;
    const speed = 6;
    this._drawerZ += (this._drawerTarget - this._drawerZ) * delta * speed;
    this._drawers[0].position.z = this._drawerZ;
  }

  getCollider() { return this.collider; }
}
