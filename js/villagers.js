/* ================================================================
   村民 NPC：围绕村庄随机漫步（仅主世界）
================================================================ */
import * as THREE from 'three';
import { villages, moveEntity } from './world.js';
import { scene } from './renderer.js';

export const villagers = [];
const SKIN = 0xd8a06a, ROBE = 0x7a3a2a;
const IRON = 0xc8ccd4, GOLD = 0xffe27a;

function makeVillagerMesh(v) {
  const g = new THREE.Group();
  const M = c => new THREE.MeshLambertMaterial({ color: c });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M(SKIN));
  head.position.y = 1.5;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.4), M(ROBE));
  body.position.y = 0.85;
  g.add(head, body);
  // 战士装备：铁盔 + 胸甲
  const helm = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), M(IRON));
  helm.position.y = 1.8;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.4, 0.44), M(IRON));
  chest.position.y = 1.08;
  g.add(helm, chest);
  // 手中武器：剑（右手侧，随朝向转动）
  const metal = Math.random() < 0.25 ? GOLD : IRON;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), M(0x6b4a2a));
  grip.position.set(0.42, 0.95, 0);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.42), M(metal));
  blade.position.set(0.42, 1.08, 0.2);
  g.add(grip, blade);
  g.position.copy(v.pos);
  scene.add(g);
  return g;
}

export function spawnVillagers() {
  for (const v of villages) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const ent = {
        pos: new THREE.Vector3(v.x + (Math.random() - 0.5) * 4, v.y, v.z + (Math.random() - 0.5) * 4),
        vel: new THREE.Vector3(), w: 0.6, h: 1.6, onGround: false, impact: 0,
        yaw: Math.random() * 6.28, timer: Math.random() * 3, mesh: null,
      };
      villagers.push(ent);
    }
  }
  for (const v of villagers) v.mesh = makeVillagerMesh(v);
}
export function setVillagersVisible(vis) {
  for (const v of villagers) if (v.mesh) v.mesh.visible = vis;
}
export function updateVillagers(dt) {
  for (const v of villagers) {
    v.timer -= dt;
    if (v.timer <= 0) {
      v.timer = 2 + Math.random() * 3;
      v.vel.x = (Math.random() - 0.5) * 2;
      v.vel.z = (Math.random() - 0.5) * 2;
      v.yaw = Math.atan2(v.vel.x, v.vel.z);
    }
    v.vel.y -= 24 * dt;
    moveEntity(v, dt);
    if (v.pos.y < 1.5) { v.pos.y = 1.5; v.vel.y = 0; }
    if (v.mesh) { v.mesh.position.copy(v.pos); v.mesh.rotation.y = v.yaw; }
  }
}
