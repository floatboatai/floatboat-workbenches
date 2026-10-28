import { mount as m } from "oasis-editor";
function n() {
  let u = null;
  return {
    mount(o, t, r) {
      u = m(o, t), r == null || r(u);
    },
    unmount() {
      u == null || u.unmount(), u = null;
    }
  };
}
export {
  n as c
};
