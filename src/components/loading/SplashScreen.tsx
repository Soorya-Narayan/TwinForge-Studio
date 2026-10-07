/**
 * TwinForge Studio - High-Performance Industrial Boot Splash Screen
 * Displays Goose Logo, boot diagnostics sequence, and software version number.
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
        const increment = Math.floor(Math.random() * 12) + 8;
        return Math.min(100, prev + increment);
      });
    }, 85);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
        const completeTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 380);
        return () => clearTimeout(completeTimer);
      }, 300);

      return () => clearTimeout(fadeTimer);
    }
  }, [progress, onComplete]);

  // Dynamic boot status description
  const getBootStatus = () => {
    if (progress < 25) return 'Initializing deterministic physics runtime (100ms)...';
    if (progress < 55) return 'Loading ISA-101 process mimics & instrumentation...';
    if (progress < 85) return 'Calibrating virtual PLC drivers & safety interlocks...';
    if (progress < 100) return 'Finalizing commissioning workspace...';
    return 'TwinForge Studio Ready';
  };

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
        transition: 'opacity 0.38s ease-out, transform 0.38s ease-out',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.015)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          maxWidth: 420,
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        {/* Goose Logo */}
        <div
          style={{
            position: 'relative',
            width: 130,
            height: 130,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(2, 132, 199, 0.12) 0%, rgba(2, 132, 199, 0) 70%)',
            }}
          />
          <img
            src="./gooselogo.png"
            alt="Goose Logo"
            style={{
              width: 110,
              height: 110,
              objectFit: 'contain',
              filter: 'drop-shadow(0 10px 24px rgba(0, 0, 0, 0.12))',
              position: 'relative',
              zIndex: 2,
            }}
          />
        </div>

        {/* Brand & Subtitle */}
        <div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              marginBottom: 4,
            }}
          >
            TwinForge Studio
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Industrial Virtual Commissioning & Automated FAT Suite
          </div>
        </div>

        {/* Industrial Progress Bar */}
        <div
          style={{
            width: 260,
            height: 4,
            background: '#e2e8f0',
            borderRadius: 99,
            overflow: 'hidden',
            marginTop: 8,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
              borderRadius: 99,
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)',
              transition: 'width 0.1s ease-out',
            }}
          />
        </div>

        {/* Boot Status Diagnostics */}
        <div
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#64748b',
            height: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {getBootStatus()}
        </div>

        {/* Software Version Number Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 12px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: 99,
            marginTop: 6,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#16a34a',
              boxShadow: '0 0 6px #16a34a',
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#334155',
              letterSpacing: '0.05em',
            }}
          >
            v1.0.0
          </span>
        </div>
      </div>
    </div>
  );
};
