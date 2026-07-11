(** Conservation law used by the material-bench pair projection.

    projectPair applies opposite corrections weighted by inverse mass.  This
    theorem proves, component by component, that the corrections preserve the
    mass-weighted position of the pair.  It does not prove convergence,
    collision behavior, or the complete JavaScript implementation. *)

let HAIR_PAIR_CORRECTION_PRESERVES_MOMENT = prove
 (`!mass_a mass_b scale delta:real.
      ~(mass_a = &0) /\ ~(mass_b = &0)
      ==> mass_a * (inv mass_a * scale * delta) +
          mass_b * (--(inv mass_b * scale * delta)) = &0`,
  REPEAT STRIP_TAC THEN
  REPEAT(POP_ASSUM MP_TAC) THEN
  CONV_TAC REAL_FIELD);;

let HAIR_EQUAL_MASS_FRICTION_PRESERVES_VELOCITY_SUM = prove
 (`!velocity_a velocity_b friction:real.
      (velocity_a +
       (((velocity_a + velocity_b) / &2) - velocity_a) * friction) +
      (velocity_b +
       (((velocity_a + velocity_b) / &2) - velocity_b) * friction) =
      velocity_a + velocity_b`,
  CONV_TAC REAL_FIELD);;
