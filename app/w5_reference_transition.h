/*
 * w5_reference_transition.h
 *
 * W5 offline-prepared immutable reference ladder.  This module is not linked
 * into either frozen W4 build.  Its pure lookup/gate functions are integrated
 * only after the two W4 real A/B/A captures close.
 */
#ifndef APP_W5_REFERENCE_TRANSITION_H
#define APP_W5_REFERENCE_TRANSITION_H

#include "DSP2803x_Device.h"

#define W5REF_RUNG_COUNT                 5U
#define W5REF_DURATION_100MS_TICKS    5000UL
#define W5REF_DURATION_2S_TICKS     100000UL

#define W5REF_FREQ_MIN_HZ             145000UL
#define W5REF_FREQ_MAX_HZ             170000UL

/* Immutable 12 V +10% calibrated raw ceiling, independent of the selected
 * rung's tighter +5% abort. */
#define W5REF_ABSOLUTE_CEILING_RAW       1640U

#define W5REF_ABORT_NONE                    0U
#define W5REF_ABORT_INVALID_RUNG            1U
#define W5REF_ABORT_STAGE_VOUT               2U
#define W5REF_ABORT_ABSOLUTE_VOUT            3U

typedef struct
{
    Uint16 target_raw;
    Uint16 accept_low_raw;
    Uint16 accept_high_raw;
    Uint16 stage_abort_raw;
} W5REF_Rung;

extern const W5REF_Rung g_w5ref_rungs[W5REF_RUNG_COUNT];

Uint16 W5REF_GetRung(Uint16 rung_index, W5REF_Rung *result);
Uint16 W5REF_RequestShapeValid(Uint16 rung_index, Uint32 duration_ticks);
Uint16 W5REF_SteadyRawAccepted(Uint16 rung_index, Uint16 vout_raw);
Uint16 W5REF_VoutAbortReason(Uint16 rung_index, Uint16 vout_raw);
Uint16 W5REF_FrequencyInEnvelope(Uint32 frequency_hz);

#endif /* APP_W5_REFERENCE_TRANSITION_H */
