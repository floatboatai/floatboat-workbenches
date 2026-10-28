import { Vector3, Vector2, Mesh, Group, Bone, Euler, Raycaster } from 'three';
import BoneTransformState from './interfaces/BoneTransformState.js';
import IntersectionPointData from './interfaces/IntersectionPointData.js';
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Utility {
    static distance_between_objects(object_1, object_2) {
        const object_1_position = new Vector3();
        const object_2_position = new Vector3();
        object_1.getWorldPosition(object_1_position);
        object_2.getWorldPosition(object_2_position);
        return object_1_position.distanceTo(object_2_position);
    }
    /**
     * Converts an object's local position to world position
     * This is similar to "localToWorld()", but makes sure the object's world matrix is up to date
     * https://stackoverflow.com/questions/70016922/three-js-getworldposition-localtoworld-position-not-correct
     * (see Mugen87's comment at the bottom)
     * @param {*} object
     * @returns local position for object in a Vector3 object
     */
    static world_position_from_object(object) {
        const position = new Vector3();
        return object.getWorldPosition(position);
    }
    static direction_between_points(point_1, point_2) {
        const direction = new Vector3();
        direction.subVectors(point_2, point_1).normalize();
        return direction;
    }
    static is_point_in_box(point, box_mesh) {
        // Transform the point from world space into the objects space
        box_mesh.updateMatrixWorld();
        const local_point = box_mesh.worldToLocal(point.clone());
        if (box_mesh.geometry.boundingBox === null) {
            console.warn('is_point_in_box() - box_mesh does not have a bounding box', box_mesh);
            return false;
        }
        return box_mesh.geometry.boundingBox.containsPoint(local_point);
    }
    static remove_object_array(obj) {
        obj.traverse((child) => {
            if (child instanceof Mesh) {
                child.geometry.dispose();
                for (const key in child.material) {
                    const value = child.material[key];
                    if (value && typeof value.dispose === 'function') {
                        value.dispose();
                    }
                }
                obj.remove(obj);
            }
        });
    }
    static remove_object_with_children(obj) {
        if (obj.children.length > 0) {
            obj.children.forEach((child) => {
                this.remove_object_with_children(child);
            });
        }
        if (obj instanceof Mesh) {
            if (obj.geometry !== null) {
                obj.geometry.dispose();
            }
            if (obj.material !== undefined) {
                // this obj.material could be an array or a single material
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(material => {
                        if (material.map) {
                            material.map.dispose();
                        }
                        material.dispose();
                    });
                }
                else {
                    if (obj.material.map) {
                        obj.material.map.dispose();
                    }
                    obj.material.dispose();
                }
            }
        }
        if (obj.parent != null) {
            obj.parent.remove(obj);
        }
        obj.removeFromParent();
    }
    /**
     * A "leaf" bone is an orientation-only tip at the end of a chain (finger/toe
     * tips, head top, tail/ear/wing tips). These are not meant to be animated, so
     * the skinning algorithm ignores them. Identified as childless AND name-marked.
     * Human rigs mark them with `_leaf`; the animal rigs mark them with `tip`.
     */
    static is_leaf_bone(bone) {
        if (bone.children.length > 0)
            return false;
        const name = bone.name.toLowerCase();
        return name.includes('leaf') || name.includes('tip');
    }
    /**
     * The point halfway between a bone's start joint and its first child's joint.
     * This is the reference point the skinning solvers measure vertex distances
     * against — a bone's "center of mass" rather than its start joint, which
     * keeps long bones from losing vertices to their neighbors.
     * Childless bones fall back to their own world position.
     */
    static bone_midpoint_to_child(bone) {
        const bone_position = Utility.world_position_from_object(bone);
        if (bone.children.length === 0) {
            return bone_position.clone();
        }
        // Assume first child is the relevant one
        const child = bone.children[0];
        const child_position = Utility.world_position_from_object(child);
        return new Vector3().lerpVectors(bone_position, child_position, 0.5);
    }
    static bone_list_from_hierarchy(bone_hierarchy) {
        if (bone_hierarchy === undefined || bone_hierarchy === null) {
            console.warn('bone_hierarchy is undefined or null');
            return [];
        }
        const bones = [];
        bone_hierarchy.traverse((bone) => {
            if (bone instanceof Bone) {
                bones.push(bone);
            }
        });
        return bones;
    }
    static intersection_points_between_positions_and_mesh(positions, envelope_mesh) {
        const vertex_positions_inside_bone_envelope = [];
        const vertex_indexes_inside_bone_evelope = [];
        const vertex_count = positions.array.length / 3;
        for (let i = 0; i < vertex_count; i++) {
            const vertex_position = new Vector3().fromBufferAttribute(positions, i);
            const is_intersecting = Utility.is_point_in_box(vertex_position, envelope_mesh);
            if (is_intersecting) {
                vertex_positions_inside_bone_envelope.push(vertex_position);
                vertex_indexes_inside_bone_evelope.push(i);
            }
        }
        return new IntersectionPointData(vertex_positions_inside_bone_envelope, vertex_indexes_inside_bone_evelope);
    }
    /**
     * From a mouse event, return a normalized vector2 for screen space between -1 and 1 (0 being center of screen)
     * This is used for turning a mouse event into a raycaster when determining screen space intersections
     * Top right of screen would return 1, 1. Bottom left would return -1, -1
     * @param {*} mouse_event
     * @returns x and y coordinates normalized between -1 and 1
     */
    static normalized_mouse_position(mouse_event) {
        const mouse = new Vector2();
        mouse.x = (mouse_event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(mouse_event.clientY / window.innerHeight) * 2 + 1;
        return mouse;
    }
    /**
     * Store all the debugging objects in a separate group so they can be easily organized
     * and removed when needed
     * @param {*} scene
     * @returns
     */
    static regenerate_debugging_scene(scene) {
        const debugging_object_name = 'Skinning Debug Container';
        // clear out debugging container if it exists
        const existing_debugging_container = scene.getObjectByName(debugging_object_name);
        if (existing_debugging_container !== undefined) {
            this.remove_object_array(existing_debugging_container);
            existing_debugging_container.clear();
            scene.remove(existing_debugging_container);
        }
        // add a reusable container for debugging
        const debugging_scene_object = new Group();
        debugging_scene_object.name = debugging_object_name;
        scene.add(debugging_scene_object);
        return debugging_scene_object;
    }
    static store_bone_transforms(skeleton) {
        const bone_transforms = [];
        skeleton.bones.forEach((bone) => {
            const new_rotation = new Vector3().setFromEuler(bone.rotation);
            const new_transform_state = new BoneTransformState(bone.name, bone.position.clone(), new_rotation, bone.scale.clone());
            bone_transforms.push(new_transform_state);
        });
        return bone_transforms;
    }
    static restore_bone_transforms(skeleton, original_bone_transforms) {
        original_bone_transforms.forEach((bone_transform) => {
            const bone = skeleton.bones.find((bone) => bone.name === bone_transform.name) ??
                null;
            if (bone !== null) {
                bone.position.copy(bone_transform.position);
                const euler = new Euler();
                euler.setFromVector3(bone_transform.rotation);
                bone.rotation.copy(euler);
                bone.scale.copy(bone_transform.scale);
            }
        });
    }
    static calculate_bone_base_name(bone_name) {
        // remove if bone name part if they have suffix
        let normalized_bone_name = bone_name.toLowerCase().replace(/(_r|_l|_right|_left)$/, '');
        // remove if the bone name part if they have prefix
        normalized_bone_name = normalized_bone_name.replace(/^(r_|l_|right_|left_)/, '');
        return normalized_bone_name;
    }
    // Find the closest bone for raycaster using screen-space distance to account for camera zoom
    static raycast_closest_bone_test(camera, mouse_event, skeleton) {
        const raycaster = new Raycaster();
        raycaster.setFromCamera(Utility.normalized_mouse_position(mouse_event), camera);
        const mouse_position = Utility.normalized_mouse_position(mouse_event);
        let closest_bone = null;
        let closest_bone_index = 0;
        let closest_distance = Infinity;
        skeleton.bones.forEach((bone, bone_index) => {
            const world_position = Utility.world_position_from_object(bone);
            // Project bone position to screen space then find distance
            const bone_screen_position = world_position.clone().project(camera);
            const screen_distance = mouse_position.distanceTo(new Vector2(bone_screen_position.x, bone_screen_position.y));
            if (screen_distance < closest_distance) {
                closest_bone = bone;
                closest_distance = screen_distance;
                closest_bone_index = bone_index;
            }
        });
        const output = [closest_bone, closest_bone_index, closest_distance];
        return output;
    }
    static scale_armature_by_scalar(armature, scalar) {
        armature.traverse((bone) => {
            if (bone.type === 'Bone') {
                bone.position.multiplyScalar(scalar);
            }
        });
    }
    static clean_bone_name_for_messaging(bone_name) {
        return bone_name.replace('mixamorig_', '');
    }
    static find_closest_bone_index_from_vertex_index(vertex_index, geometry, bones) {
        const vertex_position = new Vector3().fromBufferAttribute(geometry.attributes.position, vertex_index);
        // let closest_bone: Bone = bones[0].bone_object
        let closest_bone_distance = 10000;
        let closest_bone_index = 0;
        bones.forEach((bone, idx) => {
            let distance = Utility.world_position_from_object(bone.bone_object).distanceTo(vertex_position);
            // if bone has a child, we are going to calculate the distance by getting the half way
            // point between bone and child bone...to hopefully yield better results
            if (bone.has_child_bone) {
                const child_bone = bone.bone_object.children[0];
                const child_bone_position = Utility.world_position_from_object(child_bone);
                const bone_position = Utility.world_position_from_object(bone.bone_object);
                const half_way_point = bone_position.add(child_bone_position).divideScalar(2);
                const distance_to_half_way_point = half_way_point.distanceTo(vertex_position);
                if (distance_to_half_way_point < closest_bone_distance) {
                    distance = distance_to_half_way_point;
                }
            }
            if (distance < closest_bone_distance) {
                // closest_bone = bone.bone_object
                closest_bone_distance = distance;
                closest_bone_index = idx;
            }
        });
        return closest_bone_index;
    }
    static get_file_extension(file_path) {
        const file_name = file_path.split('/').pop(); // remove the directory path
        if (file_name === undefined) {
            console.error('Critical Error: Undefined file extension when loading model');
            return 'UNDEFINED';
        }
        const file_extension = file_name?.split('.').pop(); // just get last part of the file name
        if (file_extension === undefined) {
            console.error('Critical Error: File does not have a "." symbol in the name');
            return 'UNDEFINED';
        }
        return file_extension;
    }
    static parse_input_number(value) {
        if (value === undefined || value === null) {
            return 0;
        }
        value = value.trim();
        if (value === '') {
            return 0;
        }
        const value_numeric = parseFloat(value);
        if (typeof value_numeric !== 'number' || !isFinite(value_numeric)) {
            return 0;
        }
        return value_numeric;
    }
    static enum_from_value(val, enumType) {
        const enumName = Object.keys(enumType).find(k => enumType[k] === val);
        return enumName === undefined ? undefined : enumType[enumName];
    }
}
