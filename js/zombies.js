import * as THREE from 'three';
import { WATER } from './constants.js';
import { getBlock, isSolid, moveEntity, surfaceY } from './world.js';
import { sfx } from './audio.js';
import { player, damagePlayer } from './player.js';
import { scene, burst, dropHeart, isDay } from './renderer.js';

/* ================================================================
   怪物系统：僵尸（近战）/ 骷髅（射箭）/ 蜘蛛（快速跳跃）/ 苦力怕（爆炸）
================================================================ */
export const zombies = [];
export const zombieBoxes = [];
export const boneProjectiles = [];   // 骷髅箭矢

export let peaceful = false;
export function setPeaceful(b) {
  peaceful = !!b;
  if (peaceful) {
    for (let i = zombies.length - 1; i >= 0; i--) zombies[i].dispose();
    boneProjectiles.length = 0;
  }
}

const TYPES = {
  zombie:  { hp: 10, speed: 2.35, dmg: 3,  atkRange: 1.3, atkCd: 1.0, burns: true,  scale: 1 },
  skeleton:{ hp: 8,  speed: 2.2,  dmg: 2,  atkRange: 22,  atkCd: 2.2, burns: false, scale: 1 },
  spider:  { hp: 8,  speed: 4.2,  dmg: 2,  atkRange: 1.4, atkCd: 0.9, burns: false, scale: 1.1 },
  creeper: { hp: 12, speed: 1.25, dmg: 8,  atkRange: 2.2, atkCd: 999, burns: true,  scale: 1 },
};

class Zombie {
  constructor(x, y, z, type = 'zombie') {
    this.type = type;
    const T = TYPES[type];
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.w = 0.6; this.h = 1.95;
    this.hp = T.hp;
    this.onGround = false; this.impact = 0;
    this.attackCd = 0; this.flash = 0; this.walk = Math.random() * 6;
    this.wanderA = Math.random() * Math.PI * 2; this.wanderT = 0;
    this.groanT = 2 + Math.random() * 6;
    this.speed = 0;
    this.fuseT = 0;              // 苦力怕引信
    this.shootT = 1 + Math.random() * 1.5;

    this.buildMesh();
  }

