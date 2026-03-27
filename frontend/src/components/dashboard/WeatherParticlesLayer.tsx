import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

type WeatherTone = 'precip' | 'wind' | 'default';

interface Particle {
   x: number;
   y: number;
   age: number;
   ttl: number;
   width: number;
   alpha: number;
}

interface WeatherParticlesLayerProps {
   weatherLayerCode: string | null;
   enabled: boolean;
}

function getTone(layerCode: string | null): WeatherTone {
   if (layerCode === 'PR0') return 'precip';
   if (layerCode === 'WS10') return 'wind';
   return 'default';
}

function getParticleDensity(tone: WeatherTone): number {
   if (tone === 'precip') return 1.72;
   if (tone === 'wind') return 1.38;
   return 1;
}

function getFadeAlpha(tone: WeatherTone): number {
   if (tone === 'precip') return 0.08;
   if (tone === 'wind') return 0.075;
   return 0.12;
}

function getDegreeStep(tone: WeatherTone): number {
   if (tone === 'precip') return 0.31;
   if (tone === 'wind') return 0.46;
   return 0.3;
}

function supportsParticles(layerCode: string | null): boolean {
   return layerCode === 'PR0' || layerCode === 'WS10';
}

function sampleFlow(lat: number, lng: number, t: number, tone: WeatherTone): { u: number; v: number } {
   const latR = lat * (Math.PI / 180);
   const lonR = lng * (Math.PI / 180);

   const zonal =
      0.8 * Math.cos((latR * 2.5) + (lonR * 1.3) - (t * 0.9)) +
      0.55 * Math.sin((lonR * 3.8) + (t * 0.55));
   const meridional =
      0.62 * Math.sin((latR * 2.1) - (t * 0.75)) +
      0.42 * Math.cos((lonR * 2.6) - (latR * 0.8) + (t * 0.45));

   let u = zonal;
   let v = meridional;

   // Add a weak global-circulation turn so particles feel more meteorological.
   const latSign = lat >= 0 ? 1 : -1;
   u += -Math.sin(latR) * 0.22 * latSign;
   v += Math.cos(latR * 1.8) * 0.12;

   if (tone === 'precip') {
      u = u * 1.2 + Math.sin((lonR * 5.2) - (t * 1.2)) * 0.22;
      v = v * 1.1 + Math.cos((latR * 4.5) + (t * 0.8)) * 0.18;
   } else if (tone === 'wind') {
      u *= 1.35;
      v *= 1.35;
   }

   return { u, v };
}

function resetParticle(p: Particle, width: number, height: number, tone: WeatherTone): void {
   p.x = Math.random() * width;
   p.y = Math.random() * height;
   p.age = 0;
   p.ttl = 52 + Math.random() * 96;
   if (tone === 'precip') {
      p.width = 0.68 + Math.random() * 1.18;
      p.alpha = 0.2 + Math.random() * 0.22;
   } else if (tone === 'wind') {
      p.width = 0.56 + Math.random() * 1.02;
      p.alpha = 0.17 + Math.random() * 0.2;
   } else {
      p.width = 0.5 + Math.random() * 0.9;
      p.alpha = 0.18 + Math.random() * 0.18;
   }
}

