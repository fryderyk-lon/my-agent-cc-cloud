"""Re-derive the assembly constants used in src/ghost-model.js from the STL kit.

Usage: python3 scripts/derive-assembly.py [stl_dir]
Needs: pip install trimesh manifold3d scipy rtree shapely networkx

All numbers are for the back-bottom corner in the kit's frame (eye +X, up +Z, mm):
  PLATE_SEAT  base plate moved out along the corner axis until its outer face lines the
              shell's recessed inner panel (median gap < 0.6 mm; its pegs sit in the shell)
  CAP_SEAT    tip cap: its three pegs match the three holes in the shell's truncated tip, and
              it is pushed out until it no longer overlaps the shell
  REST_INSET  whole corner moved in until neighbouring corners meet edge to edge
"""
import sys
import numpy as np
import trimesh
import manifold3d as mf
from shapely.geometry import Polygon

STL = sys.argv[1] if len(sys.argv) > 1 else 'stl'
AXIS_DEG = 55.5   # common normal of the cap, the plate and the shell's tip facet
U = np.array([-np.cos(np.radians(AXIS_DEG)), 0, -np.sin(np.radians(AXIS_DEG))])


def load(name):
    return trimesh.load(f'{STL}/{name}.stl')


def to_mf(m):
    return mf.Manifold(mf.Mesh(vert_properties=np.asarray(m.vertices, dtype=np.float32),
                               tri_verts=np.asarray(m.faces, dtype=np.uint32)))


def overlap(a, b):
    return (a ^ b).volume()


def rot(axis, deg):
    return trimesh.transformations.rotation_matrix(np.radians(deg), axis)


def plate_seat(wing, plate):
    """Outward shift where the plate's outer face lines the shell (smallest median gap)."""
    radial = plate.triangles_center / np.linalg.norm(plate.triangles_center, axis=1, keepdims=True)
    outer = np.where((plate.face_normals * radial).sum(1) > 0.9)[0]
    rng = np.random.default_rng(0)
    pick = rng.choice(outer, 4000, p=plate.area_faces[outer] / plate.area_faces[outer].sum())
    pts = (plate.triangles[pick] * rng.dirichlet([1, 1, 1], 4000)[:, :, None]).sum(1)
    pq = trimesh.proximity.ProximityQuery(wing)
    best = min(np.arange(15, 22.01, 0.25), key=lambda s: np.median(np.abs(pq.signed_distance(pts + U * s))))
    return round(float(best), 2)


def hole_centres(mesh, level, interiors):
    planar, to3d = mesh.section(plane_origin=U * level, plane_normal=U).to_2D()
    rings = [r for poly in planar.polygons_full for r in (poly.interiors if interiors else [poly.exterior])]
    out = []
    for ring in rings:
        p = Polygon(ring)
        c = np.array(p.centroid.coords[0])
        out.append((trimesh.transform_points([[c[0], c[1], 0]], to3d)[0], p.area))
    return [c for c, _ in sorted(out, key=lambda x: -x[1])]


def cap_seat(wing, cap):
    """Shift the cap sideways onto the tip holes, then out until it clears the shell."""
    pegs = hole_centres(cap, 60.0, interiors=False)      # peg cross-sections, largest first
    holes = hole_centres(wing, 98.0, interiors=True)     # holes in the tip, largest first
    side = holes[0] - pegs[0]
    side -= (side @ U) * U
    flat = lambda p: p - (p @ U) * U
    for p in pegs:                                        # every peg must land on some hole
        assert min(np.linalg.norm(flat(p + side) - flat(h)) for h in holes) < 0.05, 'peg pattern mismatch'
    mw, mc = to_mf(wing), to_mf(cap)
    lo, hi = 38.0, 42.0                                   # overlapping at lo, clear at hi
    for _ in range(20):
        mid = (lo + hi) / 2
        if overlap(mw, mc.translate(tuple(side + U * mid))) > 0.01:
            lo = mid
        else:
            hi = mid
    return np.round(side + U * hi, 2), round(hi, 2)


def rest_inset(unit):
    """Inset at which the first pair of neighbouring corners touch."""
    d2 = [np.eye(4), rot([1, 0, 0], 180), rot([0, 0, 1], 180), rot([0, 1, 0], 180)]
    side = rot([1, 0, 0], -90)
    corners = []
    for m in d2:
        for b in (m, m @ side):
            corners.append((unit.transform(b[:3, :4].astype(np.float32)), b[:3, :3] @ U))

    def touching(inset):
        placed = [c.translate(tuple(-d * inset)) for c, d in corners]
        return any(overlap(placed[i], placed[j]) > 0.01
                   for i in range(len(placed)) for j in range(i + 1, len(placed)))

    lo, hi = 30.0, 40.0
    for _ in range(16):
        mid = (lo + hi) / 2
        if touching(mid):
            hi = mid
        else:
            lo = mid
    return round(lo, 2)


def main():
    wing, plate, cap = load('wing'), load('wing_inside'), load('cap')
    seat = plate_seat(wing, plate)
    cap_t, cap_out = cap_seat(wing, cap)
    plate_placed = plate.copy()
    plate_placed.apply_translation(U * seat)
    cap_placed = cap.copy()
    cap_placed.apply_translation(cap_t)
    unit = to_mf(wing) + to_mf(plate_placed) + to_mf(cap_placed)
    inset = rest_inset(unit)
    print(f'PLATE_SEAT = {seat}   (mm along the corner axis)')
    print(f'CAP_SEAT   = {cap_t.tolist()}   ({cap_out} mm along the axis)')
    print(f'REST_INSET < {inset}   (neighbouring corners touch at this inset)')


if __name__ == '__main__':
    main()
