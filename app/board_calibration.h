/*
 * board_calibration.h
 *
 * Real-board VOUT ADC calibration — LLC_STAGE5_ACCEPTANCE_SPRINT_V2.
 * Measured interactively with a DMM on the PASSed CALIBRATION_MEASURE_HOLD
 * platform (2026-08-17).
 *
 *   VOUT = BOARD_VOUT_GAIN_V_PER_RAW * raw + BOARD_VOUT_OFFSET_V
 *
 * All coefficients derive from DMM measurements; do not edit by hand —
 * re-run the DMM calibration procedure instead.
 */
#ifndef BOARD_CALIBRATION_H
#define BOARD_CALIBRATION_H

#define BOARD_VOUT_CAL_VALID       1

#define BOARD_VOUT_GAIN_V_PER_RAW  0.008089325f
#define BOARD_VOUT_OFFSET_V        (-0.063715f)

/* Software targets derived from the calibrated transfer */
#define BOARD_VOUT_RAW_10V         1244U
#define BOARD_VOUT_RAW_12V         1491U
#define BOARD_VOUT_RAW_15V         1862U

#endif /* BOARD_CALIBRATION_H */
