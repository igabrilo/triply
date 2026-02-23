import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';

const BUCKET = 'Background images';

let cachedUrls: string[] | null = null;

export function useBackgroundImages(intervalMs = 10000) {
  const [bgImages, setBgImages] = useState<string[]>(cachedUrls ?? []);
  const [currentImg, setCurrentImg] = useState(0);
  const [prevImg, setPrevImg] = useState<number | null>(null);

  // Fetch all image URLs from Supabase Storage bucket (cached)
  useEffect(() => {
    if (cachedUrls) {
      setBgImages(cachedUrls);
      return;
    }

    async function fetchImages() {
      const { data, error } = await supabase.storage.from(BUCKET).list('', {
        limit: 200,
        sortBy: { column: 'name', order: 'asc' },
      });

      if (error || !data) return;

      const urls = data
        .filter((file: { name: string }) => /\.(jpg|jpeg|png|webp|avif)$/i.test(file.name))
        .map((file: { name: string }) => {
          const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(file.name);
          return urlData.publicUrl;
        });

      // Shuffle
      for (let i = urls.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [urls[i], urls[j]] = [urls[j], urls[i]];
      }

      cachedUrls = urls;
      setBgImages(urls);
    }
    fetchImages();
  }, []);

  // Rotate images randomly
  useEffect(() => {
    if (bgImages.length < 2) return;
    const interval = setInterval(() => {
      setPrevImg(currentImg);
      setCurrentImg(prev => {
        let next: number;
        do {
          next = Math.floor(Math.random() * bgImages.length);
        } while (next === prev);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(interval);
  }, [bgImages, currentImg, intervalMs]);

  // Clear prevImg after crossfade completes
  useEffect(() => {
    if (prevImg === null) return;
    const timeout = setTimeout(() => setPrevImg(null), 2500);
    return () => clearTimeout(timeout);
  }, [prevImg]);

  return { bgImages, currentImg, prevImg };
}
