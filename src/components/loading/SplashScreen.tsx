/**
 * TwinForge Studio - Apple-Inspired Minimalist Boot Screen
 * Features only the Goose logo and the iconic Apple boot progress bar on a black canvas.
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
        const increment = Math.floor(Math.random() * 8) + 6;
        return Math.min(100, prev + increment);
      });
    }, 65);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
        const completeTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 400);
        return () => clearTimeout(completeTimer);
      }, 200);

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
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        transition: 'opacity 0.45s ease-out',
        opacity: isFadingOut ? 0 : 1,
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 34,
        }}
      >
        {/* Goose Logo */}
        <img
          src="./gooselogo.png"
          alt="Logo"
          style={{
            width: 96,
            height: 96,
            objectFit: 'contain',
          }}
        />

        {/* Apple Style Progress Bar */}
        <div
          style={{
            width: 175,
            height: 5,
            background: '#262626',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: '#ffffff',
              borderRadius: 999,
              transition: 'width 0.1s cubic-bezier(0.25, 1, 0.5, 1)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
