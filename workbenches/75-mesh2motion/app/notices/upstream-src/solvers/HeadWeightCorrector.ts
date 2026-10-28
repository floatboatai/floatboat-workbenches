import { Vector3, type Bone, type BufferGeometry } from 'three'
/**
 * HeadWeightCorrector
 * Handles post-processing correction of vertex weights for "chibi" style characters
 * where large heads might incorrectly get weighted to arm bones instead of head bones.
 *
 * This class will reassign vertices that are:
 * 1. Above a specified height threshold (preview plane height)
 * 2. Currently assigned to arm bones
 * 3. Should be assigned to the head bone instead
 */
export class HeadWeightCorrector {
  private readonly geometry: BufferGeometry
  private readonly bones_master_data: Bone[]
  private readonly preview_plane_height: number
  constructor (
    geometry: BufferGeometry,
    bones_master_data: Bone[],
    preview_plane_height: number
  ) {
    this.geometry = geometry
    this.bones_master_data = bones_master_data
    this.preview_plane_height = preview_plane_height
  }

  /**
   * Apply head weight correction to the skin indices and weights
   * @param skin_indices Array of bone indices for each vertex (4 per vertex)
   * @param skin_weights Array of bone weights for each vertex (4 per vertex)
   */
  public apply_head_weight_correction (skin_indices: number[], skin_weights: number[]): void {
    const head_bone_index = this.find_head_bone_index()
    if (head_bone_index === -1) { return } // Head weight correction skipped: DEF-head bone not found

    const arm_bone_indices = this.find_arm_bone_indices()
    if (arm_bone_indices.length === 0) { return } // Head weight correction skipped: No arm bones found

    this.correct_vertex_weights(skin_indices, skin_weights, head_bone_index, arm_bone_indices)
  }

  /**
   * Find the index of the head bone (looking for "DEF-head" or similar)
   */
  private find_head_bone_index (): number {
    // we only have this head corrector for humans right now, but
    // maybe add a more robust way in case it ever expands to other skeleton types
    const head_bone_names = ['DEF-head', 'head', 'Head', 'HEAD']
    for (let i = 0; i < this.bones_master_data.length; i++) {
      const bone_name = this.bones_master_data[i].name
      // Check for exact matches first
      if (head_bone_names.includes(bone_name)) {
        return i
      }

      // Check for partial matches (case-insensitive)
      const lower_bone_name = bone_name.toLowerCase()
      if (
        head_bone_names.some((name) =>
          lower_bone_name.includes(name.toLowerCase())
        )
      ) {
        return i
      }
    }
    return -1 // Head bone not found
  }

  /**
   * Find the indices of arm bones (looking for arm, shoulder, hand bones)
   */
  private find_arm_bone_indices (): number[] {
    const arm_bone_keywords = [
      'arm',
      'shoulder',
      'hand',
      'finger',
      'thumb',
      'elbow',
      'forearm',
      'upperarm',
      'thumb',
      'index',
      'middle',
      'ring',
      'pinky'
    ]
    const arm_bone_indices: number[] = []
    for (let i = 0; i < this.bones_master_data.length; i++) {
      const bone_name = this.bones_master_data[i].name.toLowerCase()
      // Check if bone name contains any arm-related keywords
      if (arm_bone_keywords.some((keyword) => bone_name.includes(keyword))) {
        arm_bone_indices.push(i)
      }
    }
    return arm_bone_indices
  }

  /**
   * Correct vertex weights for vertices above the height threshold
   */
  private correct_vertex_weights (
    skin_indices: number[],
    skin_weights: number[],
    head_bone_index: number,
    arm_bone_indices: number[]
  ): number {
    const vertex_count = this.geometry.attributes.position.array.length / 3
    let corrected_count = 0
    for (let i = 0; i < vertex_count; i++) {
      const vertex_position = new Vector3().fromBufferAttribute(this.geometry.attributes.position, i)

      // Skip vertices below the height threshold
      if (vertex_position.y <= this.preview_plane_height) { continue }

      const offset = i * 4 // each vertex has 4 slots for skinning weights and indices

      // Check if this vertex is primarily assigned to an arm bone
      const primary_bone_index = skin_indices[offset]
      const primary_weight = skin_weights[offset]

      // If the primary bone is an arm bone and has significant weight, reassign to head
      // Reassign to head bone with 100% weight
      if (arm_bone_indices.includes(primary_bone_index) && primary_weight > 0.5) {
        skin_indices[offset] = head_bone_index
        skin_indices[offset + 1] = 0
        skin_indices[offset + 2] = 0
        skin_indices[offset + 3] = 0
        skin_weights[offset] = 1.0
        skin_weights[offset + 1] = 0.0
        skin_weights[offset + 2] = 0.0
        skin_weights[offset + 3] = 0.0
        corrected_count++
        continue
      }

      // Also check secondary bones for arm assignments
      for (let j = 0; j < 4; j++) {
        const bone_index = skin_indices[offset + j]
        const weight = skin_weights[offset + j]
        // If any arm bone has significant influence, reduce it and increase head influence
        if (arm_bone_indices.includes(bone_index) && weight > 0.3) {
          // Find if head is already in the influences
          let head_slot = -1
          for (let k = 0; k < 4; k++) {
            if (skin_indices[offset + k] === head_bone_index) {
              head_slot = k
              break
            }
          }
          // If head isn't already influencing, replace this arm bone with head
          if (head_slot === -1) {
            skin_indices[offset + j] = head_bone_index
            // Keep the same weight for smooth transition
          } else {
            // Head is already influencing, transfer this arm bone's weight to head
            skin_weights[offset + head_slot] += weight
            skin_weights[offset + j] = 0
            skin_indices[offset + j] = 0
          }
          corrected_count++
        }
      }
      // Normalize weights to ensure they sum to 1.0 since we changed them
      this.normalize_vertex_weights(skin_weights, offset)
    }
    return corrected_count
  }

  /**
   * Normalize weights for a single vertex to ensure they sum to 1.0
   */
  private normalize_vertex_weights (
    skin_weights: number[],
    offset: number
  ): void {
    const total_weight =
      skin_weights[offset] +
      skin_weights[offset + 1] +
      skin_weights[offset + 2] +
      skin_weights[offset + 3]
    if (total_weight > 0) {
      skin_weights[offset] /= total_weight
      skin_weights[offset + 1] /= total_weight
      skin_weights[offset + 2] /= total_weight
      skin_weights[offset + 3] /= total_weight
    }
  }
}
