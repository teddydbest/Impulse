import * as THREE from 'three';
import { FilingCabinet } from './FilingCabinet.js';
import { Portal } from './Portal.js';
import { checkerTex, brickTex, woodTex } from './TextureGenerator.js';

const ROOM_DEFS = {
  hub: {
    name: 'HUB',
    w: 22, h: 4.2, d: 22,
    spawn: [0, 1.7, 7],
    floorC: '#181828', floorC2: '#141420',
    wallC: '#242438', wallC2: '#1a1a2c',
    ceilC: 0x0e0e1c,
    ambientC: 0x181830, ambientI: 0.6,
    lights: [
      { color: 0xffd080, intensity: 2.5, dist: 18, pos: [0, 3.8, 0] },
      { color: 0x6688ff, intensity: 1.2, dist: 10, pos: [-6, 3.6, -6] },
      { color: 0xff8844, intensity: 0.8, dist: 8,  pos: [6, 3.6, 6] },
    ],
  },
  gallery: {
    name: 'PHOTO GALLERY',
    w: 22, h: 4.2, d: 24,
    spawn: [0, 1.7, 4],
    floorC: '#1c1c2e', floorC2: '#161628',
    wallC: '#343450', wallC2: '#282840',
    ceilC: 0x101020,
    ambientC: 0x202040, ambientI: 0.5,
    lights: [
      { color: 0xaabbff, intensity: 2.5, dist: 16, pos: [0, 3.8, -4] },
      { color: 0x8899ff, intensity: 1.5, dist: 10, pos: [-6, 3.8, 4] },
      { color: 0x8899ff, intensity: 1.5, dist: 10, pos: [6, 3.8, 4] },
    ],
  },
  theater: {
    name: 'VIDEO THEATER',
    w: 18, h: 4.5, d: 22,
    spawn: [0, 1.7, 6],
    floorC: '#0a0a14', floorC2: '#080810',
    wallC: '#18181e', wallC2: '#111118',
    ceilC: 0x060608,
    ambientC: 0x100010, ambientI: 0.3,
    lights: [
      { color: 0xff2020, intensity: 1.2, dist: 8,  pos: [-5, 3.5, -7] },
      { color: 0xff2020, intensity: 1.2, dist: 8,  pos: [5, 3.5, -7] },
      { color: 0x2020ff, intensity: 0.8, dist: 10, pos: [0, 3.5, 6] },
    ],
  },
  archive: {
    name: 'DOCUMENT ARCHIVE',
    w: 22, h: 4.2, d: 26,
    spawn: [0, 1.7, 9],
    floorC: '#1a1208', floorC2: '#140e06',
    wallC: '#2c2010', wallC2: '#241808',
    ceilC: 0x100c04,
    ambientC: 0x201808, ambientI: 0.5,
    lights: [
      { color: 0xffaa40, intensity: 2.0, dist: 12, pos: [-4, 3.8, -6] },
      { color: 0xffaa40, intensity: 2.0, dist: 12, pos: [4, 3.8, -6] },
      { color: 0xffaa40, intensity: 1.5, dist: 10, pos: [0, 3.8, 4] },
    ],
  },
};

export class World {
  constructor(scene, fileManager) {
    this.scene = scene;
    this.fileManager = fileManager;
    this.currentRoom = 'hub';

    this._groups    = {};   // roomId -> THREE.Group
    this._cabinets  = {};   // roomId -> FilingCabinet[]
    this._portals   = {};   // roomId -> Portal[]
    this._colliders = {};   // roomId -> THREE.Box3[]
    this._ambients  = {};   // roomId -> THREE.AmbientLight
    this._pointLights = {}; // roomId -> THREE.PointLight[]

    this._galleryFrames = [];
    this._theaterScreen = null;
    this._activeVideo   = null;

    this._transitionCooldown = 0;
  }

  build() {
    this._buildHub();
    this._buildGallery();
    this._buildTheater();
    this._buildArchive();
    this.activateRoom('hub');
  }

