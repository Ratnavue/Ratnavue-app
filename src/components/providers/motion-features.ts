// The animation features MotionProvider loads after the page is up — kept in
// their own module so the dynamic import below becomes a separate chunk.
// domMax (not domAnimation) because the Navbar's sliding active-link pill
// uses a shared-layout animation (layoutId).
export { domMax as default } from "motion/react";
