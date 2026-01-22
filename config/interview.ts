/**
 * Interview timing configuration
 * Single source of truth for question timeout values
 */

/** Time limit per question in minutes */
export const QUESTION_TIMEOUT_MINUTES = 3;

/** Time limit per question in milliseconds (derived from minutes) */
export const QUESTION_TIME_LIMIT_MS = QUESTION_TIMEOUT_MINUTES * 60 * 1000;
