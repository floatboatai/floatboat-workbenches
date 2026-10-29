import { Euler, Quaternion, MathUtils } from "three";

const round = (v: number, digits = 4) => {
  const p = 10 ** digits,
    r = Math.round(v * p) / p;
  return Object.is(r, -0) ? 0 : r;
};
/** Euler XYZ degrees → glTF quaternion XYZW. */
export function eulerToQuat(
  deg: [number, number, number],
): [number, number, number, number] {
  const q = new Quaternion().setFromEuler(
    new Euler(
      MathUtils.degToRad(deg[0]),
      MathUtils.degToRad(deg[1]),
      MathUtils.degToRad(deg[2]),
      "XYZ",
    ),
  );
  return [q.x, q.y, q.z, q.w];
}
/** glTF quaternion XYZW → Euler XYZ degrees (rounded for display/editing). */
export function quatToEuler(
  q: [number, number, number, number],
): [number, number, number] {
  const e = new Euler().setFromQuaternion(
    new Quaternion(q[0], q[1], q[2], q[3]).normalize(),
    "XYZ",
  );
  return [
    round(MathUtils.radToDeg(e.x), 3),
    round(MathUtils.radToDeg(e.y), 3),
    round(MathUtils.radToDeg(e.z), 3),
  ];
}
export const display = (v: number) => String(round(v, 4));
