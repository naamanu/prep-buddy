
import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { MousePointer2, Square, Database, ArrowRight, Type, Pen, Trash2, Eraser } from 'lucide-react';

import type { DiagramElement } from '@/types';
import { logger } from '@/utils/logger';

interface WhiteboardProps {
  initialData?: string;
  onSave: (data: string) => void;
}

type Tool = 'select' | 'rect' | 'database' | 'arrow' | 'text' | 'pencil';

const Whiteboard: React.FC<WhiteboardProps> = ({ initialData, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [elements, setElements] = useState<DiagramElement[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
  const [textInput, setTextInput] = useState<{id: string, x: number, y: number, text: string} | null>(null);
  
  // Refs for tracking state without triggering re-renders in effects
  const dprRef = useRef(1);

  // Load initial data - sync elements state with prop
  useEffect(() => {
    if (initialData) {
      try {
        const parsed = JSON.parse(initialData);
        // Only update if different to avoid loop
        if (JSON.stringify(parsed) !== JSON.stringify(elements)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with prop is valid
            setElements(parsed);
        }
      } catch (e) {
        logger.error("Failed to parse diagram data", e);
      }
    }
  }, [initialData]);

  // Auto-save debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      onSave(JSON.stringify(elements));
    }, 1000);
    return () => clearTimeout(timer);
  }, [elements, onSave]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        dprRef.current = dpr;

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        // Force a re-draw after resize by triggering a state update or calling draw manually
        // Since we need to restore context scale:
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
        
        // Trigger re-render to ensure content is drawn
        setElements(prev => [...prev]);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial size

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    const size = 20;

    ctx.beginPath();
    for (let x = 0; x <= w; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  };

  const drawElement = (ctx: CanvasRenderingContext2D, el: DiagramElement, isSelected: boolean) => {
    ctx.strokeStyle = isSelected ? '#3b82f6' : '#000000';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 2;

    if (isSelected) {
       ctx.setLineDash([5, 5]);
    } else {
       ctx.setLineDash([]);
    }

    ctx.beginPath(); // Start fresh path for each element

    switch (el.type) {
      case 'rect':
        ctx.rect(el.x, el.y, el.width!, el.height!);
        ctx.fill();
        ctx.stroke();
        break;

      case 'database': {
        const w = el.width!;
        const h = el.height!;
        const h4 = h / 6;

        // Sides
        ctx.moveTo(el.x, el.y + h4);
        ctx.lineTo(el.x, el.y + h - h4);
        // Bottom curve
        ctx.bezierCurveTo(el.x, el.y + h, el.x + w, el.y + h, el.x + w, el.y + h - h4);
        ctx.lineTo(el.x + w, el.y + h4);
        ctx.stroke();

        // Top full oval
        ctx.beginPath();
        ctx.ellipse(el.x + w/2, el.y + h4, w/2, h4, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        // Middle line (decoration for cylinder)
        ctx.beginPath();
        ctx.moveTo(el.x, el.y + h4);
        ctx.ellipse(el.x + w/2, el.y + h4, w/2, h4, 0, 0, Math.PI);
        ctx.stroke();
        break;
      }

      case 'arrow': {
        const headlen = 10;
        const angle = Math.atan2(el.height!, el.width!);
        const endX = el.x + el.width!;
        const endY = el.y + el.height!;

        ctx.moveTo(el.x, el.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        break;
      }

      case 'text': {
        ctx.font = 'bold 14px "Fira Code", monospace';
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        ctx.setLineDash([]); // Text doesn't need dash

        // If editing, don't draw the text on canvas (input overlay handles it)
        if (textInput && textInput.id === el.id) return;

        const lines = (el.text || 'Text').split('\n');
        lines.forEach((line, i) => {
            ctx.fillText(line, el.x, el.y + (i * 18));
        });

        if (isSelected) {
           const metrics = ctx.measureText(lines.reduce((a, b) => a.length > b.length ? a : b, ''));
           ctx.strokeRect(el.x - 4, el.y - 4, metrics.width + 8, (lines.length * 18) + 8);
        }
        break;
      }

      case 'pencil':
        if (!el.points || el.points.length < 2) return;
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
        break;
    }
  };

  // Drawing Loop
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use stored DPR for grid calculations, but context is already scaled
    // We just need to clear the logical area
    const width = canvas.width / dprRef.current;
    const height = canvas.height / dprRef.current;

    // Clear canvas (using logical coordinates because of scale)
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height);

    // Draw elements
    elements.forEach(el => {
      drawElement(ctx, el, el.id === selectedId);
    });

  }, [elements, selectedId, textInput]);

  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    setStartPos(pos);
    setIsDrawing(true);

    if (tool === 'select') {
      // Hit detection (reverse to select top-most)
      const hit = [...elements].reverse().find(el => {
         if (el.type === 'rect' || el.type === 'database') {
             return pos.x >= el.x && pos.x <= el.x + (el.width || 0) &&
                    pos.y >= el.y && pos.y <= el.y + (el.height || 0);
         }
         if (el.type === 'text') {
             return pos.x >= el.x && pos.x <= el.x + 100 && pos.y >= el.y && pos.y <= el.y + 20; 
         }
         if (el.type === 'pencil' && el.points) {
             // Simple bounding box for pencil
             const xs = el.points.map(p => p.x);
             const ys = el.points.map(p => p.y);
             const minX = Math.min(...xs) - 5;
             const maxX = Math.max(...xs) + 5;
             const minY = Math.min(...ys) - 5;
             const maxY = Math.max(...ys) + 5;
             return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
         }
         return false;
      });

      setSelectedId(hit ? hit.id : null);
      return;
    }

    // Create new element
    const id = Date.now().toString();
    const newEl: DiagramElement = {
        id,
        type: tool,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        points: tool === 'pencil' ? [pos] : undefined,
        text: tool === 'text' ? 'Double click to edit' : undefined
    };

    if (tool === 'text') {
       setTextInput({ id, x: pos.x, y: pos.y, text: '' });
       setIsDrawing(false); 
       return;
    }

    setElements(prev => [...prev, newEl]);
    setSelectedId(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !startPos) return;
    const pos = getMousePos(e);

    if (tool === 'select' && selectedId) {
       // Move element
       setElements(prev => prev.map(el => {
           if (el.id === selectedId) {
               const dx = pos.x - startPos.x;
               const dy = pos.y - startPos.y;
               if (el.type === 'pencil' && el.points) {
                   return {
                       ...el,
                       points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
                   };
               }
               return { ...el, x: el.x + dx, y: el.y + dy };
           }
           return el;
       }));
       setStartPos(pos); // Reset start pos to prevent compounding delta
       return;
    }

    // Resize/Update current drawing
    setElements(prev => {
        const index = prev.length - 1;
        if (index < 0) return prev;
        
        const last = prev[index];
        
        // Ensure we are updating the correct element (the one we just created)
        if (last.id !== selectedId) return prev;

        if (tool === 'pencil') {
            return prev.map(el => el.id === last.id ? { ...el, points: [...(el.points || []), pos] } : el);
        }
        
        return prev.map(el => el.id === last.id ? {
            ...el,
            width: tool === 'arrow' ? pos.x - startPos.x : Math.abs(pos.x - startPos.x),
            height: tool === 'arrow' ? pos.y - startPos.y : Math.abs(pos.y - startPos.y),
            x: tool === 'arrow' ? el.x : Math.min(pos.x, startPos.x),
            y: tool === 'arrow' ? el.y : Math.min(pos.y, startPos.y),
        } : el);
    });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setStartPos(null);
  };

  const handleDelete = () => {
    if (selectedId) {
        setElements(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
    }
  };

  const handleTextComplete = () => {
    if (textInput && textInput.text.trim()) {
        const newEl: DiagramElement = {
            id: textInput.id,
            type: 'text',
            x: textInput.x,
            y: textInput.y,
            text: textInput.text
        };
        // Add text element if it was new, or update if existing logic required (simplified here to add new)
        setElements(prev => [...prev, newEl]);
    }
    setTextInput(null);
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Toolbar */}
      <div className="h-12 bg-white border-b-2 border-black flex items-center px-4 gap-2 shrink-0 z-10">
         <div className="flex items-center gap-1 border-r-2 border-gray-200 pr-2">
            <ToolButton icon={MousePointer2} active={tool === 'select'} onClick={() => setTool('select')} title="Select" />
            <ToolButton icon={Square} active={tool === 'rect'} onClick={() => setTool('rect')} title="Service (Box)" />
            <ToolButton icon={Database} active={tool === 'database'} onClick={() => setTool('database')} title="Database" />
            <ToolButton icon={ArrowRight} active={tool === 'arrow'} onClick={() => setTool('arrow')} title="Connection" />
            <ToolButton icon={Type} active={tool === 'text'} onClick={() => setTool('text')} title="Label" />
            <ToolButton icon={Pen} active={tool === 'pencil'} onClick={() => setTool('pencil')} title="Freehand" />
         </div>
         
         <div className="flex items-center gap-1">
            <button 
                onClick={handleDelete}
                disabled={!selectedId}
                className="p-2 rounded hover:bg-red-50 text-red-500 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Delete Selected (Del)"
            >
                <Trash2 size={18} />
            </button>
            <button 
                onClick={() => { setElements([]); onSave("[]"); }}
                className="p-2 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                title="Clear Board"
            >
                <Eraser size={18} />
            </button>
         </div>
         
         <div className="ml-auto flex items-center gap-2 text-xs font-mono text-gray-400">
             <span className="hidden md:inline">AUTO-SAVE ENABLED</span>
         </div>
      </div>

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#f8f9fa] cursor-crosshair">
          <canvas 
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="absolute inset-0 block touch-none"
            style={{ width: '100%', height: '100%' }}
          />
          
          {/* Text Input Overlay */}
          {textInput && (
              <textarea
                autoFocus
                value={textInput.text}
                onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
                onBlur={handleTextComplete}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleTextComplete() }}
                className="absolute bg-white border-2 border-blue-500 p-1 font-mono text-sm resize-none shadow-lg z-10 outline-none"
                style={{
                    left: textInput.x,
                    top: textInput.y,
                    minWidth: '150px',
                    minHeight: '40px'
                }}
                placeholder="Type label..."
              />
          )}

          {/* Helper Text */}
          {elements.length === 0 && !isDrawing && !textInput && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="text-center font-mono">
                    <Database size={48} className="mx-auto mb-2" />
                    <p className="text-xl font-bold">SYSTEM ARCHITECTURE CANVAS</p>
                    <p>Select a tool to begin diagramming</p>
                </div>
             </div>
          )}
      </div>
    </div>
  );
};

const ToolButton = ({ icon: Icon, active, onClick, title }: { icon: any, active: boolean, onClick: () => void, title: string }) => (
  <button 
    onClick={onClick}
    title={title}
    className={`p-2 rounded transition-all ${
        active 
        ? 'bg-black text-white shadow-retro-sm' 
        : 'bg-white text-black hover:bg-gray-100'
    }`}
  >
    <Icon size={18} />
  </button>
);

export default Whiteboard;
