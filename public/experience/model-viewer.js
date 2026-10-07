// Loaded only after a verified GLB is configured and the visitor requests 3D.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
export async function mountBusModel(container, asset) {
  const url = new URL(asset.url, location.href);
  if (url.origin !== location.origin)
    throw new Error("Host the approved model locally.");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: innerWidth > 860,
      alpha: false,
      powerPreference: "low-power",
    });
  } catch {
    throw new Error("WebGL unavailable");
  }
  renderer.setPixelRatio(
    Math.min(devicePixelRatio || 1, innerWidth <= 860 ? 1.25 : 1.75),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d7d9ce");
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
  const light = new THREE.HemisphereLight(0xffffff, 0x565e42, 2);
  scene.add(light);
  const key = new THREE.DirectionalLight(0xfff3d6, 3);
  key.position.set(5, 8, 4);
  scene.add(key);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  const canvas = renderer.domElement;
  canvas.className = "bus-model-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "Interactive coach model. Arrow keys rotate. Plus and minus zoom.",
  );
  // Keep wheel scrolling available for normal page navigation.
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.maxPolarAngle = Math.PI * 0.53;
  let model,
    disposed = false,
    observer;
  const draw = () => {
    if (!disposed && !document.hidden) renderer.render(scene, camera);
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    controls.dispose();
    canvas.removeEventListener("keydown", keydown);
    canvas.removeEventListener("webglcontextlost", contextLost);
    document.removeEventListener("visibilitychange", draw);
    scene.traverse((object) => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];
      for (const material of materials) {
        for (const value of Object.values(material))
          if (value?.isTexture) {
            value.source?.data?.close?.();
            value.dispose();
          }
        material.dispose();
      }
    });
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  function keydown(event) {
    const rotations = { ArrowLeft: -0.1, ArrowRight: 0.1 };
    if (event.key in rotations) {
      event.preventDefault();
      model.rotation.y += rotations[event.key];
      draw();
    }
    if (["+", "=", "-", "_"].includes(event.key)) {
      event.preventDefault();
      const factor = ["+", "="].includes(event.key) ? 0.9 : 1.1;
      const offset = camera.position.clone().sub(controls.target);
      const length = THREE.MathUtils.clamp(offset.length() * factor, 2.5, 12);
      camera.position.copy(controls.target).add(offset.setLength(length));
      controls.update();
      draw();
    }
  }
  function contextLost(event) {
    event.preventDefault();
    dispose();
    container.querySelector("img").hidden = false;
    container.querySelector(".fleet-image-meta").hidden = false;
    document.querySelector(".fleet-controls").hidden = false;
    document.getElementById("closeModel").hidden = true;
    document.getElementById("openModel").hidden = false;
    document.getElementById("modelStatus").textContent =
      "3D became unavailable. Showing fleet photographs.";
  }
  try {
    const gltf = await new GLTFLoader().loadAsync(url.href);
    model = gltf.scene;
    scene.add(model);
    model.rotation.y = asset.rotationY || 0;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(span) || span <= 0)
      throw new Error("Invalid model bounds");
    model.scale.multiplyScalar(4 / span);
    const centered = new THREE.Box3()
      .setFromObject(model)
      .getCenter(new THREE.Vector3());
    model.position.sub(centered);
    camera.position.set(4, 1.8, 5);
    controls.target.set(0, 0, 0);
    controls.update();
    container.append(canvas);
    function resize() {
      const width = container.clientWidth;
      const height = innerWidth <= 860 ? 370 : 620;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      draw();
    }
    observer = new ResizeObserver(resize);
    observer.observe(container);
    controls.addEventListener("change", draw);
    canvas.addEventListener("keydown", keydown);
    canvas.addEventListener("webglcontextlost", contextLost);
    document.addEventListener("visibilitychange", draw);
    resize();
    canvas.focus();
    return { dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
