'use client';

import { useRef, useEffect, useMemo } from 'react';

const COLORS = [
  '#dc3545', '#f5b800', '#28a745', '#4a6fa5',
  '#6f42c1', '#fd7e14', '#17a2b8', '#e83e8c',
  '#20c997', '#333333',
];

export default function SpinnerWheel({ numbers = [], isSpinning, selectedNumber }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rotationRef = useRef(0);
  const animationRef = useRef(null);

  const displayNumbers = useMemo(() => {
    if (numbers.length === 0) return Array.from({ length: 12 }, (_, i) => i + 1);
    // Show max 16 numbers on wheel
    return numbers.slice(0, 16);
  }, [numbers]);

  // Draw the wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = 380;
    canvas.width = size;
    canvas.height = size;
    const center = size / 2;
    const radius = center - 10;

    const drawWheel = (rotation = 0) => {
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate((rotation * Math.PI) / 180);

      const segmentAngle = (2 * Math.PI) / displayNumbers.length;

      displayNumbers.forEach((num, i) => {
        const startAngle = i * segmentAngle;
        const endAngle = startAngle + segmentAngle;

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw number
        ctx.save();
        ctx.rotate(startAngle + segmentAngle / 2);
        ctx.translate(radius * 0.7, 0);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 3;
        ctx.fillText(String(num), 0, 0);
        ctx.restore();
      });

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.restore();
    };

    if (isSpinning) {
      let speed = 15;
      const deceleration = 0.04;
      let currentRotation = rotationRef.current;

      const animate = () => {
        currentRotation += speed;
        speed = Math.max(speed - deceleration, 0);
        drawWheel(currentRotation);
        rotationRef.current = currentRotation;

        if (speed > 0) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      // Random extra spins
      const extraSpins = 720 + Math.random() * 720;
      speed = 15;
      rotationRef.current += extraSpins;
      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    } else {
      drawWheel(rotationRef.current);
    }
  }, [displayNumbers, isSpinning]);

  return (
    <div className="spinner-wheel" ref={containerRef}>
      <div className="spinner-wheel__pointer" />
      <canvas ref={canvasRef} className="spinner-wheel__canvas" />
      <div className="spinner-wheel__center" />
    </div>
  );
}
