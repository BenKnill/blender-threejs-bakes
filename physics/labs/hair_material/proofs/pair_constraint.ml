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

(** The axial and transverse blends may be very different; conservation only
    requires that their combined correction is exchanged symmetrically. *)
let HAIR_ANISOTROPIC_PAIR_EXCHANGE_PRESERVES_SUM = prove
 (`!velocity_a velocity_b axial_slip transverse_slip
     axial_friction transverse_friction:real.
      let correction =
        (axial_slip * axial_friction +
         transverse_slip * transverse_friction) / &2 in
      (velocity_a + correction) + (velocity_b - correction) =
      velocity_a + velocity_b`,
  REPEAT GEN_TAC THEN LET_TAC THEN REAL_ARITH_TAC);;

(** A larger release radius creates a genuine memory band: a newly capturable
    pair is necessarily still inside the release envelope. *)
let HAIR_CLUMP_CAPTURE_LIES_INSIDE_RELEASE_ENVELOPE = prove
 (`!distance capture release:real.
      distance <= capture /\ capture < release ==> distance < release`,
  REAL_ARITH_TAC);;

(** Crowd pressure is another internal exchange, so its scalar component does
    not translate the pair center. *)
let HAIR_CROWD_PRESSURE_PRESERVES_PAIR_SUM = prove
 (`!position_a position_b correction:real.
      (position_a - correction) + (position_b + correction) =
      position_a + position_b`,
  REAL_ARITH_TAC);;

(** The uncapped production pressure rule moves each endpoint by
    0.36 * (minimum_gap - distance).  Thus the scalar gap closes 0.72 of
    its deficit without crossing the minimum.  The implementation also caps
    the correction, so this is a coefficient-bearing design constraint rather
    than a choreography fact. *)
let HAIR_PRESSURE_STRENGTH_036_PREVENTS_GAP_OVERSHOOT = prove
 (`!distance minimum_gap:real.
      &0 <= distance /\ distance <= minimum_gap
      ==> distance <=
          distance + &18 / &25 * (minimum_gap - distance) /\
          distance + &18 / &25 * (minimum_gap - distance) <= minimum_gap`,
  REPEAT GEN_TAC THEN
  DISCH_THEN(CONJUNCTS_THEN ASSUME_TAC) THEN
  CONJ_TAC THEN ASM_REAL_ARITH_TAC);;

(** The hero-film diagonal director maps normalized horizontal root position to
    the cut fraction 0.78 - 0.38 x.  Before integer segment rounding, every cut
    therefore remains between 40% and 78% of the strand length. *)
let HAIR_DIAGONAL_CUT_FRACTION_BOUNDS = prove
 (`!x:real.
      &0 <= x /\ x <= &1
      ==> &2 / &5 <= &39 / &50 - (&19 / &50) * x /\
          &39 / &50 - (&19 / &50) * x <= &39 / &50`,
  REAL_ARITH_TAC);;

(** The comb benchmark accumulates a nonnegative reaction proxy times absolute
    travel.  This scalar contract justifies the runtime nonnegative-work flag;
    it does not identify the proxy with calibrated mechanical energy. *)
let HAIR_COMB_WORK_ACCUMULATION_NONNEGATIVE = prove
 (`!work reaction travel:real.
      &0 <= work /\ &0 <= reaction /\ &0 <= travel
      ==> &0 <= work + reaction * travel`,
  REPEAT STRIP_TAC THEN
  MATCH_MP_TAC REAL_LE_ADD THEN
  ASM_REWRITE_TAC[] THEN
  MATCH_MP_TAC REAL_LE_MUL THEN
  ASM_REWRITE_TAC[]);;

(** Trace displacement uses cumulative absolute comb travel.  Adding a
    nonnegative step therefore cannot move the graph's horizontal coordinate
    backwards. *)
let HAIR_COMB_CUMULATIVE_TRAVEL_MONOTONE = prove
 (`!travel step:real. &0 <= step ==> travel <= travel + step`,
  REAL_ARITH_TAC);;

(** Outward and return projection work are accumulated from nonnegative
    increments, so their cycle-dissipation proxy remains nonnegative. *)
let HAIR_COMB_CYCLE_WORK_NONNEGATIVE = prove
 (`!outward return:real.
      &0 <= outward /\ &0 <= return ==> &0 <= outward + return`,
  REAL_ARITH_TAC);;
