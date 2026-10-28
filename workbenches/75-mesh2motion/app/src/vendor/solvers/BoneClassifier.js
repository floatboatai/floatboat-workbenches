/**
 * Classifies bones into categories that determine smoothing behavior.
 * - torso: spine, chest, neck — gets wider multi-ring smoothing
 * - limb: arms, legs, head — gets directional child-only smoothing
 * - extremity: hands, feet, fingers, toes — no smoothing (stay rigid)
 * - root: the rig driver above every anatomical bone — deforms nothing itself
 * - other: unclassified — default smoothing
 */
export var BoneCategory;
(function (BoneCategory) {
    BoneCategory["Torso"] = "torso";
    BoneCategory["Limb"] = "limb";
    BoneCategory["Extremity"] = "extremity";
    BoneCategory["Root"] = "root";
    BoneCategory["Other"] = "other";
})(BoneCategory || (BoneCategory = {}));
export class BoneClassifier {
    bone_categories = new Map();
    constructor(bones) {
        this.classify_all_bones(bones);
    }
    get_category(bone_index) {
        return this.bone_categories.get(bone_index) ?? BoneCategory.Other;
    }
    /**
     * Returns true if the bone pair represents a parent-child relationship
     * where smoothing should only flow toward the child direction.
     * This prevents elbow movement from deforming the bicep.
     */
    is_limb_boundary(bone_index_a, bone_index_b) {
        const cat_a = this.get_category(bone_index_a);
        const cat_b = this.get_category(bone_index_b);
        return cat_a === BoneCategory.Limb || cat_b === BoneCategory.Limb;
    }
    /**
     * Returns true if the boundary is between two extremity bones
     * (hand↔finger, finger↔finger, foot↔toe). These get no smoothing so
     * small parts like fingers stay rigid instead of turning mushy.
     * Requires both sides to be extremities, so the wrist/ankle
     * (limb↔extremity) is not caught here and keeps its limb smoothing.
     */
    is_extremity_boundary(bone_index_a, bone_index_b) {
        return this.get_category(bone_index_a) === BoneCategory.Extremity &&
            this.get_category(bone_index_b) === BoneCategory.Extremity;
    }
    /**
     * Returns true if the boundary between two bones should get
     * wider multi-ring smoothing (torso regions).
     */
    is_torso_boundary(bone_index_a, bone_index_b) {
        const cat_a = this.get_category(bone_index_a);
        const cat_b = this.get_category(bone_index_b);
        // At least one side must be torso, and neither side should be extremity
        return (cat_a === BoneCategory.Torso || cat_b === BoneCategory.Torso) &&
            cat_a !== BoneCategory.Extremity && cat_b !== BoneCategory.Extremity;
    }
    classify_all_bones(bones) {
        bones.forEach((bone, idx) => {
            const category = this.classify_bone(bone);
            this.bone_categories.set(idx, category);
        });
    }
    classify_bone(bone) {
        const name = bone.name.toLowerCase();
        // Extremity bones: hands, feet, fingers, toes, eyes, ears
        const extremity_keywords = [
            'hand', 'foot', 'feet', 'toe', 'ball',
            'thumb', 'index', 'middle', 'ring', 'pinky', 'finger', 'teeth',
            'eye', 'tongue', 'wing', 'feather', 'leaf', 'ear', 'horn'
        ];
        if (extremity_keywords.some(kw => name.includes(kw))) {
            return BoneCategory.Extremity;
        }
        // Limb bones: upper/lower arms, thighs, calves, shoulders
        const limb_keywords = [
            'arm', 'upperarm', 'lowerarm', 'forearm', 'elbow', 'wrist', 'nose',
            'shoulder', 'clavicle', 'ankle', 'fin', 'head', 'chin', 'jaw', 'mouth',
            'thigh', 'calf', 'shin', 'knee', 'leg', 'upleg', 'lowleg', 'neck', 'humerus'
        ];
        if (limb_keywords.some(kw => name.includes(kw))) {
            return BoneCategory.Limb;
        }
        // Torso bones: spine, chest, hips, pelvis, neck, wings, tails
        // tails and feathers aren't technically torso, but we want
        // to give them more smoothing since they aren't as rigid
        const torso_keywords = [
            'spine', 'chest', 'hips', 'pelvis', 'torso', 'abdomen', 'body',
            'tail', 'stomach', 'collar', 'scapula', 'ribcage'
        ];
        if (torso_keywords.some(kw => name.includes(kw))) {
            return BoneCategory.Torso;
        }
        // Root: nothing anatomical in the name and no bone above it, so it drives or
        // offsets the whole rig rather than deforming any part of the mesh. Checked
        // last on purpose — a rig whose topmost bone IS a body part (hips as the
        // root, common on Mixamo imports) keeps its anatomical category and the
        // smoothing that goes with it
        const parent_bone = bone.parent;
        if (parent_bone?.isBone !== true) {
            return BoneCategory.Root;
        }
        return BoneCategory.Other;
    }
}
