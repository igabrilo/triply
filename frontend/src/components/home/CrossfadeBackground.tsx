import { motion } from 'framer-motion';

interface Props {
  bgImages: string[];
  currentImg: number;
  prevImg: number | null;
  overlayOpacity?: number;
}

export default function CrossfadeBackground({ bgImages, currentImg, prevImg, overlayOpacity = 0.82 }: Props) {
  if (bgImages.length === 0) return null;

  return (
    <>
      {/* Previous image (fading out) */}
      {prevImg !== null && (
        <motion.div
          key={`prev-${prevImg}`}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bgImages[prevImg]})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 0,
          }}
        />
      )}

      {/* Current image (fading in) */}
      <motion.div
        key={`current-${currentImg}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.5, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${bgImages[currentImg]})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }}
      />

      {/* Semi-transparent overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(255, 255, 255, ${overlayOpacity})`,
          backdropFilter: 'blur(2px)',
          zIndex: 1,
        }}
      />
    </>
  );
}
