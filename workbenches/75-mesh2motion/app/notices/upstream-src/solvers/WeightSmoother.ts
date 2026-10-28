import {
  type Bone,
  type BufferAttribute,
  type BufferGeometry
} from 'three'

import { BoneClassifier } from './BoneClassifier.js'

/**
 * Smooths skin weight boundaries between bone influences using vertex adjacency.
 * Applies different smoothing strategies based on bone category:
 * - Torso: wider multi-ring gradient for voluminous areas
 * - Limbs: directional smoothing toward child bone only
 * - Extremities: no smoothing — hands/fingers/feet/toes stay rigid
 */
export class WeightSmoother {
  private readonly geometry: BufferGeometry
  private readonly bones: Bone[]
  private readonly classifier: BoneClassifier

  constructor (geometry: BufferGeometry, bones: Bone[]) {
    this.geometry = geometry
    this.bones = bones
    this.classifier = new BoneClassifier(bones)
  }

  private geometry_vertex_count (): number {
    return this.geometry.attributes.position.array.length / 3
  }

  /**
   * Smooths skin weights at bone boundaries with category-aware behavior.
   * - Torso boundaries get multi-ring gradient smoothing (3 rings, tapering weights)
   * - Limb boundaries get directional child-only smoothing
   * - Other boundaries get standard single-ring 50/50 blending
   */
  public smooth_bone_weight_boundaries (skin_indices: number[], skin_weights: number[]): void {
    const adjacency = this.build_vertex_adjacency()
    const position_to_indices = this.build_position_map()

    // Pass 1: Identify all boundary vertex pairs and classify them
    const boundary_pairs = this.find_boundary_pairs(skin_indices, skin_weights, adjacency)

    // Pass 2: Apply torso multi-ring smoothing
    this.apply_torso_smoothing(skin_indices, skin_weights, adjacency, position_to_indices, boundary_pairs)

    // Pass 3: Apply limb directional smoothing
    this.apply_limb_smoothing(skin_indices, skin_weights, position_to_indices, boundary_pairs)

    // Pass 4: Apply standard smoothing for remaining boundaries
    this.apply_standard_smoothing(skin_indices, skin_weights, position_to_indices, boundary_pairs)

    // Pass 5: Extremity boundaries — intentionally left untouched (no smoothing)
    this.apply_extremity_smoothing(boundary_pairs)
  }

  /**
   * A boundary pair tracks two adjacent vertices assigned to different bones.
   */
  private find_boundary_pairs (
    skin_indices: number[],
    skin_weights: number[],
    adjacency: Array<Set<number>>
  ): BoundaryPair[] {
    const vertex_count = this.geometry_vertex_count()
    const visited = new Set<string>()
    const pairs: BoundaryPair[] = []

    for (let i = 0; i < vertex_count; i++) {
      const offset_a = i * 4
      const bone_a = skin_indices[offset_a]
      const weight_a = skin_weights[offset_a]
      if (weight_a !== 1.0) continue

      for (const j of adjacency[i]) {
        const offset_b = j * 4
        const bone_b = skin_indices[offset_b]
        const weight_b = skin_weights[offset_b]
        if (bone_a === bone_b || weight_b !== 1.0) continue

        const key = i < j ? `${i},${j}` : `${j},${i}`
        if (visited.has(key)) continue
        visited.add(key)

        let smoothing_type: SmoothingType = SmoothingType.Standard
        if (this.classifier.is_torso_boundary(bone_a, bone_b)) {
          smoothing_type = SmoothingType.Torso
        } else if (this.classifier.is_limb_boundary(bone_a, bone_b)) {
          smoothing_type = SmoothingType.Limb
        } else if (this.classifier.is_extremity_boundary(bone_a, bone_b)) {
          smoothing_type = SmoothingType.Extremity
        }

        pairs.push({ vertex_a: i, vertex_b: j, bone_a, bone_b, smoothing_type })
      }
    }

    return pairs
  }

