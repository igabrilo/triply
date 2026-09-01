import { motion } from 'framer-motion';

interface Props {
  bgImages: string[];
  currentImg: number;
  prevImg: number | null;
  overlayOpacity?: number;
}

/* Cycle through three Ken Burns variants so consecutive images move differently */
const KB_ANIMATIONS = ['ken-burns-a', 'ken-burns-b', 'ken-burns-c'] as const;

function kbStyle(index: number): React.CSSProperties {
  const name = KB_ANIMATIONS[index % KB_ANIMATIONS.length];
  return {
    position: 'absolute',
    inset: '-8%',        // oversized so the slow zoom never reveals an edge
    backgroundImage: 'inherit',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    animation: `${name} 60s ease-in-out both`,
    willChange: 'transform',
  };
}

export default function CrossfadeBackground({
  bgImages, currentImg, prevImg, overlayOpacity = 0.82,
}: Props) {
  if (bgImages.length === 0) return null;

  return (
    <>
      {/* Previous image — fade out, no Ken Burns (it's leaving) */}
      {prevImg !== null && (
        <motion.div
          key={`prev-${prevImg}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            zIndex: 0,
          }}
        >
          <div
            style={{
              ...kbStyle(prevImg),
              backgroundImage: `url(${bgImages[prevImg]})`,
            }}
          />
        </motion.div>
      )}

      {/* Current image — zoom-in on fade-in, then Ken Burns continues */}
      <motion.div
        key={`current-${currentImg}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        <div
          style={{
            ...kbStyle(currentImg),
            backgroundImage: `url(${bgImages[currentImg]})`,
          }}
        />
      </motion.div>

      {/* Overlay — soft vignette-style gradient instead of flat white */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at center, rgba(255,255,255,${overlayOpacity - 0.05}) 0%, rgba(255,255,255,${overlayOpacity + 0.04}) 100%)
          `,
          backdropFilter: 'blur(1.5px)',
          zIndex: 1,
        }}
      />
    </>
  );
}