  buildMesh() {
    const t = this.type;
    const M = c => new THREE.MeshLambertMaterial({ color: c });
    const g = new THREE.Group();
    const box = (w, h, d, mat, px, py, pz, pivotTop = false) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      if (pivotTop) geo.translate(0, -h / 2, 0);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      g.add(m);
      return m;
    };
    if (t === 'zombie') {
      this.mats = [M(0x4a8f3c), M(0x2a8f7f), M(0x3b3f8c), M(0x1a1a1a)];
      this.legL = box(0.24, 0.75, 0.24, this.mats[2], -0.14, 0.75, 0, true);
      this.legR = box(0.24, 0.75, 0.24, this.mats[2],  0.14, 0.75, 0, true);
      box(0.55, 0.7, 0.3, this.mats[1], 0, 1.1, 0);
      this.armL = box(0.18, 0.62, 0.18, this.mats[0], -0.37, 1.42, 0, true);
      this.armR = box(0.18, 0.62, 0.18, this.mats[0],  0.37, 1.42, 0, true);
      box(0.52, 0.52, 0.52, this.mats[0], 0, 1.71, 0);
      box(0.09, 0.09, 0.05, this.mats[3], -0.11, 1.76, 0.26);
      box(0.09, 0.09, 0.05, this.mats[3],  0.11, 1.76, 0.26);
    } else if (t === 'skeleton') {
      this.mats = [M(0xe8e4da), M(0xc8c4ba), M(0xb8b4aa), M(0x1a1a1a)];
      this.legL = box(0.2, 0.8, 0.2, this.mats[2], -0.12, 0.75, 0, true);
      this.legR = box(0.2, 0.8, 0.2, this.mats[2],  0.12, 0.75, 0, true);
      box(0.5, 0.62, 0.26, this.mats[1], 0, 1.12, 0);
      this.armL = box(0.16, 0.6, 0.16, this.mats[1], -0.33, 1.42, 0, true);
      this.armR = box(0.16, 0.6, 0.16, this.mats[1],  0.33, 1.42, 0, true);
      box(0.5, 0.5, 0.5, this.mats[0], 0, 1.72, 0);
      box(0.09, 0.09, 0.05, this.mats[3], -0.1, 1.78, 0.25);
      box(0.09, 0.09, 0.05, this.mats[3],  0.1, 1.78, 0.25);
    } else if (t === 'spider') {
      this.mats = [M(0x3a1f3a), M(0x2a152a), M(0xcf2020), M(0x1a0a1a)];
      const body = box(0.7, 0.5, 1.0, this.mats[0], 0, 1.1, 0);
      box(0.6, 0.45, 0.5, this.mats[1], 0, 1.42, 0.35);   // 头
      box(0.1, 0.1, 0.05, this.mats[2], -0.15, 1.48, 0.6);
      box(0.1, 0.1, 0.05, this.mats[2],  0.15, 1.48, 0.6);
      // 8 条腿
      this.legs = [];
      for (let i = 0; i < 4; i++) {
        const s = i < 2 ? -1 : 1;
        const zz = i % 2 === 0 ? 0.4 : -0.3;
        this.legs.push(box(0.08, 0.5, 0.08, this.mats[1], -0.5 * s, 1.25, zz, true));
        this.legs.push(box(0.08, 0.5, 0.08, this.mats[1],  0.5 * s, 1.25, zz, true));
      }
      this.body = body;
    } else { // creeper
      this.mats = [M(0x3f8f2f), M(0x2f7a22), M(0x1a1a1a), M(0x5faf3f)];
      this.legL = box(0.28, 0.7, 0.28, this.mats[2], -0.2, 0.7, 0, true);
      this.legR = box(0.28, 0.7, 0.28, this.mats[2],  0.2, 0.7, 0, true);
      box(0.56, 0.7, 0.34, this.mats[0], 0, 1.08, 0);
      box(0.5, 0.5, 0.3, this.mats[1], 0, 1.62, 0);
      // 苦力怕前腿（原版 4 条腿）
      this.armL = box(0.28, 0.62, 0.28, this.mats[2], -0.2, 1.08, 0.16, true);
      this.armR = box(0.28, 0.62, 0.28, this.mats[2],  0.2, 1.08, 0.16, true);
      // 苦力怕标志脸
      box(0.1, 0.1, 0.06, this.mats[3], -0.12, 1.62, 0.16);
      box(0.1, 0.1, 0.06, this.mats[3],  0.12, 1.62, 0.16);
      box(0.24, 0.1, 0.06, this.mats[3], 0, 1.44, 0.16);
    }
    this.group = g;
    scene.add(g);

