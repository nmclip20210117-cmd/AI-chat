
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  analyzerRef: React.MutableRefObject<AnalyserNode | null>;
  mode: 'listening' | 'speaking' | 'idle';
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, analyzerRef, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);

    const bufferLength = 128;
    const dataArray = new Uint8Array(bufferLength);
    let time = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      ctx.clearRect(0, 0, rect.width, rect.height);
      
      let average = 0;
      if (isActive && analyzerRef.current) {
        try {
            analyzerRef.current.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            average = sum / bufferLength;
        } catch(e) {}
      }

      time += 0.02;
      const intensity = average / 255;
      // 半径をさらに控えめに設定 (最大でも画面端に当たらないように)
      const baseRadius = Math.min(rect.width, rect.height) * 0.14; 
      const scale = 1 + (intensity * 1.1);

      // --- COLORS ---
      let r = 236, g = 72, b = 153; // Default Pink
      if (mode === 'idle') { r = 139; g = 92; b = 246; } // Violet
      else if (mode === 'listening') { r = 16; g = 185; b = 129; } // Emerald

      ctx.globalCompositeOperation = 'screen';

      // 1. Large Outer Glow (Aura) - 余裕を持ったサイズに縮小
      const auraGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * scale * 2.1);
      auraGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.15 + intensity * 0.15})`);
      auraGradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.01)`);
      auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * scale * 2.1, 0, Math.PI * 2);
      ctx.fillStyle = auraGradient;
      ctx.fill();

      // 2. Middle Glow
      const midGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * scale * 1.4);
      midGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.3 + intensity * 0.3})`);
      midGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * scale * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = midGradient;
      ctx.fill();

      // 3. Fluid Animated Core
      ctx.globalCompositeOperation = 'source-over';
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        const layerScale = 1 - (j * 0.12);
        const alpha = 0.8 - (j * 0.2);
        
        for (let i = 0; i <= 60; i++) {
          const angle = (Math.PI * 2 * i) / 60;
          const noise = Math.sin(angle * 3 + time + j) * Math.cos(angle * 2 - time * 0.5) * 10 * (intensity + 0.1);
          const dist = (baseRadius * scale * layerScale) + noise;
          const x = cx + Math.cos(angle) * dist;
          const y = cy + Math.sin(angle) * dist;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * scale);
        coreGradient.addColorStop(0, `rgba(${r + 40}, ${g + 40}, ${b + 40}, ${alpha})`);
        coreGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`);
        
        ctx.fillStyle = coreGradient;
        ctx.fill();
        
        if (j === 0) {
            ctx.beginPath();
            ctx.arc(cx - baseRadius*0.2, cy - baseRadius*0.2, baseRadius * 0.1, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fill();
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isActive, mode, analyzerRef]);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ filter: 'blur(0.5px)' }} />;
};

export default Visualizer;
