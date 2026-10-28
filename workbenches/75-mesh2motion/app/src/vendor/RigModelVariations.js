function createVariation(type, spec) {
    return {
        model_file: `models-variation/${type}/${spec.variant}.glb`, // all variations are in the same folder for now
        display_name: spec.displayName,
        attribution: spec.attribution ?? '', // attribution only needed for CC-SA and CC-BY
        license: spec.license ?? 'CC0', // defaults to CC0 unless otherwise specified
        preview_image: `models-variation/${type}/preview/${spec.variant}.png`, // all preview images are stored in the profiles folder
        expandArms: spec.expandArms ?? 0, // default to 0 unless a human variation overrides it for the Explore page
        pelvis_position_scale: spec.pelvisPositionScale ?? 1.0 // 1.0 keeps the authored hip height from the animation data
    };
}
const HUMAN_TYPE = 'human';
export const humanVariations = [
    createVariation(HUMAN_TYPE, { variant: 'male', displayName: 'Male', attribution: 'Quaternius', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'zombie', displayName: 'Zombie', attribution: 'Kenney.nl', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'female', displayName: 'Female', attribution: 'Quaternius', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'female_8', displayName: 'Female 8', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'female_9', displayName: 'Female 9', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.02 }),
    createVariation(HUMAN_TYPE, { variant: 'female_31', displayName: 'Female 31', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 0.92 }),
    createVariation(HUMAN_TYPE, { variant: 'male_5', displayName: 'Male 5', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'male_6', displayName: 'Male 6', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'male_10', displayName: 'Male 10', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'male_15', displayName: 'Male 15', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'male_32', displayName: 'Male 32', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 0.96 }),
    createVariation(HUMAN_TYPE, { variant: 'doctor_m', displayName: 'Doctor Male', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'swat_male', displayName: 'SWAT Male', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'police_male', displayName: 'Police Male', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'police_female', displayName: 'Police Female', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'hazmat_female', displayName: 'Hazmat Female', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'hazmat_suit_male', displayName: 'Hazmat Suit Male', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.05 }),
    createVariation(HUMAN_TYPE, { variant: 'killer_4', displayName: 'Killer 4', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.02 }),
    createVariation(HUMAN_TYPE, { variant: 'killer_5', displayName: 'Killer 5', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.05 }),
    createVariation(HUMAN_TYPE, { variant: 'killer_6', displayName: 'Killer 6', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.05 }),
    createVariation(HUMAN_TYPE, { variant: 'killer_7', displayName: 'Killer 7', attribution: 'elbolilloduro', license: 'CC0' }),
    createVariation(HUMAN_TYPE, { variant: 'monster', displayName: 'Monster', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.37 }),
    createVariation(HUMAN_TYPE, { variant: 'monster_3', displayName: 'Monster 3', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.05 }),
    createVariation(HUMAN_TYPE, { variant: 'monster_4', displayName: 'Monster 4', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.55 }),
    createVariation(HUMAN_TYPE, { variant: 'monster_5', displayName: 'Monster 5', attribution: 'elbolilloduro', license: 'CC0', pelvisPositionScale: 1.12 }),
    createVariation(HUMAN_TYPE, { variant: 'sophia', displayName: 'Sophia', attribution: 'Tysan Tan', license: 'CC-SA 4.0' }),
    createVariation(HUMAN_TYPE, { variant: 'jay', displayName: 'Jay', attribution: 'Blender Studio', license: 'CC-BY' }),
    createVariation(HUMAN_TYPE, { variant: 'sintel', displayName: 'Sintel', attribution: 'Blender Studio', license: 'CC-BY' }),
    createVariation(HUMAN_TYPE, { variant: 'bunny', displayName: 'Bunny', attribution: 'Blender Studio', license: 'CC-BY', expandArms: -30 }),
];
const FOX_TYPE = 'fox';
export const foxVariations = [
    createVariation(FOX_TYPE, { variant: 'fox', displayName: 'Fox' }),
    createVariation(FOX_TYPE, { variant: 'dog', displayName: 'Dog' }),
    createVariation(FOX_TYPE, { variant: 'cat', displayName: 'Carrot', attribution: 'David Revoy', license: 'CC-BY' }),
    createVariation(FOX_TYPE, { variant: 'panda', displayName: 'Panda' }),
];
const BIRD_TYPE = 'bird';
export const birdVariations = [
    createVariation(BIRD_TYPE, { variant: 'seagull', displayName: 'Seagull' }),
    createVariation(BIRD_TYPE, { variant: 'eagle', displayName: 'Bald Eagle' }),
];
const KAIJU_TYPE = 'kaiju';
export const kaijuVariations = [
    createVariation(KAIJU_TYPE, { variant: 'lizard', displayName: 'Lizard' }),
    createVariation(KAIJU_TYPE, { variant: 't-rex', displayName: 'T-Rex' }),
];
const FISH_TYPE = 'fish';
export const fishVariations = [
    createVariation(FISH_TYPE, { variant: 'shark', displayName: 'Shark' }),
    createVariation(FISH_TYPE, { variant: 'whale', displayName: 'Whale' }),
];
