import { motion } from 'framer-motion';
import { Dices } from 'lucide-react';

/** Floating "Feeling lucky" pill, pinned above the home indicator. */
export default function RouletteButton({ remaining, onClick }) {
  return (
    <div className="bottom-safe pointer-events-none fixed inset-x-0 z-40 flex justify-center px-6">
      <motion.button
        onClick={onClick}
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.03 }}
        className="pointer-events-auto relative flex h-14 items-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 pl-5 pr-6 font-semibold text-white shadow-[0_12px_40px_-8px_rgba(168,85,247,0.75)]"
      >
        {/* sheen sweep */}
        <motion.span
          aria-hidden
          className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg] bg-white/25 blur-md"
          animate={{ x: ['0%', '400%'] }}
          transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
        />
        <motion.span
          animate={{ rotate: [0, -14, 14, -8, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 3.5 }}
          className="relative"
        >
          <Dices size={24} />
        </motion.span>
        <span className="relative text-[16px]">Feeling lucky</span>
        <span className="relative rounded-full bg-black/25 px-2 py-0.5 text-xs tabular-nums">{remaining} left</span>
      </motion.button>
    </div>
  );
}
