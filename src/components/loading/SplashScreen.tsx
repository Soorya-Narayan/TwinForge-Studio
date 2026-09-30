/**
 * TwinForge Studio - Industrial Loading Splash Screen
 * Featuring Goose Logo, telemetry initialization diagnostics, and smooth fade transition.
 */

import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onComplete?: () => void;
}

const INIT_STEPS = [
  'INITIALIZING HYDROSTATIC DYNAMICS & FLUID SOLVER...',
  'DISCOVERING ACTUATORS & P&ID INSTRUMENT TOPOLOGY...',
  'BINDING DETERMINISTIC PLC DRIVER REGISTERS (100ms)...',
  'CALIBRATING 4-SECTION HEAT EXCHANGER DYNAMICS...',
  'SYNCHRONIZING TREND OSCILLOSCOPE CHANNELS...',
  'TWINFORGE STUDIO READY · ENTERING OPERATOR WORKSPACE',
];

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Progress increment timer
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Realistic industrial pacing
        const increment = Math.floor(Math.random() * 8) + 5;
        const next = Math.min(100, prev + increment);
        const nextStep = Math.min(
          INIT_STEPS.length - 1,
          Math.floor((next / 100) * INIT_STEPS.length)
        );
        setStepIndex(nextStep);
        return next;
      });
    }, 110);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
        const completeTimer = setTimeout(() => {
          if (onComplete) onComplete();
        }, 450);
        return () => clearTimeout(completeTimer);
      }, 350);

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
        background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #111e38 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        transition: 'opacity 0.45s ease-out, transform 0.45s ease-out',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.02)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
      }}
    >
      {/* Background Subtle Industrial Grid Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(14, 165, 233, 0.08) 1px, transparent 1px), radial-gradient(rgba(2, 132, 199, 0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          backgroundPosition: '0 0, 14px 14px',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />

      {/* Main Brand & Identity Container */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 460,
          width: '90%',
          textAlign: 'center',
        }}
      >
        {/* Goose Logo Container with Soft Glow */}
        <div
          style={{
            position: 'relative',
            width: 110,
            height: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          {/* Animated Glow Disc behind Logo */}
          <div
            style={{
              position: 'absolute',
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(2, 132, 199, 0.35) 0%, rgba(2, 132, 199, 0) 70%)',
              filter: 'blur(10px)',
              animation: 'pulse 2.4s ease-in-out infinite alternate',
            }}
          />

          <img
            src="/gooselogo.png"
            alt="Goose Logo"
            style={{
              width: 96,
              height: 96,
              objectFit: 'contain',
              position: 'relative',
              zIndex: 1,
              filter: 'drop-shadow(0 8px 18px rgba(0, 0, 0, 0.4))',
            }}
          />
        </div>

        {/* Product & Enterprise Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#38bdf8',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            GOOSE INDUSTRIAL SOLUTIONS
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
            }}
          >
            TwinForge Studio
          </h1>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#94a3b8',
              letterSpacing: '0.04em',
            }}
          >
            Virtual Commissioning & Automated FAT Engine
          </div>
        </div>

        {/* Industrial Progress Bar Container */}
        <div
          style={{
            width: '100%',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 6,
            padding: 3,
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.5)',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              height: 6,
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 80%, #7dd3fc 100%)',
              borderRadius: 4,
              transition: 'width 0.12s ease-out',
              boxShadow: '0 0 12px rgba(56, 189, 248, 0.65)',
            }}
          />
        </div>

        {/* Status Line & Percentage */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10.5,
            fontFamily: 'monospace',
            color: '#64748b',
          }}
        >
          <span style={{ color: '#38bdf8', fontWeight: 600, letterSpacing: '0.02em' }}>
            {INIT_STEPS[stepIndex]}
          </span>
          <span style={{ color: '#f8fafc', fontWeight: 700, minWidth: 38, textAlign: 'right' }}>
            {progress}%
          </span>
        </div>

        {/* System Badges Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 34,
            paddingTop: 16,
            borderTop: '1px solid rgba(51, 65, 85, 0.5)',
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(2, 132, 199, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontFamily: 'monospace',
            }}
          >
            ISA-101 HMI
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80',
              border: '1px solid rgba(74, 222, 128, 0.3)',
              fontFamily: 'monospace',
            }}
          >
            REAL-TIME HYDRO DYNAMICS
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#c084fc',
              border: '1px solid rgba(192, 132, 252, 0.3)',
              fontFamily: 'monospace',
            }}
          >
            PLC ENGINE v2.4
          </span>
        </div>
      </div>
    </div>
  );
};