  // ─── Room activation ─────────────────────────────────────────
  activateRoom(id) {
    Object.entries(this._groups).forEach(([rid, g]) => { g.visible = rid === id; });

    // Swap ambient
    Object.entries(this._ambients).forEach(([rid, a]) => { a.visible = rid === id; });

    this.currentRoom = id;
    this._transitionCooldown = 2.5; // seconds before portals can trigger

    if (id === 'gallery') this._refreshGallery();
    if (id === 'theater') this._refreshTheater();
  }

  getRoomName(id) { return ROOM_DEFS[id]?.name ?? id.toUpperCase(); }

  getSpawn(id) {
    const d = ROOM_DEFS[id];
    return d ? new THREE.Vector3(...d.spawn) : new THREE.Vector3(0, 1.7, 5);
  }

  // ─── Per-frame ───────────────────────────────────────────────
  update(delta) {
    this._transitionCooldown = Math.max(0, this._transitionCooldown - delta);

    const cabs = this._cabinets[this.currentRoom] || [];
    cabs.forEach(c => c.update(delta));

    const portals = this._portals[this.currentRoom] || [];
    portals.forEach(p => p.update(delta));
  }

  checkPortal(playerPos) {
    if (this._transitionCooldown > 0) return null;
    const portals = this._portals[this.currentRoom] || [];
    return portals.find(p => p.isPlayerInside(playerPos)) ?? null;
  }

  getColliders()    { return this._colliders[this.currentRoom]  || []; }
  getInteractables() {
    return [
      ...(this._cabinets[this.currentRoom] || []),
      ...(this._portals[this.currentRoom]  || []),
    ];
  }

  // ─── Room builders ───────────────────────────────────────────
  _buildHub() {
    const id = 'hub';
    const def = ROOM_DEFS[id];
    const g = this._makeGroup(id);

    this._buildShell(g, id, def);

    // Filing cabinets (general / all)
    const cabs = [
      new FilingCabinet(g, new THREE.Vector3(-7,  0, 9.5), 0,        'all', this.fileManager),
      new FilingCabinet(g, new THREE.Vector3(-4.5,0, 9.5), 0,        'all', this.fileManager),
      new FilingCabinet(g, new THREE.Vector3(-2,  0, 9.5), 0,        'all', this.fileManager),
    ];
    this._cabinets[id] = cabs;

    // Desk + chair
    this._addDesk(g, 4, 0, 3);
    this._addChair(g, 4, 0, 4.8);

    // Rug
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 5),
      new THREE.MeshLambertMaterial({ color: 0x7a1a3a })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(3, 0.01, 3);
    g.add(rug);

    // Portals
    const portals = [
      // West wall → gallery
      new Portal(g, new THREE.Vector3(-10.4, 1.8, -1), Math.PI / 2,
                 'gallery', 'PHOTO GALLERY', 0x44aaff),
      // East wall → theater
      new Portal(g, new THREE.Vector3(10.4, 1.8, -1), -Math.PI / 2,
                 'theater', 'VIDEO THEATER', 0xff3344),
      // North wall → archive
      new Portal(g, new THREE.Vector3(0, 1.8, -10.4), 0,
                 'archive', 'DOCUMENT ARCHIVE', 0x44ee88),
    ];
    this._portals[id] = portals;

    // Colliders: four walls (Box3 in local-to-room coords – they're static so local == world here)
    this._colliders[id] = this._makeWallColliders(def.w, def.h, def.d);

