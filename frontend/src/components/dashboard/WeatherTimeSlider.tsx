import {
   WEATHER_FORECAST_STEP_SECONDS,
   clampForecastUnix,
} from '@components/dashboard/weatherForecastUtils';

interface WeatherTimeSliderProps {
   valueUnix: number;
   startUnix: number;
   endUnix: number;
   onChange: (unix: number) => void;
   label?: string;
}

function formatDetailedDate(unixSeconds: number): string {
   return new Date(unixSeconds * 1000).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
   });
}

function formatShortDate(unixSeconds: number): string {
   return new Date(unixSeconds * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      hour12: false,
   });
}

export default function WeatherTimeSlider({
   valueUnix,
   startUnix,
   endUnix,
   onChange,
   label = 'Forecast time',
}: WeatherTimeSliderProps) {
   const totalSteps = Math.max(0, Math.round((endUnix - startUnix) / WEATHER_FORECAST_STEP_SECONDS));
   const clampedValueUnix = clampForecastUnix(valueUnix, startUnix, endUnix);
   const sliderValue = Math.round((clampedValueUnix - startUnix) / WEATHER_FORECAST_STEP_SECONDS);

   return (
      <div className="weather-time-slider">
         <div className="weather-time-slider-header">
            <p className="weather-time-slider-title">{label}</p>
            <span className="weather-time-slider-value">{formatDetailedDate(clampedValueUnix)}</span>
         </div>

         <input
            className="weather-time-slider-input"
            type="range"
            min={0}
            max={totalSteps}
            step={1}
            value={sliderValue}
            onInput={(event) => {
               const stepIndex = Number(event.currentTarget.value);
               const nextUnix = startUnix + (Number.isFinite(stepIndex) ? stepIndex : 0) * WEATHER_FORECAST_STEP_SECONDS;
               onChange(nextUnix);
            }}
         />

         <div className="weather-time-slider-scale">
            <span>{formatShortDate(startUnix)}</span>
            <span>{formatShortDate(endUnix)}</span>
         </div>
      </div>
   );
}
