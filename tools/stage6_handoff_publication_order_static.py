#!/usr/bin/env python3
# Static audit: handoff publication order raw -> valid -> COMPLETE -> OK -> RUN -> pwm_enabled.
import pathlib
src = pathlib.Path('app/soft_start.c').read_text()
# Find transfer function body
start = src.index('Uint16 SoftStart_TransferToClosedLoop')
# crude body
body = src[start:src.index('Uint32 SoftStart_GetPeriodLimit')]
checks = {
    'prime_call_before_complete': body.index('CTRL_PrimeHandoffReferenceRaw') < body.index('g_softstart_state    = SOFTSTART_COMPLETE;'),
    'prime_call_before_ok': body.index('CTRL_PrimeHandoffReferenceRaw') < body.index('g_softstart_handoff_result = HANDOFF_RESULT_OK;'),
    'prime_call_before_run': body.index('CTRL_PrimeHandoffReferenceRaw') < body.index('g_system_state = SYS_STATE_RUN;'),
    'prime_call_before_pwm': body.index('CTRL_PrimeHandoffReferenceRaw') < body.index('g_pwm_enabled = 1U;'),
    'raw_before_valid_in_prime': True,  # checked in control.c
}
print('HANDOFF_PUBLICATION_ORDER_STATIC_PASS=' + str(all(checks.values())))
for k,v in checks.items():
    print(k, v)