    this.hitbox = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1),
                                 new THREE.MeshBasicMaterial({ visible: false }));
    this.hitbox.userData.zombie = this;
    scene.add(this.hitbox);
    zombieBoxes.push(this.hitbox);
    this.group.position.copy(this.pos);
    this.hitbox.position.set(this.pos.x, this.pos.y + 1, this.pos.z);
  }

  damage(amount, fromDir) {
    this.hp -= amount;
    this.flash = 0.12;
    this.mats.forEach(m => m.emissive.setHex(0xaa0000));
    if (fromDir) {
      this.vel.x += fromDir.x * 7; this.vel.z += fromDir.z * 7; this.vel.y += 3.5;
    }
    sfx.zhit();
    if (this.hp <= 0) this.die();
  }

  die() {
    const col = { zombie: 0x4a8f3c, skeleton: 0xe8e4da, spider: 0x3a1f3a, creeper: 0x3f8f2f }[this.type] || 0x777777;
    burst(this.pos.x, this.pos.y + 1, this.pos.z, col, 16, 4, 4);
    burst(this.pos.x, this.pos.y + 1, this.pos.z, 0x7a1f1f, 8, 3, 3);
    sfx.zdie();
    if (Math.random() < 0.4) dropHeart(this.pos.x, this.pos.y + 0.6, this.pos.z);
    this.dispose();
  }

  dispose() {
    scene.remove(this.group);
    scene.remove(this.hitbox);
    const hi = zombieBoxes.indexOf(this.hitbox);
    if (hi >= 0) zombieBoxes.splice(hi, 1);
    const zi = zombies.indexOf(this);
    if (zi >= 0) zombies.splice(zi, 1);
  }

  explode() {
    const d = this.pos.distanceTo(player.pos);
    if (d < 4.5 && !player.dead) {
      const kb = new THREE.Vector3().subVectors(player.pos, this.pos).normalize();
      kb.y = 0.35;
      damagePlayer(this.fuseT >= 0 ? 8 : 6, kb, 'creeper');
    }
    burst(this.pos.x, this.pos.y + 1, this.pos.z, 0xffcf5f, 26, 6, 5);
    burst(this.pos.x, this.pos.y + 1, this.pos.z, 0x8a5f2a, 16, 4, 4);
    sfx.zdie();
    this.dispose();
  }

  update(dt) {
    const T = TYPES[this.type];
    // 白天燃烧（仅僵尸/苦力怕）
    if (T.burns && isDay && !this.inWater()) {
      this.hp -= 2.2 * dt;
      if (Math.random() < dt * 6) burst(this.pos.x, this.pos.y + 1.9, this.pos.z, 0x555555, 1, 0.6, 1.2, 0.12, 0.8);
      if (this.hp <= 0) { this.die(); return; }
    }
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) this.mats.forEach(m => m.emissive.setHex(0x000000));
    }

    const toPlayer = new THREE.Vector3().subVectors(player.pos, this.pos);
    const distH = Math.hypot(toPlayer.x, toPlayer.z);
    let dirX = 0, dirZ = 0;
    this.speed = 0;
    const aggro = T.atkRange > 5 ? 26 : 18;   // 骷髅在更远处索敌
    if (distH < aggro && !player.dead) {
      dirX = toPlayer.x / (distH || 1); dirZ = toPlayer.z / (distH || 1);
      // 骷髅保持距离射箭
      if (this.type === 'skeleton' && distH < 6) { dirX = -dirX; dirZ = -dirZ; }
      this.speed = T.speed;
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 1.5 + Math.random() * 3;
        this.wanderA = Math.random() * Math.PI * 2;
        this.idle = Math.random() < 0.35;
      }
      if (!this.idle) {
        dirX = Math.sin(this.wanderA); dirZ = Math.cos(this.wanderA);
        this.speed = 1.0;
      }
    }
    this.vel.x = dirX * this.speed;
    this.vel.z = dirZ * this.speed;

    if (this.inWater()) {
      this.vel.y -= 8 * dt;
      this.vel.y += 14 * dt;
      this.vel.y = Math.max(-3, Math.min(2.5, this.vel.y));
    } else {
      this.vel.y -= 30 * dt;
      if (this.vel.y < -50) this.vel.y = -50;
    }

    // 追击时跳过 1 格障碍（蜘蛛跳得更远）
    if (this.onGround && this.speed > 0) {
      const ax = Math.floor(this.pos.x + dirX * (this.w / 2 + 0.35));
      const az = Math.floor(this.pos.z + dirZ * (this.w / 2 + 0.35));
      const fy = Math.floor(this.pos.y);
      if (isSolid(ax, fy, az) && !isSolid(ax, fy + 1, az) && !isSolid(ax, fy + 2, az))
        this.vel.y = this.type === 'spider' ? 10.5 : 8.5;
    }
    moveEntity(this, dt);

    // 攻击
    this.attackCd -= dt;
    if (this.type === 'skeleton') {
      this.shootT -= dt;
      if (!player.dead && distH < 24 && this.shootT <= 0) {
        this.shootT = 2.2;
        const from = new THREE.Vector3(this.pos.x, this.pos.y + 1.6, this.pos.z);
        const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z);
        const vel = to.sub(from).normalize().multiplyScalar(11);
        boneProjectiles.push({ pos: from, vel, life: 3 });
        sfx.zhit();
      }
    } else if (this.type === 'creeper') {
      if (!player.dead && distH < T.atkRange + 0.4) {
        this.fuseT += dt;
        this.mats.forEach(m => m.emissive.setHex(0xffffff));
        if (this.fuseT > 0.9) this.explode();
      } else {
        this.fuseT = Math.max(0, this.fuseT - dt * 2);
        if (this.fuseT <= 0) this.mats.forEach(m => m.emissive.setHex(0x000000));
      }
    } else {
      if (!player.dead && this.attackCd <= 0) {
        const d3 = Math.sqrt(distH * distH + Math.pow((player.pos.y + 1) - (this.pos.y + 1), 2));
        if (distH < T.atkRange && d3 < 2.4) {
          this.attackCd = T.atkCd;
          const kb = new THREE.Vector3(toPlayer.x / (distH || 1), 0, toPlayer.z / (distH || 1));
          damagePlayer(T.dmg, kb, this.type === 'zombie' ? 'zombie' : 'spider');
        }
      }
    }

    // 低吼
    this.groanT -= dt;
    if (this.groanT <= 0) {
      this.groanT = 4 + Math.random() * 7;
      if (distH < 24) sfx.groan(Math.max(0.05, 0.5 - distH * 0.02));
    }

    // 动画
    this.walk += dt * (2 + this.speed * 2.2);
    const sw = Math.sin(this.walk * 3) * (this.speed > 0 ? 0.55 : 0.05);
    if (this.type === 'spider') {
      this.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.walk * 4 + i) * 0.5; });
      this.body.rotation.x = Math.sin(this.walk * 2) * 0.08;
    } else {
      this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
      this.armL.rotation.x = -1.45 + sw * 0.25;
      this.armR.rotation.x = -1.45 - sw * 0.25;
    }
    if (this.speed > 0.01) this.group.rotation.y = Math.atan2(dirX, dirZ);
    this.group.position.copy(this.pos);
    this.hitbox.position.set(this.pos.x, this.pos.y + 1, this.pos.z);
  }

  inWater() {
    return getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z)) === WATER;
  }
}

