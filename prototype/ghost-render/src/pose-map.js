// Maps clip-level ring angles onto rotations about the model's eye axis (+X in the STL frame, pointing
// at the viewer). By the right-hand rule a positive rotation about +X is counter-clockwise seen from the
// eye, so the front ring (clockwise) takes the negative angle and the back ring the positive one.
const RAD = Math.PI / 180;

export const ringRotationX = ({ ringFront = 0, ringBack = 0 }) => ({ front: -ringFront * RAD, back: ringBack * RAD });