  /**
   * Torso smoothing: expands the blend region outward from the boundary
   * by multiple rings, applying tapering weight gradients.
   * This creates a wider, more natural transition for voluminous areas.
   */
  private apply_torso_smoothing (
    skin_indices: number[],
    skin_weights: number[],
    adjacency: Array<Set<number>>,
    position_to_indices: Map<string, number[]>,
    pairs: BoundaryPair[]
  ): void {
    const torso_pairs = pairs.filter(p => p.smoothing_type === SmoothingType.Torso)
    if (torso_pairs.length === 0) return

    // Collect all boundary vertices and their bone assignments
    const boundary_vertices = new Set<number>()
    for (const pair of torso_pairs) {
      boundary_vertices.add(pair.vertex_a)
      boundary_vertices.add(pair.vertex_b)
    }

    // Ring 0 (boundary): 50/50 blend
    // Ring 1 (one step out): 75/25 blend with neighbor bone
    // Ring 2 (two steps out): 90/10 blend with neighbor bone
    const ring_weights = [0.5, 0.25, 0.10]
    const processed = new Set<number>()

    // Apply blending ring by ring outward from the boundary
    let current_ring_vertices = new Set<number>()

    // First, blend the direct boundary pairs (ring 0)
    for (const pair of torso_pairs) {
      this.blend_vertex_pair(skin_indices, skin_weights, position_to_indices,
        pair.vertex_a, pair.vertex_b, pair.bone_a, pair.bone_b, ring_weights[0])
      processed.add(pair.vertex_a)
      processed.add(pair.vertex_b)
      current_ring_vertices.add(pair.vertex_a)
      current_ring_vertices.add(pair.vertex_b)
    }

    // Expand outward for rings 1 and 2
    for (let ring = 1; ring < ring_weights.length; ring++) {
      const next_ring_vertices = new Set<number>()
      const secondary_weight = ring_weights[ring]

      for (const vertex_idx of current_ring_vertices) {
        const offset = vertex_idx * 4
        const primary_bone = skin_indices[offset]

        for (const neighbor of adjacency[vertex_idx]) {
          if (processed.has(neighbor)) continue

          const neighbor_offset = neighbor * 4
          const neighbor_bone = skin_indices[neighbor_offset]

          // Only expand into vertices that share the same primary bone
          if (neighbor_bone !== primary_bone) continue
          if (skin_weights[neighbor_offset] !== 1.0) continue

          // Find the other bone to blend with from the boundary pair info
          const other_bone = this.find_neighbor_bone_from_boundary(vertex_idx, skin_indices, primary_bone)
          if (other_bone === -1) continue

          // Apply tapering blend to this vertex and its shared-position duplicates
          const shared = this.get_shared_vertices(neighbor, position_to_indices)
          for (const idx of shared) {
            const off = idx * 4
            skin_indices[off + 0] = neighbor_bone
            skin_indices[off + 1] = other_bone
            skin_weights[off + 0] = 1.0 - secondary_weight
            skin_weights[off + 1] = secondary_weight
            skin_indices[off + 2] = 0
            skin_indices[off + 3] = 0
            skin_weights[off + 2] = 0
            skin_weights[off + 3] = 0
          }

          processed.add(neighbor)
          next_ring_vertices.add(neighbor)
        }
      }

      current_ring_vertices = next_ring_vertices
    }
  }

  /**
   * Limb smoothing: only blends in the direction of the child bone.
   * When bone A is the parent of bone B, only vertices on the B side
   * get blended. This prevents elbow movement from deforming the bicep.
   */
  private apply_limb_smoothing (
    skin_indices: number[],
    skin_weights: number[],
    position_to_indices: Map<string, number[]>,
    pairs: BoundaryPair[]
  ): void {
    const limb_pairs = pairs.filter(p => p.smoothing_type === SmoothingType.Limb)

    for (const pair of limb_pairs) {
      // Determine parent→child relationship
      const a_is_parent = this.is_parent_of(pair.bone_a, pair.bone_b)
      const b_is_parent = this.is_parent_of(pair.bone_b, pair.bone_a)

      if (a_is_parent) {
        // bone_a is parent, bone_b is child
        // Only blend the child-side vertex (vertex_b) toward parent
        // The parent-side vertex (vertex_a) stays at 100%
        this.blend_single_side(skin_indices, skin_weights, position_to_indices,
          pair.vertex_b, pair.bone_b, pair.bone_a, 0.5)
      } else if (b_is_parent) {
        // bone_b is parent, bone_a is child
        this.blend_single_side(skin_indices, skin_weights, position_to_indices,
          pair.vertex_a, pair.bone_a, pair.bone_b, 0.5)
      } else {
        // No clear parent-child (e.g. shoulder↔spine), fall back to standard
        this.blend_vertex_pair(skin_indices, skin_weights, position_to_indices,
          pair.vertex_a, pair.vertex_b, pair.bone_a, pair.bone_b, 0.5)
      }
    }
  }

  /**
   * Extremity smoothing: intentionally does nothing. Hands, fingers, feet, and
   * toes stay 100% rigid to their assigned bone — any blend smears across the
   * small part and looks mushy. Kept as an explicit pass so the intent is clear
   * and so these boundaries aren't accidentally handled elsewhere.
   */
  private apply_extremity_smoothing (pairs: BoundaryPair[]): void {
    // no-op by design; extremity↔extremity boundaries receive no blending
    void pairs
  }

  /**
   * Standard smoothing: simple 50/50 blend at boundaries (original behavior).
   */
  private apply_standard_smoothing (
    skin_indices: number[],
    skin_weights: number[],
    position_to_indices: Map<string, number[]>,
    pairs: BoundaryPair[]
  ): void {
    const standard_pairs = pairs.filter(p => p.smoothing_type === SmoothingType.Standard)
    for (const pair of standard_pairs) {
      this.blend_vertex_pair(skin_indices, skin_weights, position_to_indices,
        pair.vertex_a, pair.vertex_b, pair.bone_a, pair.bone_b, 0.5)
    }
  }

