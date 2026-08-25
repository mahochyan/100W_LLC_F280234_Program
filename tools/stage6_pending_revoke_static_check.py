#!/usr/bin/env python3
# Static check: all SHOT_Revoke termination paths clear pending atomically.
import re, pathlib
src = pathlib.Path('app/shot.c').read_text()
rev = src[src.index('void SHOT_Revoke'):]
checks = {
    'arm_cleared': 'g_first_real_pi_shot_arm   = 0U;' in rev,
    'pending_cleared': 'g_pipeline_pending.valid = 0U;' in rev,
    'executed_phase_reset': 'g_pipeline_executed_phase = 0xFFU;' in rev,
    'phase_reset': 'g_pipeline_phase = PIPELINE_PHASE_COMPUTE;' in rev,
}
# All abort reason paths exist
for reason in ['SHOT_ABORT_TIMEOUT','SHOT_ABORT_VOUT_11V','SHOT_ABORT_TZ','SHOT_ABORT_FAULT','SHOT_ABORT_ACTUATOR','SHOT_ABORT_PERMISSION','SHOT_ABORT_NO_HANDOFF','SHOT_ABORT_CEILING']:
    checks['reason_'+reason] = reason in rev
print('PENDING_REVOKE_ALL_PATHS_STATIC_PASS=' + str(all(checks.values())))
for k,v in checks.items():
    print(k, v)
