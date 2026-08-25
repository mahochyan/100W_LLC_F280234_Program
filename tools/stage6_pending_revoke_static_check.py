#!/usr/bin/env python3
# STAGE6_WIP_CORRECTION_ISR_PENDING_CLOSURE_V1_1
# Static check: SHOT_Revoke has a common-entry pending clear before any branch/return.
import pathlib, re

src = pathlib.Path('app/shot.c').read_text()
# Extract SHOT_Revoke body
start = src.index('void SHOT_Revoke(')
# Find matching brace (simple scan)
brace = 0
end = None
for i in range(start, len(src)):
    if src[i] == '{':
        brace += 1
    elif src[i] == '}':
        brace -= 1
        if brace == 0:
            end = i
            break
body = src[start:end+1]

# 1. Common entry clear present before any reason branch and before any return
clear_idx = body.find('g_pipeline_pending.valid = 0U;')
arm_idx = body.find('g_first_real_pi_shot_arm   = 0U;')
first_reason = len(body)
for m in re.finditer(r'if \(reason ==', body):
    first_reason = min(first_reason, m.start())
first_return = len(body)
for m in re.finditer(r'\breturn\b', body):
    first_return = min(first_return, m.start())

ok1 = clear_idx != -1 and arm_idx != -1 and clear_idx < first_reason and clear_idx < first_return

# 2. No return before the clear (common entry)
ok2 = first_return > clear_idx

# 3. All SHOT_Revoke calls use known enum constants
known = ['SHOT_ABORT_TIMEOUT','SHOT_ABORT_VOUT_11V','SHOT_ABORT_TZ','SHOT_ABORT_FAULT',
         'SHOT_ABORT_ACTUATOR','SHOT_ABORT_PERMISSION','SHOT_ABORT_NO_HANDOFF','SHOT_ABORT_CEILING']
calls = [c for c in re.findall(r'SHOT_Revoke\(([^)]+)\)', src) if c.strip() != 'Uint16 reason']
ok3 = all(c.strip() in known for c in calls)

# 4. All termination paths eventually reach common clear (structural: clear before branches)
ok4 = ok1

print('PENDING_REVOKE_COMMON_ENTRY_STATIC_PASS=' + str(ok1 and ok2 and ok3 and ok4))
print('clear_before_reason=' + str(ok1))
print('no_return_before_clear=' + str(ok2))
print('all_calls_known_enum=' + str(ok3))
print('common_entry_final=' + str(ok4))
if not ok3:
    print('bad_calls=' + str([c for c in calls if c.strip() not in known]))
