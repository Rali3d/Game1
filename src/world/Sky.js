import * as THREE from 'three';
import { smoothstep } from '../engine/math.js';

const C = (hex) => new THREE.Color(hex);
const PAL = {
  dayTop: C(0x3f7fd6), dayHorizon: C(0xbcd9f2),
  duskTop: C(0x2c3f78), duskHorizon: C(0xf29a5c),
  nightTop: C(0x03060f), nightHorizon: C(0x101a33),
  ground: C(0x2e3b24),
  hemiDay: C(0xcfe3ff), hemiNight: C(0x33406b),
};

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 topColor, horizonColor, bottomColor, sunDir, sunColor;
  uniform float sunVis, moonVis;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0
      ? mix(horizonColor, topColor, pow(smoothstep(0.0, 1.0, h), 0.6))
      : mix(horizonColor, bottomColor, smoothstep(0.0, -0.25, h));
    float s = max(dot(d, sunDir), 0.0);
    col += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 10.0) * 0.28) * sunVis;
    float m = max(dot(d, -sunDir), 0.0);
    col += vec3(0.85, 0.9, 1.0) * (pow(m, 2400.0) * 3.0 + pow(m, 60.0) * 0.06) * moonVis;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// Gradient sky dome + sun/moon, stars and a full day/night lighting cycle.
export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.29; // 0..1 of a day; 0.25 is sunrise. We wake just after dawn.
    this.dayLength = 540; // seconds for a full day
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.daylight = 1;

    this.uniforms = {
      topColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      bottomColor: { value: PAL.ground.clone() },
      sunDir: { value: this.sunDir },
      sunColor: { value: new THREE.Color(1, 0.9, 0.7) },
      sunVis: { value: 1 },
      moonVis: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader,
      side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.stars = this.createStars();
    scene.add(this.stars);

    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 2.6));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 320 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a4a2a, 1.0);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xbcd9f2, 80, 330);
  }

  createStars() {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      do v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      while (v.lengthSq() > 1 || v.y < -0.05);
      v.normalize().multiplyScalar(800);
      positions.set([v.x, v.y, v.z], i * 3);
      const b = 0.4 + Math.random() * 0.6;
      colors.set([b, b, b * (0.9 + Math.random() * 0.2)], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true,
      opacity: 0, depthWrite: false, fog: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  get hours() {
    return (this.time * 24) % 24;
  }

  get isNight() {
    return this.daylight < 0.25;
  }

  // Returns true when the clock wraps past midnight (a new day starts).
  update(dt, focus, camera) {
    const prev = this.time;
    this.time = (this.time + dt / this.dayLength) % 1;
    const a = (this.time - 0.25) * Math.PI * 2;
    this.sunDir.set(Math.cos(a), Math.sin(a), -0.35).normalize();
    this.moonDir.copy(this.sunDir).negate();
    const e = this.sunDir.y;
    const day = smoothstep(-0.12, 0.28, e);
    const dusk = 1 - smoothstep(0.0, 0.32, Math.abs(e - 0.02));
    this.daylight = day;

    const u = this.uniforms;
    u.topColor.value.copy(PAL.nightTop).lerp(PAL.dayTop, day).lerp(PAL.duskTop, dusk * 0.35);
    u.horizonColor.value.copy(PAL.nightHorizon).lerp(PAL.dayHorizon, day).lerp(PAL.duskHorizon, dusk * 0.75);
    u.sunVis.value = smoothstep(-0.08, 0.02, e);
    u.moonVis.value = smoothstep(0.0, -0.12, e);
    u.sunColor.value.setRGB(1, 0.75 + 0.2 * day, 0.5 + 0.4 * day);

    // One shadow-casting key light: the sun by day, the moon by night.
    const sunI = 2.8 * smoothstep(-0.04, 0.22, e);
    const moonI = 0.55 * smoothstep(0.0, -0.18, e);
    const useSun = sunI >= moonI;
    this.sun.intensity = Math.max(sunI, moonI);
    if (useSun) this.sun.color.setRGB(1, 0.78 + 0.2 * day, 0.6 + 0.35 * day);
    else this.sun.color.setRGB(0.55, 0.65, 1.0);
    this.sun.position.copy(focus).addScaledVector(useSun ? this.sunDir : this.moonDir, 150);
    this.sun.target.position.copy(focus);

    this.hemi.intensity = 0.3 + 0.9 * day;
    this.hemi.color.copy(PAL.hemiNight).lerp(PAL.hemiDay, day);

    const fog = this.scene.fog;
    fog.color.copy(u.horizonColor.value);
    fog.near = 50 + 40 * day;
    fog.far = 210 + 140 * day;

    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.stars.rotation.y = this.time * Math.PI * 2 * 0.25;
    this.stars.material.opacity = 1 - smoothstep(-0.2, 0.05, e);

    return this.time < prev;
  }
}