    // Cabinet colliders
    cabs.forEach(c => this._colliders[id].push(c.getCollider()));
  }

  _buildGallery() {
    const id = 'gallery';
    const def = ROOM_DEFS[id];
    const g = this._makeGroup(id);

    this._buildShell(g, id, def);

    // Filing cabinet — images only
    const cabs = [
      new FilingCabinet(g, new THREE.Vector3(-9, 0, 9.5), 0, 'image', this.fileManager),
    ];
    this._cabinets[id] = cabs;

    // Photo frames on walls
    this._galleryFrames = [];
    const frameSlots = [
      // West wall (x = -10)
      { pos: [-9.6, 2.2, -6], ry: Math.PI / 2 },
      { pos: [-9.6, 2.2,  0], ry: Math.PI / 2 },
      { pos: [-9.6, 2.2,  6], ry: Math.PI / 2 },
      // East wall
      { pos: [ 9.6, 2.2, -6], ry: -Math.PI / 2 },
      { pos: [ 9.6, 2.2,  0], ry: -Math.PI / 2 },
      { pos: [ 9.6, 2.2,  6], ry: -Math.PI / 2 },
      // North wall
      { pos: [-4, 2.2, -11.5], ry: 0 },
      { pos: [ 0, 2.2, -11.5], ry: 0 },
      { pos: [ 4, 2.2, -11.5], ry: 0 },
    ];
    frameSlots.forEach(({ pos, ry }) => {
      const frame = this._makePhotoFrame(g, pos, ry);
      this._galleryFrames.push(frame);
    });

    // Return portal — south wall
    this._portals[id] = [
      new Portal(g, new THREE.Vector3(0, 1.8, 11.4), Math.PI, 'hub', 'HUB', 0xffcc44),
    ];

    this._colliders[id] = this._makeWallColliders(def.w, def.h, def.d);
    cabs.forEach(c => this._colliders[id].push(c.getCollider()));
  }

  _buildTheater() {
    const id = 'theater';
    const def = ROOM_DEFS[id];
    const g = this._makeGroup(id);

    this._buildShell(g, id, def);

    // Screen (north wall)
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x080808 });
    this._theaterScreen = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.6), screenMat);
    this._theaterScreen.position.set(0, 3.0, -10.8);
    g.add(this._theaterScreen);

    // Screen frame
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x080808 });
    const sFrame = new THREE.Mesh(new THREE.BoxGeometry(10.4, 6.0, 0.15), frameMat);
    sFrame.position.set(0, 3.0, -10.9);
    g.add(sFrame);

    // Red neon border around screen
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    [
      { geo: [10.6, 0.06, 0.06], pos: [0,  6.0, -10.8] },
      { geo: [10.6, 0.06, 0.06], pos: [0,  0.0, -10.8] },
      { geo: [0.06, 6.0,  0.06], pos: [-5.3, 3.0, -10.8] },
      { geo: [0.06, 6.0,  0.06], pos: [ 5.3, 3.0, -10.8] },
    ].forEach(({ geo, pos }) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...geo), neonMat);
      m.position.set(...pos);
      g.add(m);
    });

    // Seat rows
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x660020 });
    const seatBackMat = new THREE.MeshLambertMaterial({ color: 0x440018 });
    for (let row = 0; row < 4; row++) {
      for (let col = -3; col <= 3; col++) {
        if (col === 0) continue; // aisle
        const x = col * 1.4;
        const z = 1 + row * 1.8;
        // Seat
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.0), seatMat);
        seat.position.set(x, 0.48, z);
        g.add(seat);
        // Back
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.1), seatBackMat);
        back.position.set(x, 0.9, z - 0.45);
        g.add(back);
        // Legs
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.08),
                                   new THREE.MeshLambertMaterial({ color: 0x222222 }));
        leg.position.set(x, 0.24, z);
        g.add(leg);
      }
    }

    // Cabinet for videos
    const cabs = [
      new FilingCabinet(g, new THREE.Vector3(-7, 0, 8.5), 0, 'video', this.fileManager),
    ];
    this._cabinets[id] = cabs;

    this._portals[id] = [
      new Portal(g, new THREE.Vector3(0, 1.8, 10.4), Math.PI, 'hub', 'HUB', 0xffcc44),
    ];

    this._colliders[id] = this._makeWallColliders(def.w, def.h, def.d);
    cabs.forEach(c => this._colliders[id].push(c.getCollider()));
  }

  _buildArchive() {
    const id = 'archive';
    const def = ROOM_DEFS[id];
    const g = this._makeGroup(id);

    this._buildShell(g, id, def);

    // Grid of filing cabinets — documents
    const cabs = [];
    const cols = [-6, -2, 2, 6];
    const rows = [-8, -2, 4];
    for (const z of rows) {
      for (const x of cols) {
        const c = new FilingCabinet(g, new THREE.Vector3(x, 0, z), 0, 'document', this.fileManager);
        cabs.push(c);
      }
    }

    // Extra row of cabinets along east wall
    for (let z = -8; z <= 4; z += 3) {
      const c = new FilingCabinet(g, new THREE.Vector3(9.5, 0, z), -Math.PI / 2, 'all', this.fileManager);
      cabs.push(c);
    }

    this._cabinets[id] = cabs;

    // Reading table in centre
    this._addDesk(g, 0, 0, 8);
    this._addDesk(g, 0, 0, 9.5);

    this._portals[id] = [
      new Portal(g, new THREE.Vector3(0, 1.8, 12.4), Math.PI, 'hub', 'HUB', 0xffcc44),
    ];

    this._colliders[id] = this._makeWallColliders(def.w, def.h, def.d);
    cabs.forEach(c => this._colliders[id].push(c.getCollider()));
  }

  // ─── Shell (floor / ceiling / walls / lights) ─────────────────
  _buildShell(g, id, def) {
    const { w, h, d, floorC, floorC2, wallC, wallC2, ceilC, ambientC, ambientI, lights } = def;

    // Floor
    const fTex = checkerTex(floorC, floorC2, 10, 128);
    fTex.repeat.set(w / 2.5, d / 2.5);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ map: fTex })
    );
    floor.rotation.x = -Math.PI / 2;
    g.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: ceilC })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = h;
    g.add(ceil);

    // Ceiling tile grid
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.03 });
    for (let xi = -w / 2 + 2; xi < w / 2; xi += 4) {
      for (let zi = -d / 2 + 2; zi < d / 2; zi += 4) {
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), gridMat);
        tile.rotation.x = Math.PI / 2;
        tile.position.set(xi, h - 0.01, zi);
        g.add(tile);
      }
    }

    // Walls
    const wTex = brickTex(wallC, wallC2, 64);
    wTex.repeat.set(w / 3, h / 3);
    const wTexSide = brickTex(wallC, wallC2, 64);
    wTexSide.repeat.set(d / 3, h / 3);

    const wallMat  = new THREE.MeshLambertMaterial({ map: wTex });
    const wallMatS = new THREE.MeshLambertMaterial({ map: wTexSide });

    const walls = [
      { geo: [w, h], pos: [0, h / 2, -d / 2], ry: 0,          mat: wallMat  }, // north
      { geo: [w, h], pos: [0, h / 2,  d / 2], ry: Math.PI,     mat: wallMat  }, // south
      { geo: [d, h], pos: [ w / 2, h / 2, 0], ry: -Math.PI/2,  mat: wallMatS }, // east
      { geo: [d, h], pos: [-w / 2, h / 2, 0], ry:  Math.PI/2,  mat: wallMatS }, // west
    ];
    walls.forEach(({ geo, pos, ry, mat }) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(...geo), mat);
      m.position.set(...pos);
      m.rotation.y = ry;
      g.add(m);
    });

    // Baseboard trim
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x111118 });
    const trimsW = [
      { geo: [w + 0.1, 0.12, 0.06], pos: [0, 0.06, -d / 2 + 0.03] },
      { geo: [w + 0.1, 0.12, 0.06], pos: [0, 0.06,  d / 2 - 0.03] },
    ];
    const trimsD = [
      { geo: [0.06, 0.12, d], pos: [ w / 2 - 0.03, 0.06, 0] },
      { geo: [0.06, 0.12, d], pos: [-w / 2 + 0.03, 0.06, 0] },
    ];
    [...trimsW, ...trimsD].forEach(({ geo, pos }) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...geo), trimMat);
      m.position.set(...pos);
      g.add(m);
    });

    // Ambient
    const ambient = new THREE.AmbientLight(ambientC, ambientI);
    this.scene.add(ambient);
    this._ambients[id] = ambient; // keyed by name temporarily
    // Actually key by id – we'll fix below by re-assigning in build methods

    // Point lights
    lights.forEach(({ color, intensity, dist, pos }) => {
      const pl = new THREE.PointLight(color, intensity, dist);
      pl.position.set(...pos);
      g.add(pl);
    });
  }

  // ─── Photo frames ────────────────────────────────────────────
  _makePhotoFrame(g, pos, ry) {
    const group = new THREE.Group();
    group.position.set(...pos);
    group.rotation.y = ry;

    // Outer frame
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.9, 0.06), frameMat);
    group.add(frame);

    // Mat (inner border)
    const matMesh = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.65, 0.05),
                                   new THREE.MeshLambertMaterial({ color: 0xf0e8d0 }));
    matMesh.position.z = 0.01;
    group.add(matMesh);

    // Canvas (image goes here)
    const canvasMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.45),
      new THREE.MeshBasicMaterial({ color: 0x111111 })
    );
    canvasMesh.position.z = 0.04;
    group.add(canvasMesh);

    group.userData.canvas = canvasMesh;
    g.add(group);
    return group;
  }

  _refreshGallery() {
    const images = this.fileManager.getAll('image');
    const loader = new THREE.TextureLoader();

    this._galleryFrames.forEach((frame, i) => {
      const canvas = frame.userData.canvas;
      if (i < images.length) {
        const img = images[i];
        if (frame.userData.loadedId !== img.id) {
          frame.userData.loadedId = img.id;
          loader.load(img.url, tex => {
            tex.magFilter = THREE.NearestFilter;
            canvas.material = new THREE.MeshBasicMaterial({ map: tex });
          });
        }
      } else {
        if (frame.userData.loadedId) {
          frame.userData.loadedId = null;
          canvas.material = new THREE.MeshBasicMaterial({ color: 0x111111 });
        }
      }
    });
  }

  _refreshTheater() {
    const videos = this.fileManager.getAll('video');
    if (videos.length === 0) return;

    // Stop previous
    if (this._activeVideo) {
      this._activeVideo.pause();
      this._activeVideo.src = '';
      this._activeVideo = null;
    }

    const v = document.createElement('video');
    v.src = videos[0].url;
    v.loop = true;
    v.muted = true;
    v.crossOrigin = 'anonymous';
    v.play().catch(() => {});

    const tex = new THREE.VideoTexture(v);
    tex.magFilter = THREE.NearestFilter;
    this._theaterScreen.material = new THREE.MeshBasicMaterial({ map: tex });
    this._activeVideo = v;
  }

  // ─── Geometry helpers ────────────────────────────────────────
  _makeGroup(id) {
    const g = new THREE.Group();
    this._groups[id] = g;
    this.scene.add(g);
    return g;
  }

  _makeWallColliders(w, h, d) {
    const hw = w / 2, hd = d / 2;
    const t = 0.4; // thickness
    return [
      new THREE.Box3(new THREE.Vector3(-hw - t, 0, -hd), new THREE.Vector3(-hw, h, hd)), // W
      new THREE.Box3(new THREE.Vector3( hw,     0, -hd), new THREE.Vector3( hw + t, h, hd)), // E
      new THREE.Box3(new THREE.Vector3(-hw, 0, -hd - t), new THREE.Vector3( hw, h, -hd)), // N
      new THREE.Box3(new THREE.Vector3(-hw, 0,  hd),     new THREE.Vector3( hw, h,  hd + t)), // S
    ];
  }

  _addDesk(g, x, y, z) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.0),
                               new THREE.MeshLambertMaterial({ color: 0x8b6914 }));
    top.position.set(x, y + 0.82, z);
    g.add(top);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x5a3c12 });
    [[-0.95, -0.42], [0.95, -0.42], [-0.95, 0.42], [0.95, 0.42]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.82, 0.07), legMat);
      leg.position.set(x + lx, y + 0.41, z + lz);
      g.add(leg);
    });
    // Screen prop
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.05),
                                   new THREE.MeshLambertMaterial({ color: 0x111118 }));
    monitor.position.set(x, y + 1.22, z - 0.3);
    g.add(monitor);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.46),
                                  new THREE.MeshBasicMaterial({ color: 0x0a1a3a }));
    screen.position.set(x, y + 1.22, z - 0.27);
    g.add(screen);
  }

  _addChair(g, x, y, z) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x303050 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.07, 0.65), mat);
    seat.position.set(x, y + 0.5, z);
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.06), mat);
    back.position.set(x, y + 0.9, z - 0.3);
    g.add(back);
    const legM = new THREE.MeshLambertMaterial({ color: 0x222230 });
    [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), legM);
      leg.position.set(x + lx, y + 0.25, z + lz);
      g.add(leg);
    });
  }
}
