/*
 * w5_reference_transition.c
 *
 * Pure W5 reference-table and gate logic.  There are intentionally no PWM,
 * Trip-Zone, control, protection, or host-writable globals in this module.
 * The eventual compile-gated W5 owner must call these gates from the already
 * qualified permission/abort path.
 */
#include "w5_reference_transition.h"

/* target, -3%, +3%, +5% abort; all values use the measured board calibration
 * and the same positive-value rounding as CTRL_VoltsToRaw(). */
const W5REF_Rung g_w5ref_rungs[W5REF_RUNG_COUNT] =
{
    {1244U, 1207U, 1281U, 1306U},
    {1306U, 1267U, 1345U, 1371U},
    {1368U, 1327U, 1408U, 1436U},
    {1430U, 1387U, 1472U, 1501U},
    {1491U, 1447U, 1536U, 1565U}
};

Uint16 W5REF_GetRung(Uint16 rung_index, W5REF_Rung *result)
{
    if (rung_index >= W5REF_RUNG_COUNT || result == 0)
        return 0U;
    *result = g_w5ref_rungs[rung_index];
    return 1U;
}

Uint16 W5REF_RequestShapeValid(Uint16 rung_index, Uint32 duration_ticks)
{
    if (rung_index >= W5REF_RUNG_COUNT)
        return 0U;
    if (duration_ticks != W5REF_DURATION_100MS_TICKS &&
        duration_ticks != W5REF_DURATION_2S_TICKS)
        return 0U;
    return 1U;
}

Uint16 W5REF_SteadyRawAccepted(Uint16 rung_index, Uint16 vout_raw)
{
    const W5REF_Rung *rung;
    if (rung_index >= W5REF_RUNG_COUNT)
        return 0U;
    rung = &g_w5ref_rungs[rung_index];
    return (Uint16)(vout_raw >= rung->accept_low_raw &&
                    vout_raw <= rung->accept_high_raw);
}

Uint16 W5REF_VoutAbortReason(Uint16 rung_index, Uint16 vout_raw)
{
    if (rung_index >= W5REF_RUNG_COUNT)
        return W5REF_ABORT_INVALID_RUNG;
    if (vout_raw >= W5REF_ABSOLUTE_CEILING_RAW)
        return W5REF_ABORT_ABSOLUTE_VOUT;
    if (vout_raw >= g_w5ref_rungs[rung_index].stage_abort_raw)
        return W5REF_ABORT_STAGE_VOUT;
    return W5REF_ABORT_NONE;
}

Uint16 W5REF_FrequencyInEnvelope(Uint32 frequency_hz)
{
    return (Uint16)(frequency_hz >= W5REF_FREQ_MIN_HZ &&
                    frequency_hz <= W5REF_FREQ_MAX_HZ);
}
