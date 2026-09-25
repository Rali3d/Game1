import * as THREE from 'three';
import { clamp, damp, lerp, easeInOut } from '../engine/math.js';

// Third-person orbit camera. yaw/pitch come from the mouse (pointer lock or drag), zoom from the wheel.
export class CameraController {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.yaw = 0;
    this.pitch = 0.32;
    this.distance = 7.5;
    this.focus = new THREE.Vector3();
    this.blend = 1;
    this.blendFrom = new THREE.Vector3();
    this.shakeT = 0;
    this.space = null; // the current space (for ground height); set by the game
  }

  snapFocus(target) {
    this.focus.set(target.x, target.y + 1.55, target.z);
  }

  // Smoothly fly from wherever the camera is now into the orbit position.
  startBlend(duration = 2.2) {
    this.blend = 0;
    this.blendDuration = duration;
    this.blendFrom.copy(this.camera.position);
  }

  shake(amount) {
    this.shakeT = Math.max(this.shakeT, amount);
  }

  update(dt, target, allowInput) {
    const input = this.input;
    if (allowInput) {
      const sens = 0.0024;
      this.yaw -= input.mouseDX * sens;
      this.pitch = clamp(this.pitch + input.mouseDY * sens, -0.35, 1.25);
      if (input.isDown('ArrowLeft') || input.isDown('KeyQ')) this.yaw += 2 * dt;
      if (input.isDown('ArrowRight')) this.yaw -= 2 * dt;
      this.distance = clamp(this.distance + input.wheel * 0.008, 3, 18);
    }
    // Roofless interiors and caves: stay high enough to look down over the walls.
    const enclosed = this.space && !this.space.outdoors;
    const pitch = enclosed ? Math.max(this.pitch, 0.75) : this.pitch;
    const distance = enclosed ? Math.min(this.distance, 8) : this.distance;

    this.focus.x = damp(this.focus.x, target.x, 14, dt);
    this.focus.y = damp(this.focus.y, target.y + 1.55, 10, dt);
    this.focus.z = damp(this.focus.z, target.z, 14, dt);

    const cp = Math.cos(pitch);
    let px = this.focus.x + Math.sin(this.yaw) * cp * distance;
    let py = this.focus.y + Math.sin(pitch) * distance;
    let pz = this.focus.z + Math.cos(this.yaw) * cp * distance;
    if (this.space) py = Math.max(py, this.space.groundAt(px, pz) + 0.5); // never dip under the ground

    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.blendDuration);
      const e = easeInOut(this.blend);
      px = lerp(this.blendFrom.x, px, e);
      py = lerp(this.blendFrom.y, py, e);
      pz = lerp(this.blendFrom.z, pz, e);
    }

    this.camera.position.set(px, py, pz);
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const s = this.shakeT * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.focus);
  }
}
