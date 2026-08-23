/**
 * Reading the wall clock, as something handed to whoever needs it
 * (CODING_STANDARDS "Time": a module that reads the clock takes it as a
 * parameter). One declaration for both ends, because both have it: the room
 * stamps a round with when it opened, and the interface counts forward from that
 * stamp — and a test of either states the moment rather than waiting for it.
 */
export type Clock = () => number
