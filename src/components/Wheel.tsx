import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

interface WheelProps {
  spinning: boolean;
  targetResult?: 'سؤال' | 'جرأة' | null;
  onSpinClick?: () => void;
  canSpin?: boolean;
}

export default function Wheel({ spinning, targetResult, onSpinClick, canSpin }: WheelProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (spinning && targetResult) {
      const isTruth = targetResult === 'سؤال';
      
      const baseSpins = 360 * 6; // 6 full rotations
      
      // Pick a random segment of the desired type
      const segmentIndex = Math.floor(Math.random() * 4) * 2 + (isTruth ? 0 : 1);
      
      // Each segment is 45 degrees.
      const randomOffset = (Math.random() - 0.5) * 30; // +/- 15 degrees
      const targetAngle = (segmentIndex * 45 + 22.5) + randomOffset;
      
      // Calculate final rotation
      const finalRotation = rotation + baseSpins + (360 - targetAngle);

      setRotation(finalRotation);
      
      // Haptic feedback simulation (works on supported mobile devices)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        // Vibrate a few times during the spin
        const intervals = [100, 500, 1000, 1500, 2000, 2500, 2800];
        intervals.forEach(time => {
          setTimeout(() => navigator.vibrate(20), time);
        });
      }

      // Play tick sound (simple oscillator)
      const playTick = () => {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContext) return;
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
        } catch (e) {
          // ignore
        }
      };

      // Play ticks during spin
      let tickInterval = setInterval(playTick, 150);
      setTimeout(() => clearInterval(tickInterval), 2500); // Stop ticking near the end

      setTimeout(() => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]); // Final vibration
        }
      }, 3000); // 3 seconds spin
    }
  }, [spinning, targetResult]);

  return (
    <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto my-4 sm:my-8">
      {/* Pointer */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[15px] sm:border-l-[20px] border-l-transparent border-r-[15px] sm:border-r-[20px] border-r-transparent border-t-[25px] sm:border-t-[35px] border-t-white z-20 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"></div>
      
      {/* Wheel Container */}
      <motion.div
        className="w-full h-full rounded-full border-[6px] sm:border-8 border-white/10 overflow-hidden shadow-[0_0_40px_rgba(176,38,255,0.2)] relative"
        animate={{ rotate: rotation }}
        transition={{ duration: 3, ease: [0.15, 0.85, 0.3, 1] }} // Custom ease-out curve for realistic spin
        style={{
          background: `conic-gradient(
            var(--color-neon-purple) 0deg 45deg,
            var(--color-fiery-orange) 45deg 90deg,
            var(--color-neon-purple) 90deg 135deg,
            var(--color-fiery-orange) 135deg 180deg,
            var(--color-neon-purple) 180deg 225deg,
            var(--color-fiery-orange) 225deg 270deg,
            var(--color-neon-purple) 270deg 315deg,
            var(--color-fiery-orange) 315deg 360deg
          )`
        }}
      >
        {/* Labels */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const isTruth = i % 2 === 0;
          const angle = i * 45 + 22.5;
          return (
            <div
              key={i}
              className="absolute top-0 left-1/2 -translate-x-1/2 h-1/2 origin-bottom flex items-start justify-center pt-6"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <span className="transform -rotate-90 text-lg font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wider">
                {isTruth ? 'سؤال' : 'جرأة'}
              </span>
            </div>
          );
        })}
        
        {/* Center Hub / Spin Button */}
        <button
          onClick={() => canSpin && onSpinClick && onSpinClick()}
          disabled={!canSpin || spinning}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-inner z-30 flex items-center justify-center transition-all duration-200 ${
            canSpin && !spinning 
              ? 'bg-gradient-to-br from-white to-gray-200 hover:scale-110 active:scale-95 cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.5)]' 
              : 'bg-gray-300 cursor-not-allowed opacity-90'
          }`}
        >
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${
            canSpin && !spinning ? 'bg-[#0a0f24]' : 'bg-gray-500'
          }`}>
            <span className="text-white font-black text-sm sm:text-lg tracking-wider">
              {spinning ? '...' : 'فر!'}
            </span>
          </div>
        </button>
      </motion.div>
    </div>
  );
}
