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

(** One scalar axial or transverse relative-velocity component is multiplied
    by (1 - friction) after the symmetric pair blend.  A blend coefficient in
    [0,1] therefore cannot increase that component's squared magnitude. *)
let HAIR_PAIR_FRICTION_COMPONENT_NONEXPANSIVE = prove
 (`!difference friction:real.
      &0 <= friction /\ friction <= &1
      ==> ((&1 - friction) * difference) pow 2 <= difference pow 2`,
  REPEAT STRIP_TAC THEN
  SUBGOAL_THEN
   `&0 <= (difference * difference) * (friction * (&2 - friction))`
  ASSUME_TAC THENL
   [MATCH_MP_TAC REAL_LE_MUL THEN CONJ_TAC THENL
     [MATCH_ACCEPT_TAC (SPEC `difference:real` REAL_LE_SQUARE);
      MATCH_MP_TAC REAL_LE_MUL THEN ASM_REAL_ARITH_TAC];
    SUBGOAL_THEN
     `difference pow 2 - ((&1 - friction) * difference) pow 2 =
      (difference * difference) * (friction * (&2 - friction))`
    ASSUME_TAC THENL [CONV_TAC REAL_RING; ASM_REAL_ARITH_TAC]]);;

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

(** A persistent contact's age advances by one nonnegative step whenever the
    bond survives.  Release deletes the age entry in the implementation. *)
let HAIR_PERSISTENT_CONTACT_AGE_MONOTONE = prove
 (`!age:real. &0 <= age ==> age <= age + &1`,
  REAL_ARITH_TAC);;

(** The current exhaustive bounded-neighbor scheduler visits each extant
    candidate once per simulation step.  Consecutive visits therefore have a
    one-step gap.  This does not yet justify a future sparse scheduler. *)
let HAIR_EXHAUSTIVE_CONTACT_SERVICE_GAP = prove
 (`!previous current:real.
      current = previous + &1 ==> current - previous = &1`,
  REAL_ARITH_TAC);;

(** Real-interval support for multi-cell AABB insertion.  If a point lies in a
    segment's coordinate interval, and that interval is covered by the declared
    low/high cell boundaries, then the point is covered too.  This does not
    prove JavaScript floor semantics or the budgeted pair emitter. *)
let HAIR_SPATIAL_AABB_CELL_INTERVAL_COVERS_POINT = prove
 (`!cell_low cell_high width low point high:real.
      &0 < width /\
      cell_low * width <= low /\
      low <= point /\ point <= high /\
      high < (cell_high + &1) * width
      ==> cell_low * width <= point /\
          point < (cell_high + &1) * width`,
  REAL_ARITH_TAC);;

(** The discovery-only ranker emits a bounded prefix after reserving persistent
    pairs.  This cardinality lemma says the prefix never exceeds its capacity
    and retains the whole list when it already fits.  It does not prove the
    JavaScript float-to-integer ranking key or physical contact completeness. *)
let HAIR_BOUNDED_PREFIX_CAPACITY = prove
 (`!capacity count:num.
      MIN capacity count <= capacity /\
      (count <= capacity ==> MIN capacity count = count)`,
  ARITH_TAC);;

(** Closest-segment ranking uses the squared norm of a separation vector, so
    its real-arithmetic idealization is nonnegative.  This does not verify the
    JavaScript parameter clamping, degeneracy branches, or quantization. *)
let HAIR_SQUARED_SEPARATION_NONNEGATIVE = prove
 (`!dx dy dz:real. &0 <= dx pow 2 + dy pow 2 + dz pow 2`,
  REPEAT GEN_TAC THEN REWRITE_TAC[REAL_POW_2] THEN
  MP_TAC(SPEC `dx:real` REAL_LE_SQUARE) THEN
  MP_TAC(SPEC `dy:real` REAL_LE_SQUARE) THEN
  MP_TAC(SPEC `dz:real` REAL_LE_SQUARE) THEN
  REAL_ARITH_TAC);;

(** The compact churn receipt partitions the current admitted finite set into
    retained contacts and additions.  This supports the cardinality runtime
    check only; it does not verify JavaScript Set operations or contact ids. *)
let HAIR_CONTACT_CHURN_CURRENT_PARTITION = prove
 (`!previous current:A->bool.
      FINITE previous /\ FINITE current
      ==> CARD (previous INTER current) + CARD (current DIFF previous) =
          CARD current`,
  REPEAT STRIP_TAC THEN
  MATCH_MP_TAC CARD_UNION_EQ THEN REPEAT CONJ_TAC THENL
   [ASM_REWRITE_TAC[];
    REWRITE_TAC[EXTENSION; IN_INTER; IN_DIFF; NOT_IN_EMPTY] THEN
    MESON_TAC[];
    REWRITE_TAC[EXTENSION; IN_UNION; IN_INTER; IN_DIFF] THEN MESON_TAC[]]);;

(** A segment contact distributes one correction over each pair of endpoints.
    When both barycentric weight pairs sum to one, equal-and-opposite contact
    corrections preserve the four-endpoint velocity sum.  Nonnegativity is
    included because the implementation clamps closest parameters to [0,1]. *)
let HAIR_BARYCENTRIC_ENDPOINT_EXCHANGE_PRESERVES_SUM = prove
 (`!a0 a1 b0 b1 wa0 wa1 wb0 wb1 correction:real.
      &0 <= wa0 /\ &0 <= wa1 /\ wa0 + wa1 = &1 /\
      &0 <= wb0 /\ &0 <= wb1 /\ wb0 + wb1 = &1
      ==> (a0 + wa0 * correction) + (a1 + wa1 * correction) +
          (b0 - wb0 * correction) + (b1 - wb1 * correction) =
          a0 + a1 + b0 + b1`,
  REPEAT STRIP_TAC THEN
  SUBGOAL_THEN `wa1 = &1 - wa0` SUBST1_TAC THENL
   [ASM_REAL_ARITH_TAC;
    SUBGOAL_THEN `wb1 = &1 - wb0` SUBST1_TAC THENL
     [ASM_REAL_ARITH_TAC; CONV_TAC REAL_RING]]);;

(** A quarter-turn of the horizontal wind vector preserves squared magnitude.
    The browser uses continuous sine/cosine directions; this is a narrow
    algebraic rotation sanity contract, not a proof of JavaScript trig. *)
let HAIR_WIND_QUARTER_TURN_PRESERVES_SQUARED_MAGNITUDE = prove
 (`!x z:real. (--z) pow 2 + x pow 2 = x pow 2 + z pow 2`,
  CONV_TAC REAL_RING);;
