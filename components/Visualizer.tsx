
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  analyzerRef: React.MutableRefObject<AnalyserNode | null>;
  mode: 'listening' | 'speaking' | 'idle';
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, analyzerRef, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const paramsRef = useRef({
    joy: 0,      
    anger: 0,    
    sorrow: 0,   
    surprise: 0, 
  });
  
  const prevEnergyRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = 256;
    const dataArray = new Uint8Array(bufferLength);
    
    let time = 0;

    const render = () => {
      if (!isActive && mode === 'idle') {
          ctx.clearRect(0, 0, rect.width, rect.height);
          animationFrameRef.current = requestAnimationFrame(render);
          return;
      }

      time += 0.015;
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      let average = 0;       
      let weightedSum = 0;

      if (isActive && analyzerRef.current) {
        try {
            analyzerRef.current.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            average = sum / bufferLength;
        } catch(e) {}
      }

      const normalizedEnergy = average / 255;
      const lerp = (current: number, target: number, speed: number) => current + (target - current) * speed;
      
      paramsRef.current.joy = lerp(paramsRef.current.joy, mode === 'speaking' ? normalizedEnergy * 2 : 0, 0.05);

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const baseRadius = 80;
      const intensity = Math.max(normalizedEnergy, 0.05);
      const scale = 1 + (intensity * 0.8);

      // --- KOKORO PINK COLOR PALETTE ---
      let r = 236, g = 72, b = 153; // Pink-500
      
      if (mode === 'idle') {
        r = 139; g = 92; b = 246; // Violet-500
      } else if (mode === 'listening') {
        r = 16; g = 185; b = 129; // Emerald-500
      }

      const colorMain = `rgb(${r}, ${g}, ${b})`;
      
      // Aura
      const gradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, baseRadius * scale * 2);
      gradient.addColorStop(0, colorMain);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * scale * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Fluid Core
      for (let j = 0; j < 2; j++) {
        ctx.beginPath();
        const layerScale = 1 - (j * 0.2);
        for (let i = 0; i <= 60; i++) {
          const angle = (Math.PI * 2 * i) / 60;
          const noise = Math.sin(angle * 4 + time * (1 + j)) * 15 * intensity;
          const dist = (baseRadius * scale * layerScale) + noise;
          const x = cx + Math.cos(angle) * dist;
          const y = cy + Math.sin(angle) * dist;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = j === 0 ? `rgba(${r}, ${g}, ${b}, 0.7)` : `rgba(${r+20}, ${g+20}, ${b+20}, 0.4)`;
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isActive, mode, analyzerRef]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

export default Visualizer;
