export default class BoneCalculationData {
    name = '';
    bone_object;
    has_child_bone = false;
    assigned_vertices;
    constructor(bone) {
        this.name = bone.name || '';
        this.bone_object = bone;
        this.has_child_bone = bone.children.length > 0;
    }
}
