// returns back if we are having issues with bones inside of mesh
export default class BoneTesterData {
    bones_names_with_errors = [];
    bones_vertices_with_errors = [];
    constructor(bones_names_with_errors, bones_vertices_with_errors) {
        this.bones_names_with_errors = bones_names_with_errors;
        this.bones_vertices_with_errors = bones_vertices_with_errors;
    }
}