export { Zombie };

let spawnT = 3;
export function updateSpawner(dt) {
  if (peaceful) return;
  spawnT -= dt;
  if (spawnT > 0) return;
  spawnT = 4;
  if (isDay || zombies.length >= 24 || player.dead) return;
  for (let tries = 0; tries < 5; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = 24 + Math.random() * 18;
    const x = Math.floor(player.pos.x + Math.cos(a) * d);
    const z = Math.floor(player.pos.z + Math.sin(a) * d);
    if (x < 2 || x >= 510 || z < 2 || z >= 510) continue;
    const y = surfaceY(x, z);
    if (y < 2) continue;
    const r = Math.random();
    const type = r < 0.45 ? 'zombie' : r < 0.7 ? 'skeleton' : r < 0.9 ? 'spider' : 'creeper';
    zombies.push(new Zombie(x + 0.5, y + 1.05, z + 0.5, type));
    return;
  }
}

// 骷髅箭矢更新（被 main.js 调用）
export function updateBoneProjectiles(dt) {
  for (let i = boneProjectiles.length - 1; i >= 0; i--) {
    const b = boneProjectiles[i];
    b.life -= dt;
    b.pos.add(b.vel.clone().multiplyScalar(dt));
    b.vel.y -= 12 * dt;
    if (b.life <= 0) { boneProjectiles.splice(i, 1); continue; }
    if (getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y), Math.floor(b.pos.z)) !== 0 ||
        getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.2), Math.floor(b.pos.z)) !== 0) {
      boneProjectiles.splice(i, 1);
      continue;
    }
    if (!player.dead && b.pos.distanceTo(player.pos) < 0.8) {
      damagePlayer(2, b.vel.clone().normalize(), 'skeleton');
      boneProjectiles.splice(i, 1);
    }
  }
}
