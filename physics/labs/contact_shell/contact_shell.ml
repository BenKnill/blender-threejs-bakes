(* Exact-real shell for selected Box3D contact-update algebra.
   This does not verify Box3D C code or floating-point execution. *)

let contact_substep = new_definition
  `contact_substep (dt:real) n = dt / &n`;;

let normal_impulse_update = new_definition
  `normal_impulse_update old q = max (old - q) (&0)`;;

let speculative_bias = new_definition
  `speculative_bias (s:real) h = s / h`;;

let softness_mass_scale = new_definition
  `softness_mass_scale (a2:real) = a2 / (&1 + a2)`;;

let softness_impulse_scale = new_definition
  `softness_impulse_scale (a2:real) = &1 / (&1 + a2)`;;

let friction_radius = new_definition
  `friction_radius (mu:real) normal = max (mu * normal) (&0)`;;

let friction_project = new_definition
  `friction_project radius (v:real^2) =
     if norm v <= radius then v else (radius / norm v) % v`;;

let CONTACT_SUBSTEP = prove
 (`!dt n. contact_substep dt n = dt / &n`,
  REWRITE_TAC[contact_substep]);;

let CONTACT_SUBSTEP_RECOVERS_DT = prove
 (`!dt n. ~(n = 0) ==> contact_substep dt n * &n = dt`,
  REWRITE_TAC[contact_substep] THEN
  SIMP_TAC[REAL_DIV_RMUL; REAL_OF_NUM_EQ]);;

let NORMAL_IMPULSE_UPDATE_NONNEGATIVE = prove
 (`!old q. &0 <= normal_impulse_update old q`,
  REWRITE_TAC[normal_impulse_update] THEN REAL_ARITH_TAC);;

let SPECULATIVE_BIAS_EXACT = prove
 (`!s h. &0 < s ==> speculative_bias s h = s / h`,
  REWRITE_TAC[speculative_bias]);;

let SOFTNESS_SCALES_SUM = prove
 (`!a2. ~(&1 + a2 = &0)
         ==> softness_mass_scale a2 + softness_impulse_scale a2 = &1`,
  REWRITE_TAC[softness_mass_scale; softness_impulse_scale] THEN
  CONV_TAC REAL_FIELD);;

let FRICTION_RADIUS_NONNEGATIVE = prove
 (`!mu normal. &0 <= friction_radius mu normal`,
  REWRITE_TAC[friction_radius] THEN REAL_ARITH_TAC);;

let FRICTION_PROJECT_INSIDE_DISK = prove
 (`!radius (v:real^2).
     &0 <= radius
     ==> norm (friction_project radius v) <= radius`,
  REPEAT STRIP_TAC THEN REWRITE_TAC[friction_project] THEN
  COND_CASES_TAC THEN ASM_REWRITE_TAC[] THEN
  SUBGOAL_THEN `&0 < norm(v:real^2)` ASSUME_TAC THENL
   [MP_TAC(ISPEC `v:real^2` NORM_POS_LE) THEN ASM_REAL_ARITH_TAC;
    ASM_SIMP_TAC[NORM_MUL; REAL_ABS_DIV; REAL_ABS_NORM;
                 REAL_ABS_REFL; REAL_LT_IMP_LE] THEN
    ASM_SIMP_TAC[real_abs; REAL_LT_IMP_NE; REAL_DIV_RMUL] THEN
    REWRITE_TAC[REAL_LE_REFL]]);;
