// Live 3D preview of a shopkeeper model for the character select screen.
// three.js and the model load on demand, so the rest of the game does not wait on them.

export async function mountViewer(canvas: HTMLCanvasElement, url: string): Promise<() => void> {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a090, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 3, 2);
  scene.add(sun);

  const model = gltf.scene;
  model.traverse((o) => {
    const mesh = o as import('three').Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const mat = mesh.material as import('three').MeshStandardMaterial;
    mat.metalness = 0;
    mat.roughness = 1;
    mat.normalMap = null;
    mat.needsUpdate = true;
  });
  const mixer = new THREE.AnimationMixer(model);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  mixer.setTime(0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const height = box.getSize(new THREE.Vector3()).y;
  const centre = box.getCenter(new THREE.Vector3());
  model.position.set(-centre.x, -box.min.y, -centre.z);
  const pivot = new THREE.Group();
  pivot.add(model);
  scene.add(pivot);
  const hips = model.getObjectByName('Hips');

  const half = height * 0.58;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  cam.position.set(0, height * 0.5 + 1.7, 10);
  cam.lookAt(0, height * 0.5, 0);

  let raf = 0;
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    mixer.update(dt);
    if (hips) {
      // walk on the spot
      hips.position.x = 0;
      hips.position.z = 0;
    }
    pivot.rotation.y += dt * 0.9;
    renderer.render(scene, cam);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
