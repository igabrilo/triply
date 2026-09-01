export const WEATHER_FORECAST_STEP_SECONDS = 60 * 60;
export const WEATHER_FORECAST_WINDOW_DAYS = 4;
export const WEATHER_FORECAST_WINDOW_SECONDS = WEATHER_FORECAST_WINDOW_DAYS * 24 * 60 * 60;

export function alignForecastUnix(unixSeconds: number): number {
   return Math.floor(unixSeconds / WEATHER_FORECAST_STEP_SECONDS) * WEATHER_FORECAST_STEP_SECONDS;
}

export function getWeatherWindowBounds(nowUnixSeconds = Math.floor(Date.now() / 1000)): {
   startUnix: number;
   endUnix: number;
} {
   const startUnix = alignForecastUnix(nowUnixSeconds);
   return {
      startUnix,
      endUnix: startUnix + WEATHER_FORECAST_WINDOW_SECONDS,
   };
}

export function parseTripStartUnix(startDate: string | undefined): number | undefined {
   if (!startDate) return undefined;
   const parsed = new Date(`${startDate}T12:00:00Z`);
   if (Number.isNaN(parsed.getTime())) return undefined;
   return Math.floor(parsed.getTime() / 1000);
}

export function getInitialForecastUnix(startDate: string | undefined): number {
   const window = getWeatherWindowBounds();
   const tripStartUnix = parseTripStartUnix(startDate);

   if (typeof tripStartUnix === 'number') {
      const alignedTripStartUnix = alignForecastUnix(tripStartUnix);
      if (alignedTripStartUnix >= window.startUnix && alignedTripStartUnix <= window.endUnix) {
         return alignedTripStartUnix;
      }
   }

   return window.startUnix;
}

export function clampForecastUnix(unixSeconds: number, startUnix: number, endUnix: number): number {
   const alignedUnix = alignForecastUnix(unixSeconds);
   if (alignedUnix < startUnix) return startUnix;
   if (alignedUnix > endUnix) return endUnix;
   return alignedUnix;
}
