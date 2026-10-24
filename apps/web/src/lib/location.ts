"use client";

import { useEffect, useState } from "react";

// Same limits as the API (routes.service.ts). A fix worse than MAX_GPS_ACCURACY_METERS is "weak": it is still accepted for a
// check-in, but only when it places the phone within WEAK_GPS_RADIUS_METERS of the salon.
export const MAX_GPS_ACCURACY_METERS = 100;
export const WEAK_GPS_RADIUS_METERS = 50;

export type Position = { latitude: number; longitude: number; accuracy: number };

export const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const isWeakFix = (accuracy: number) => accuracy > MAX_GPS_ACCURACY_METERS;

// The distance the phone may be from the salon for this fix: the salon radius on a good fix, at most 50 m on a weak one.
export const allowedRadius = (radius: number, accuracy: number) => isWeakFix(accuracy) ? Math.min(radius, WEAK_GPS_RADIUS_METERS) : radius;

// Only readings from the last half minute are compared, so an old fix from somewhere else is never reused.
const SAMPLE_WINDOW_MS = 30_000;

// Follows the phone's location and keeps the most accurate recent reading. Phones indoors switch between satellite,
// Wi-Fi and mobile-tower fixes, so the latest reading is often much worse than one taken a few seconds earlier.
export function useBestPosition(deniedMessage: string) {
  const [position, setPosition] = useState<Position | null>(null);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    if (!navigator.geolocation) { const timer = window.setTimeout(() => setProblem("Location is not supported on this device."), 0); return () => window.clearTimeout(timer); }
    let samples: (Position & { at: number })[] = [];
    let watch = 0;
    let retry = 0;
    const start = () => {
      watch = navigator.geolocation.watchPosition(
        ({ coords }) => {
          const now = Date.now();
          samples = [...samples.filter((sample) => now - sample.at <= SAMPLE_WINDOW_MS), { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, at: now }];
          const best = samples.reduce((current, sample) => sample.accuracy <= current.accuracy ? sample : current);
          setPosition({ latitude: best.latitude, longitude: best.longitude, accuracy: best.accuracy });
          setProblem("");
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) { setProblem(deniedMessage); return; }
          // No fix yet (common indoors): keep any reading already found and try again instead of giving up.
          if (!samples.length) setProblem("Still finding your location. Keep this screen open; indoors it can take up to a minute.");
          navigator.geolocation.clearWatch(watch);
          retry = window.setTimeout(start, 2000);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    };
    start();
    return () => { navigator.geolocation.clearWatch(watch); window.clearTimeout(retry); };
  }, [deniedMessage]);
  return { position, problem };
}

export const weakSignalHint = (accuracy: number) => `Your GPS signal is weak (about ${Math.round(accuracy)} m off).${accuracy > 1000 ? " Turn on Precise Location for your browser in the phone’s settings." : ""}`;
