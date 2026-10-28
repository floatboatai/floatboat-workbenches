export default class BoneTransformState {
    name;
    position;
    rotation; // Not sure if this is right
    scale;
    constructor(name = '', position, rotation, scale) {
        this.name = name;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }
}
