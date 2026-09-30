/**
 * TwinForge Studio - Minimal Light-Mode Loading Splash Screen
 * Features the Goose Logo and software version number.
 */

import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = Math.floor(Math.random() * 10) + 8;
        return Math.min(100, prev + increment);
      });
    }, 90);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
        const completeTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 350);
        return () => clearTimeout(completeTimer);
      }, 250);

      return () => clearTimeout(fadeTimer);
    }
  }, [progress, onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        transition: 'opacity 0.35s ease-out, transform 0.35s ease-out',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.01)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {/* Goose Logo */}
        <div
          style={{
            width: 140,
            height: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/gooselogo.png"
            alt="Goose Logo"
            style={{
              width: 120,
              height: 120,
              objectFit: 'contain',
              filter: 'drop-shadow(0 6px 16px rgba(0, 0, 0, 0.08))',
            }}
          />
        </div>

        {/* Minimal Progress Bar */}
        <div
          style={{
            width: 180,
            height: 4,
            background: '#e2e8f0',
            borderRadius: 99,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: '#0284c7',
              borderRadius: 99,
              transition: 'width 0.1s ease-out',
            }}
          />
        </div>

        {/* Software Version Number */}
        <div
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#64748b',
            letterSpacing: '0.06em',
          }}
        >
          v1.0.0
        </div>
      </div>
    </div>
  );
};