  /**
   * Blends both vertices of a boundary pair symmetrically.
   * secondary_weight is how much influence the "other" bone gets (e.g., 0.5 = 50/50).
   */
  private blend_vertex_pair (
    skin_indices: number[],
    skin_weights: number[],
    position_to_indices: Map<string, number[]>,
    vertex_a: number,
    vertex_b: number,
    bone_a: number,
    bone_b: number,
    secondary_weight: number
  ): void {
    const primary_weight = 1.0 - secondary_weight

    const shared_a = this.get_shared_vertices(vertex_a, position_to_indices)
    for (const idx of shared_a) {
      const off = idx * 4
      skin_indices[off + 0] = bone_a
      skin_indices[off + 1] = bone_b
      skin_weights[off + 0] = primary_weight
      skin_weights[off + 1] = secondary_weight
      skin_indices[off + 2] = 0
      skin_indices[off + 3] = 0
      skin_weights[off + 2] = 0
      skin_weights[off + 3] = 0
    }

    const shared_b = this.get_shared_vertices(vertex_b, position_to_indices)
    for (const idx of shared_b) {
      const off = idx * 4
      skin_indices[off + 0] = bone_b
      skin_indices[off + 1] = bone_a
      skin_weights[off + 0] = primary_weight
      skin_weights[off + 1] = secondary_weight
      skin_indices[off + 2] = 0
      skin_indices[off + 3] = 0
      skin_weights[off + 2] = 0
      skin_weights[off + 3] = 0
    }
  }

  /**
   * Blends only one side of a boundary — used for directional limb smoothing.
   * The vertex gets a blend, but its counterpart on the other side stays rigid.
   */
  private blend_single_side (
    skin_indices: number[],
    skin_weights: number[],
    position_to_indices: Map<string, number[]>,
    vertex: number,
    primary_bone: number,
    secondary_bone: number,
    secondary_weight: number
  ): void {
    const primary_weight = 1.0 - secondary_weight
    const shared = this.get_shared_vertices(vertex, position_to_indices)
    for (const idx of shared) {
      const off = idx * 4
      skin_indices[off + 0] = primary_bone
      skin_indices[off + 1] = secondary_bone
      skin_weights[off + 0] = primary_weight
      skin_weights[off + 1] = secondary_weight
      skin_indices[off + 2] = 0
      skin_indices[off + 3] = 0
      skin_weights[off + 2] = 0
      skin_weights[off + 3] = 0
    }
  }

  /**
   * Checks if bone at index_a is a direct parent of bone at index_b
   * by walking up the bone hierarchy.
   */
  private is_parent_of (parent_index: number, child_index: number): boolean {
    const parent_bone = this.bones[parent_index]
    const child_bone = this.bones[child_index]
    if (parent_bone === undefined || child_bone === undefined) return false
    return child_bone.parent === parent_bone
  }

  /**
   * Finds the secondary bone index from a vertex that was already blended,
   * used when expanding torso rings outward.
   */
  private find_neighbor_bone_from_boundary (
    vertex_idx: number,
    skin_indices: number[],
    primary_bone: number
  ): number {
    const offset = vertex_idx * 4
    // Check the secondary influence slot
    const secondary_bone = skin_indices[offset + 1]
    if (secondary_bone !== primary_bone && secondary_bone !== 0) {
      return secondary_bone
    }
    return -1
  }

  private get_shared_vertices (vertex: number, position_to_indices: Map<string, number[]>): number[] {
    const pos = this.geometry.attributes.position
    const x = pos.getX(vertex); const y = pos.getY(vertex); const z = pos.getZ(vertex)
    const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`
    return position_to_indices.get(key) || [vertex]
  }

  private build_position_map (): Map<string, number[]> {
    const vertex_count = this.geometry_vertex_count()
    const position_to_indices = new Map<string, number[]>()
    for (let i = 0; i < vertex_count; i++) {
      const pos = this.geometry.attributes.position
      const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i)
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`
      if (!position_to_indices.has(key)) position_to_indices.set(key, [])
      position_to_indices.get(key)!.push(i)
    }
    return position_to_indices
  }

  /**
   * Builds a spatial adjacency map for the mesh vertices using geometry's index (faces).
   * Returns an array of Sets, where each Set contains the indices of neighboring vertices.
   */
  private build_vertex_adjacency (): Array<Set<number>> {
    const vertex_count = this.geometry_vertex_count()
    const adjacency: Array<Set<number>> = Array.from({ length: vertex_count }, () => new Set<number>())

    const index_attribute: BufferAttribute | null = this.geometry.index
    if (index_attribute === null) return adjacency

    const indices = index_attribute.array
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]; const b = indices[i + 1]; const c = indices[i + 2]
      adjacency[a].add(b); adjacency[a].add(c)
      adjacency[b].add(a); adjacency[b].add(c)
      adjacency[c].add(a); adjacency[c].add(b)
    }
    return adjacency
  }
}

interface BoundaryPair {
  vertex_a: number
  vertex_b: number
  bone_a: number
  bone_b: number
  smoothing_type: SmoothingType
}

enum SmoothingType {
  Torso = 'torso',
  Limb = 'limb',
  Extremity = 'extremity',
  Standard = 'standard'
}