export default function WeatherParticlesLayer({ weatherLayerCode, enabled }: WeatherParticlesLayerProps) {
   const map = useMap();
   const tone = useMemo(() => getTone(weatherLayerCode), [weatherLayerCode]);
   const canRenderParticles = enabled && supportsParticles(weatherLayerCode);

   const frameRef = useRef<number | null>(null);
   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const tintRef = useRef<HTMLDivElement | null>(null);
   const particlesRef = useRef<Particle[]>([]);
   const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

   useEffect(() => {
      const overlayPane = map.getPanes().overlayPane;
      if (!canRenderParticles || !overlayPane) return undefined;

      const tintEl = document.createElement('div');
      tintEl.className = `weather-tone-overlay weather-tone-overlay-${tone}`;
      overlayPane.appendChild(tintEl);
      tintRef.current = tintEl;

      const canvasEl = document.createElement('canvas');
      canvasEl.className = `weather-particles-canvas weather-particles-canvas-${tone}`;
      overlayPane.appendChild(canvasEl);
      canvasRef.current = canvasEl;

      const ctx = canvasEl.getContext('2d');
      if (!ctx) {
         overlayPane.removeChild(canvasEl);
         overlayPane.removeChild(tintEl);
         canvasRef.current = null;
         tintRef.current = null;
         return undefined;
      }

      const setCanvasSize = () => {
         const size = map.getSize();
         const dpr = Math.min(window.devicePixelRatio || 1, 2);

         sizeRef.current = { width: size.x, height: size.y, dpr };

         canvasEl.style.width = `${size.x}px`;
         canvasEl.style.height = `${size.y}px`;
         canvasEl.width = Math.max(1, Math.floor(size.x * dpr));
         canvasEl.height = Math.max(1, Math.floor(size.y * dpr));
      };

      const seedParticles = () => {
         const { width, height } = sizeRef.current;
         if (width <= 0 || height <= 0) return;

         const density = getParticleDensity(tone);
         const count = Math.max(120, Math.min(320, Math.round((width * height / 7000) * density)));
         const particles: Particle[] = [];

         for (let i = 0; i < count; i += 1) {
            const p: Particle = { x: 0, y: 0, age: 0, ttl: 0, width: 0, alpha: 0 };
            resetParticle(p, width, height, tone);
            particles.push(p);
         }

         particlesRef.current = particles;
      };

      const onViewportChanged = () => {
         const { dpr } = sizeRef.current;
         ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
         ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
      };

      const draw = (timestamp: number) => {
         const { width, height, dpr } = sizeRef.current;
         if (width <= 0 || height <= 0) {
            frameRef.current = window.requestAnimationFrame(draw);
            return;
         }

         ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
         // Fade previous trails without darkening the basemap underneath.
         ctx.globalCompositeOperation = 'destination-out';
         ctx.fillStyle = `rgba(0, 0, 0, ${getFadeAlpha(tone)})`;
         ctx.fillRect(0, 0, width, height);
         ctx.globalCompositeOperation = 'source-over';

         const t = timestamp * 0.001;
         const degreeStep = getDegreeStep(tone);
         const zoomScale = Math.max(0.82, Math.min(1.55, map.getZoom() / 8.7));
         const speedBoost = tone === 'precip' ? 1.06 : tone === 'wind' ? 1.16 : 1;

         for (const p of particlesRef.current) {
            if (p.age >= p.ttl || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
               resetParticle(p, width, height, tone);
               continue;
            }

            const startX = p.x;
            const startY = p.y;

            try {
               const ll = map.containerPointToLatLng(L.point(startX, startY));
               const flow = sampleFlow(ll.lat, ll.lng, t, tone);
               const nextLL = L.latLng(ll.lat + (flow.v * degreeStep), ll.lng + (flow.u * degreeStep));
               const projected = map.latLngToContainerPoint(nextLL);

               const vx = (projected.x - startX) * zoomScale * speedBoost;
               const vy = (projected.y - startY) * zoomScale * speedBoost;

               if (!Number.isFinite(vx) || !Number.isFinite(vy) || Math.abs(vx) + Math.abs(vy) < 0.008) {
                  p.age = p.ttl;
                  continue;
               }

               p.x += vx;
               p.y += vy;

               ctx.globalCompositeOperation = 'source-over';
               ctx.beginPath();
               ctx.moveTo(startX, startY);
               ctx.lineTo(p.x, p.y);

               const stroke = tone === 'precip'
                  ? `rgba(240, 248, 255, ${p.alpha})`
                  : tone === 'wind'
                     ? `rgba(232, 243, 253, ${p.alpha * 0.95})`
                     : `rgba(220, 234, 248, ${p.alpha * 0.75})`;

               ctx.strokeStyle = stroke;
               ctx.lineWidth = p.width;
               ctx.lineCap = 'round';
               ctx.stroke();

               p.age += 1;
            } catch {
               // During fast map transitions (zoom/pan), projection can temporarily fail.
               p.age = p.ttl;
            }
         }

         frameRef.current = window.requestAnimationFrame(draw);
      };

      setCanvasSize();
      seedParticles();

      map.on('resize', setCanvasSize);
      map.on('resize', seedParticles);
      map.on('moveend', onViewportChanged);
      map.on('zoomend', onViewportChanged);

      frameRef.current = window.requestAnimationFrame(draw);

      return () => {
         if (frameRef.current != null) {
            window.cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
         }

         map.off('resize', setCanvasSize);
         map.off('resize', seedParticles);
         map.off('moveend', onViewportChanged);
         map.off('zoomend', onViewportChanged);

         if (canvasRef.current && canvasRef.current.parentNode) {
            canvasRef.current.parentNode.removeChild(canvasRef.current);
         }
         if (tintRef.current && tintRef.current.parentNode) {
            tintRef.current.parentNode.removeChild(tintRef.current);
         }

         canvasRef.current = null;
         tintRef.current = null;
         particlesRef.current = [];
      };
   }, [canRenderParticles, map, tone]);

   return null;
}
