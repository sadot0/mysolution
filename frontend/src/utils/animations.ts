import { Variants } from 'framer-motion';

// Page transition — with blur for polish
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 12, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.2 } },
};

// Stagger children container
export const staggerContainer: Variants = {
  animate: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

// Stagger child items (for cards, list rows)
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 15, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// Fade in from left (sidebar items)
export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

// Scale up (modals, popups)
export const scaleUp: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// Fade overlay
export const fadeOverlay: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// Card hover spring
export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: { type: 'spring', stiffness: 300, damping: 20 } },
};

// Stat number count-up (use with animate={{ scale: [0.8, 1.05, 1] }})
export const numberPop: Variants = {
  initial: { opacity: 0, scale: 0.5 },
  animate: {
    opacity: 1,
    scale: [0.5, 1.1, 1],
    transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
  },
};

// Progress bar fill
export const progressFill = (width: string) => ({
  initial: { width: '0%' },
  animate: { width, transition: { duration: 1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 } },
});

// List item slide
export const listSlide: Variants = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: 10, transition: { duration: 0.15 } },
};
