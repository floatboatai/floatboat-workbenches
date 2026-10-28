import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ModelDocument } from "../contracts/model";
import { bindingKey } from "../contracts/model";
import {
  bonesOf,
  clipsFor,
  dispose,
  loadGlb,
  normalizedModel,
  rigFor,
} from "./native";
import { readBytes, readSource } from "./files";
export interface NativeInfo {
  joints: string[];
  clips: { name: string; duration: number }[];
  vertices: number;
  meshes: number;
  textures: number;
}
interface Props {
  document: ModelDocument;
  playing: boolean;
  disabled: boolean;
  onView: (
    camera: [number, number, number],
    target: [number, number, number],
  ) => void;
  onProgress: (time: number) => void;
  onInfo: (v: NativeInfo) => void;
  onError: (e: unknown) => void;
}
interface World {
  renderer: T.WebGLRenderer;
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  controls: OrbitControls;
  root: T.Group;
  helper: T.SkeletonHelper | null;
  rig: T.Group | null;
  rigAsset: GLTF | null;
  mixer: T.AnimationMixer | null;
  clips: T.AnimationClip[];
  clock: T.Clock;
  frame: number;
  bound: boolean;
  invalidate: () => void;
}
export function Viewport(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    world = useRef<World | null>(null),
    latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const d = props.document,
    isBound = Boolean(d.bound && d.bindingKey === bindingKey(d)),
    source = isBound ? d.bound : d.source;
  useEffect(() => {
    if (!host.current) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setClearColor("#14151d");
      renderer.outputColorSpace = T.SRGBColorSpace;
    } catch (e) {
      setError(
        "三维视图暂不可用。请开启浏览器图形加速后刷新；工程与参数仍可保存。",
      );
      return;
    }
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(36, 1, 0.01, 100),
      controls = new OrbitControls(camera, renderer.domElement),
      root = new T.Group();
    camera.position.fromArray(d.camera);
    controls.target.fromArray(d.target);
    controls.update();
    controls.minDistance = 0.8;
    controls.maxDistance = 12;
    controls.enableDamping = false;
    scene.add(root);
    scene.add(new T.HemisphereLight("#dce7ff", "#454158", 2.4));
    const light = new T.DirectionalLight("#ffffff", 3.5);
    light.position.set(2, 4, 3);
    scene.add(light);
    const floor = new T.GridHelper(5, 20, "#45465b", "#282a38");
    floor.position.y = -0.006;
    scene.add(floor);
    const w: World = {
      renderer,
      scene,
      camera,
      controls,
      root,
      helper: null,
      rig: null,
      rigAsset: null,
      mixer: null,
      clips: [],
      clock: new T.Clock(),
      frame: 0,
      bound: false,
      invalidate: () => {},
    };
    world.current = w;
    let alive = true,
      lastProgress = 0,
      lastView = 0;
    const paint = () => {
      w.frame = 0;
      if (!alive) return;
      if (latest.current.playing && !latest.current.disabled && w.mixer) {
        w.mixer.update(
          Math.min(w.clock.getDelta(), 0.05) * latest.current.document.speed,
        );
        if (performance.now() - lastProgress > 120) {
          lastProgress = performance.now();
          const clip = w.clips.find(
            (c) => c.name === latest.current.document.clip,
          );
          latest.current.onProgress(clip ? w.mixer.time % clip.duration : 0);
        }
      } else w.clock.getDelta();
      renderer.render(scene, camera);
      if (latest.current.playing && !latest.current.disabled && w.mixer)
        w.frame = requestAnimationFrame(paint);
    };
    w.invalidate = () => {
      if (!w.frame && alive) w.frame = requestAnimationFrame(paint);
    };
    const saveView = () => {
      if (!alive || latest.current.disabled) return;
      latest.current.onView(
        camera.position.toArray() as [number, number, number],
        controls.target.toArray() as [number, number, number],
      );
    };
    controls.addEventListener("change", () => {
      w.invalidate();
      if (performance.now() - lastView > 180) {
        lastView = performance.now();
        saveView();
      }
    });
    controls.addEventListener("end", saveView);
    const resize = new ResizeObserver(() => {
      const h = host.current;
      if (!h || !alive) return;
      renderer.setSize(h.clientWidth, h.clientHeight, false);
      camera.aspect = h.clientWidth / h.clientHeight;
      camera.updateProjectionMatrix();
      w.invalidate();
    });
    resize.observe(host.current);
    renderer.domElement.tabIndex = 0;
    controls.listenToKeyEvents(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "角色三维视图，方向键平移、拖动旋转、滚轮缩放",
    );
    renderer.domElement.setAttribute("role", "img");
    host.current.append(renderer.domElement);
    w.invalidate();
    return () => {
      alive = false;
      resize.disconnect();
      cancelAnimationFrame(w.frame);
      controls.dispose();
      w.mixer?.stopAllAction();
      dispose(root);
      w.helper?.dispose();
      floor.geometry.dispose();
      (floor.material as T.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      world.current = null;
    };
  }, []);
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    let cancelled = false;
    setLoading(Boolean(source));
    setError("");
    w.mixer?.stopAllAction();
    w.mixer = null;
    dispose(w.root);
    w.root.clear();
    w.helper?.dispose();
    w.helper = null;
    w.rig = null;
    w.rigAsset = null;
    w.clips = [];
    w.bound = isBound;
    latest.current.onInfo({
      joints: [],
      clips: [],
      vertices: 0,
      meshes: 0,
      textures: 0,
    });
    if (!source) {
      w.invalidate();
      return;
    }
    const run = async () => {
      const [model, rig, animations] = await Promise.all([
        readSource(source).then(loadGlb),
        readBytes("/api/assets/human-rig.glb").then(loadGlb),
        readBytes("/api/assets/human-animations.glb").then(loadGlb),
      ]);
      if (cancelled) {
        dispose(model.scene);
        dispose(rig.scene);
        dispose(animations.scene);
        return;
      }
      w.rigAsset = rig;
      w.clips = clipsFor(animations, latest.current.document.scale);
      dispose(animations.scene);
      if (isBound) {
        w.root.add(model.scene);
        w.mixer = new T.AnimationMixer(model.scene);
      } else {
        const n = normalizedModel(model);
        n.scene.traverse((o) => {
          if (o instanceof T.Mesh) {
            const mesh = new T.Mesh(
              o.geometry
                .clone()
                .applyMatrix4(n.matrix.clone().multiply(o.matrixWorld)),
              o.material,
            );
            w.root.add(mesh);
          }
        }); // Materials are transferred into root; dispose only source geometries.
        model.scene.traverse((o) => {
          if (o instanceof T.Mesh) o.geometry.dispose();
        });
        w.rig = rigFor(rig, latest.current.document);
        w.root.add(w.rig);
      }
      w.helper = new T.SkeletonHelper(w.root);
      w.helper.visible = latest.current.document.showSkeleton;
      w.root.add(w.helper);
      let vertices = 0,
        meshes = 0;
      const textures = new Set<T.Texture>();
      w.root.traverse((o) => {
        if (o instanceof T.Mesh) {
          meshes++;
          vertices += o.geometry.attributes.position?.count ?? 0;
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            for (const v of Object.values(m))
              if (v instanceof T.Texture) textures.add(v);
        }
      });
      latest.current.onInfo({
        joints: bonesOf(rig.scene).map((b) => b.name),
        clips: w.clips.map((c) => ({ name: c.name, duration: c.duration })),
        vertices,
        meshes,
        textures: textures.size,
      });
      const clip = w.clips.find((c) => c.name === latest.current.document.clip);
      if (w.mixer && clip) {
        w.mixer.clipAction(clip).play();
        w.mixer.setTime(latest.current.document.time);
      }
      setLoading(false);
      w.invalidate();
    };
    void run().catch((e) => {
      if (!cancelled) {
        setLoading(false);
        setError(e instanceof Error ? e.message : "模型加载失败。");
        latest.current.onError(e);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source?.id, isBound]);
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    w.controls.enabled = !props.disabled;
    if (w.rigAsset && !w.bound) {
      if (w.rig) {
        w.root.remove(w.rig);
      }
      w.rig = rigFor(w.rigAsset, d);
      w.root.add(w.rig);
      w.helper?.dispose();
      if (w.helper) w.root.remove(w.helper);
      w.helper = new T.SkeletonHelper(w.root);
      w.root.add(w.helper);
    }
    if (w.helper) w.helper.visible = d.showSkeleton;
    w.invalidate();
  }, [d.scale, d.offsets, d.showSkeleton, props.disabled]);
  useEffect(() => {
    const w = world.current;
    if (!w || !w.mixer) return;
    w.mixer.stopAllAction();
    const clip = w.clips.find((c) => c.name === d.clip);
    if (clip) {
      w.mixer.clipAction(clip).play();
      w.mixer.setTime(d.time);
    }
    w.clock.getDelta();
    w.invalidate();
  }, [d.clip, d.time, props.playing, props.disabled]);
  useEffect(() => {
    const w = world.current;
    if (!w) return;
    const c = new T.Vector3(...d.camera),
      t = new T.Vector3(...d.target);
    if (
      w.camera.position.distanceTo(c) > 0.001 ||
      w.controls.target.distanceTo(t) > 0.001
    ) {
      w.camera.position.copy(c);
      w.controls.target.copy(t);
      w.controls.update();
      w.invalidate();
    }
  }, [d.camera, d.target]);
  return (
    <div className="viewport" ref={host}>
      {loading ? (
        <div className="stage-message" role="status">
          正在整理模型与动作…
        </div>
      ) : error ? (
        <div className="stage-message error" role="alert">
          {error}
        </div>
      ) : !source ? (
        <div className="stage-message">
          <span className="stage-symbol">◇</span>
          <h2>从一个角色开始</h2>
          <p>导入静态人形 GLB，或载入人形样例。</p>
        </div>
      ) : null}
      <div className="axis-key" aria-hidden="true">
        <span>X</span>
        <span>Y</span>
        <span>Z</span>
      </div>
    </div>
  );
}
