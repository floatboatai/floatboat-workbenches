import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetDocument } from "../contracts/asset";
import { loadGlb, dispose } from "./preview";
import { readBytes } from "./files";
type Vec = [number, number, number];
interface Props {
  document: AssetDocument;
  resourceVersion: number;
  playing: boolean;
  disabled: boolean;
  fit: number;
  onView: (camera: Vec, target: Vec) => void;
  onTime: (time: number) => void;
  onReady: (meshes: number, textures: number) => void;
}
interface World {
  renderer: T.WebGLRenderer;
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  controls: OrbitControls;
  root: T.Group;
  helper: T.Box3Helper;
  mixer: T.AnimationMixer | null;
  model: GLTF | null;
  frame: number;
  paint: () => void;
  fit: () => void;
}
export function Viewport(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    world = useRef<World | null>(null),
    latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const d = props.document,
    source = d.view === "result" ? d.result : d.source;
  useEffect(() => {
    if (!host.current) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor("#eeeae1");
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
    } catch {
      setError(
        "三维视图不可用。检查表、修订与导出仍可使用；开启图形加速后重试。",
      );
      return;
    }
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(35, 1, 0.001, 1e8),
      controls = new OrbitControls(camera, renderer.domElement),
      root = new T.Group(),
      helper = new T.Box3Helper(new T.Box3(), 0xb9643f);
    helper.visible = false;
    scene.add(root, helper);
    scene.add(new T.HemisphereLight(0xffffff, 0xb6a997, 3));
    const key = new T.DirectionalLight(0xffffff, 3);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new T.DirectionalLight(0xffead4, 1);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    camera.position.fromArray(d.camera);
    controls.target.fromArray(d.target);
    controls.enableDamping = false;
    controls.maxDistance = 1000000;
    controls.minDistance = 0.001;
    controls.update();
    let alive = true,
      last = performance.now(),
      lastTime = 0;
    const w: World = {
      renderer,
      scene,
      camera,
      controls,
      root,
      helper,
      mixer: null,
      model: null,
      frame: 0,
      paint: () => {},
      fit: () => {},
    };
    world.current = w;
    const save = () => {
      if (!latest.current.disabled)
        latest.current.onView(
          camera.position.toArray() as Vec,
          controls.target.toArray() as Vec,
        );
    };
    const render = () => {
      w.frame = 0;
      if (!alive) return;
      const now = performance.now();
      if (latest.current.playing && !latest.current.disabled && w.mixer) {
        w.mixer.update(Math.min((now - last) / 1000, 0.05));
        if (now - lastTime > 200) {
          lastTime = now;
          latest.current.onTime(w.mixer.time);
        }
      }
      last = now;
      renderer.render(scene, camera);
      if (latest.current.playing && !latest.current.disabled && w.mixer)
        w.frame = requestAnimationFrame(render);
    };
    w.paint = () => {
      if (alive && !w.frame) w.frame = requestAnimationFrame(render);
    };
    w.fit = () => {
      const b = new T.Box3().setFromObject(root);
      if (b.isEmpty()) return;
      const c = b.getCenter(new T.Vector3()),
        size = b.getSize(new T.Vector3()).length();
      controls.target.copy(c);
      camera.position
        .copy(c)
        .add(
          new T.Vector3(1, 0.68, 1.3).normalize().multiplyScalar(size * 1.8),
        );
      controls.update();
      save();
      w.paint();
    };
    controls.addEventListener("change", w.paint);
    controls.addEventListener("end", save);
    controls.listenToKeyEvents(renderer.domElement);
    const keyup = () => save();
    renderer.domElement.addEventListener("keyup", keyup);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "资产三维预览，方向键平移，拖动旋转，滚轮缩放",
    );
    renderer.domElement.setAttribute("role", "img");
    host.current.append(renderer.domElement);
    const resize = new ResizeObserver(() => {
      if (!host.current) return;
      renderer.setSize(
        host.current.clientWidth,
        host.current.clientHeight,
        false,
      );
      camera.aspect = host.current.clientWidth / host.current.clientHeight;
      camera.updateProjectionMatrix();
      w.paint();
    });
    resize.observe(host.current);
    w.paint();
    return () => {
      alive = false;
      cancelAnimationFrame(w.frame);
      resize.disconnect();
      controls.dispose();
      w.mixer?.stopAllAction();
      if (w.model) w.mixer?.uncacheRoot(w.model.scene);
      dispose(root);
      helper.geometry.dispose();
      (helper.material as T.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      world.current = null;
    };
  }, []);
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    let dead = false;
    setLoading(Boolean(source));
    setError("");
    w.mixer?.stopAllAction();
    if (w.model) w.mixer?.uncacheRoot(w.model.scene);
    w.mixer = null;
    w.model = null;
    dispose(w.root);
    w.root.clear();
    w.helper.visible = false;
    latest.current.onReady(0, 0);
    w.paint();
    if (!source) return;
    void readBytes(source)
      .then(loadGlb)
      .then((g) => {
        if (dead) {
          dispose(g.scene);
          return;
        }
        w.model = g;
        w.root.add(g.scene);
        w.mixer = g.animations.length ? new T.AnimationMixer(g.scene) : null;
        const clip = g.animations[Number(latest.current.document.clip) || 0];
        if (w.mixer && clip) {
          w.mixer.clipAction(clip).play();
          w.mixer.setTime(latest.current.document.time);
        }
        let meshes = 0;
        const textures = new Set<T.Texture>();
        g.scene.traverse((o) => {
          if (o instanceof T.Mesh) {
            meshes++;
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              for (const t of Object.values(m))
                if (t instanceof T.Texture) textures.add(t);
          }
        });
        latest.current.onReady(meshes, textures.size);
        setLoading(false);
        w.paint();
      })
      .catch((e) => {
        if (!dead) {
          setLoading(false);
          setError(e instanceof Error ? e.message : "预览加载失败。");
        }
      });
    return () => {
      dead = true;
    };
  }, [source?.id, props.resourceVersion]);
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    w.camera.position.fromArray(d.camera);
    w.controls.target.fromArray(d.target);
    w.controls.enabled = !props.disabled;
    w.controls.update();
    w.paint();
  }, [d.camera, d.target, props.disabled]);
  useEffect(() => {
    const w = world.current;
    if (!w || !w.mixer || !w.model) return;
    w.mixer.stopAllAction();
    const clip = w.model.animations[Number(d.clip) || 0];
    if (clip) {
      w.mixer.clipAction(clip).play();
      w.mixer.setTime(d.time);
    }
    w.paint();
  }, [d.clip, d.time, props.playing]);
  useEffect(() => {
    world.current?.fit();
  }, [props.fit]);
  useEffect(() => {
    const w = world.current;
    if (!w?.model) return;
    const box = new T.Box3();
    w.model.scene.updateMatrixWorld(true);
    w.model.scene.traverse((o) => {
      const association = w.model?.parser.associations.get(o);
      if (d.tab === "nodes" && association?.nodes === d.selected)
        box.expandByObject(o);
      if (d.tab === "materials" && o instanceof T.Mesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        if (
          materials.some(
            (m) =>
              w.model?.parser.associations.get(m)?.materials === d.selected,
          )
        )
          box.expandByObject(o);
      }
    });
    w.helper.box.copy(box);
    w.helper.visible = !box.isEmpty();
    w.paint();
  }, [d.tab, d.selected, source?.id, loading]);
  return (
    <div
      className="viewport"
      ref={host}
      data-ready={!loading && !error && Boolean(source)}
    >
      {error ? (
        <div className="stage-message" role="alert">
          <b>预览暂停</b>
          <p>{error}</p>
        </div>
      ) : loading ? (
        <div className="stage-message" role="status">
          读取模型与内嵌贴图…
        </div>
      ) : !source ? (
        <div className="stage-message empty-stage">
          <span>◇</span>
          <h2>每一件资产，都值得交付前检查。</h2>
          <p>载入 GLB，核对结构、材质与资源。</p>
        </div>
      ) : null}
      <div className="axis" aria-hidden="true">
        Y ↑ <span>X ↗</span> Z ↘
      </div>
    </div>
  );
}
