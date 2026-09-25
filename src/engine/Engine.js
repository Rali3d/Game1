import * as THREE from 'three';

// Owns the renderer, scene, camera and main loop. Game logic registers via onUpdate().
export class Engine {
  constructor(container) {
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1500);
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.updaters = [];

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
  }

  onUpdate(fn) {
    this.updaters.push(fn);
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      // Clamp dt so a background tab doesn't teleport everything on return.
      const dt = Math.min(this.clock.getDelta(), 1 / 20);
      this.elapsed += dt;
      for (const fn of this.updaters) fn(dt, this.elapsed);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
