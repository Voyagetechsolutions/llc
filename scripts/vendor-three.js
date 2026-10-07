import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
const files = [
  "build/three.module.js",
  "build/three.core.js",
  "examples/jsm/loaders/GLTFLoader.js",
  "examples/jsm/controls/OrbitControls.js",
  "examples/jsm/utils/BufferGeometryUtils.js",
  "examples/jsm/utils/SkeletonUtils.js",
  "examples/jsm/environments/RoomEnvironment.js",
  "LICENSE",
];
for (const file of files) {
  const target = path.join(
    "public/assets/vendor/three",
    file.replace("build/", "").replace("examples/jsm/", "addons/"),
  );
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join("node_modules/three", file), target);
}
