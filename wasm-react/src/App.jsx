import { useEffect, useRef, useState } from 'react'
import './App.css'
import { CANVAS_DEFAULTS, APP_CONSTANTS } from './constants'

// MUI
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Slider from '@mui/material/Slider'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import ClearIcon from '@mui/icons-material/Clear'
import UndoIcon from '@mui/icons-material/Undo'
import SaveIcon from '@mui/icons-material/Save'
import LineWeightIcon from '@mui/icons-material/LineWeight'

function App() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const wasmRef = useRef(null)
  const resizeRef = useRef(null)
  const resizePreserveRef = useRef(null)
  const clearRef = useRef(null)
  const getPixelsRef = useRef(null)
  const drawLineRef = useRef(null)
  const imageDataRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [color, setColor] = useState([0, 0, 0])
  const [thickness, setThickness] = useState(4)
  const [eraser, setEraser] = useState(false)
  const [resizeOverlay, setResizeOverlay] = useState({ active: false, x: 0, y: 0, w: 0, h: 0, edge: null, startX: 0, startY: 0, startW: 0, startH: 0 })
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const [hasResized, setHasResized] = useState(false)
  const lastPos = useRef([0, 0])
  const widthRef = useRef(0)
  const heightRef = useRef(0)
  const pixelsPtrRef = useRef(0)
  const undoStackRef = useRef([])
  const maxUndos = APP_CONSTANTS.MAX_UNDOS

  // Set CSS custom properties for canvas dimensions
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--canvas-default-width', `${CANVAS_DEFAULTS.WIDTH}px`)
    root.style.setProperty('--canvas-default-height', `${CANVAS_DEFAULTS.HEIGHT}px`)
    root.style.setProperty('--canvas-min-width', `${CANVAS_DEFAULTS.MIN_WIDTH}px`)
    root.style.setProperty('--canvas-min-height', `${CANVAS_DEFAULTS.MIN_HEIGHT}px`)
  }, [])


  useEffect(() => {
    let animationId;
    let ro;

    const init = async () => {
      // Load WASM module
      const ModuleFactory = (await import('../wasm/render.js')).default
      const Module = await ModuleFactory()
      wasmRef.current = Module

      const container = containerRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      // Wrap C++ functions using cwrap
      resizeRef.current = Module.cwrap('resize', null, ['number','number'])
      resizePreserveRef.current = Module.cwrap('resize_preserve', null, ['number','number','number','number','number','number'])
      clearRef.current = Module.cwrap('clear', null, [])
      getPixelsRef.current = Module.cwrap('get_pixels', 'number', [])
      // draw_line(x0,y0,x1,y1,r,g,b,a,thickness,eraseFlag)
      drawLineRef.current = Module.cwrap('draw_line', null, ['number','number','number','number','number','number','number','number','number','number'])

      // Resize handler (keeps canvas sized to container)
      const resizeHandler = () => {
        let w = Math.max(32, Math.floor(container.clientWidth))
        let h = Math.max(32, Math.floor(container.clientHeight))
        // Use default size if container is not properly sized yet or too small
        if (!w || !h || w < 100 || h < 100) { 
          w = CANVAS_DEFAULTS.WIDTH; 
          h = CANVAS_DEFAULTS.HEIGHT; 
        }
        widthRef.current = canvas.width = w
        heightRef.current = canvas.height = h
        setCanvasSize({ w, h })
        resizeRef.current(w, h)
        clearRef.current()
        pixelsPtrRef.current = getPixelsRef.current()
        imageDataRef.current = ctx.createImageData(w, h)
      }

      // Observe container size changes
      ro = new ResizeObserver(resizeHandler)
      ro.observe(container)
      resizeHandler()

      // Render loop: copy WASM pixels to canvas
      const loop = () => {
        if (!imageDataRef.current) { animationId = requestAnimationFrame(loop); return }
        const heap = Module.HEAPU8
        const pixels = heap.subarray(
          pixelsPtrRef.current,
          pixelsPtrRef.current + widthRef.current * heightRef.current * 4
        )
        imageDataRef.current.data.set(pixels)
        ctx.putImageData(imageDataRef.current, 0, 0)
        animationId = requestAnimationFrame(loop)
      }

      loop()
    }

    init()

    return () => { if (ro) ro.disconnect(); cancelAnimationFrame(animationId) }
  }, [])

  // Undo / snapshot helpers
  const pushSnapshot = () => {
    const Module = wasmRef.current
    if (!Module) return
    const ptr = pixelsPtrRef.current
    const len = widthRef.current * heightRef.current * 4
    const heap = Module.HEAPU8
    // make a copy
    const snap = new Uint8Array(heap.subarray(ptr, ptr + len))
    undoStackRef.current.push({ data: snap, width: widthRef.current, height: heightRef.current })
    if (undoStackRef.current.length > maxUndos) undoStackRef.current.shift()
  }

  const undo = () => {
    const Module = wasmRef.current
    if (!Module) return
    const stack = undoStackRef.current
    if (stack.length === 0) return
    const snap = stack.pop()
    
    // If snapshot has size info, we can handle different canvas sizes
    if (snap.width && snap.height) {
      restoreSnapshot(snap.data, snap.width, snap.height)
    } else {
      // Legacy format - just restore data assuming same size
      const ptr = pixelsPtrRef.current
      Module.HEAPU8.set(snap, ptr)
    }
  }

  const undoWithOffset = (offsetX, offsetY) => {
    const Module = wasmRef.current
    if (!Module) return
    const stack = undoStackRef.current
    if (stack.length === 0) return
    const snap = stack.pop()
    
    // If snapshot has size info, we can handle different canvas sizes with offset
    if (snap.width && snap.height) {
      restoreSnapshot(snap.data, snap.width, snap.height, offsetX, offsetY)
    } else {
      // Legacy format - just restore data assuming same size
      const ptr = pixelsPtrRef.current
      Module.HEAPU8.set(snap, ptr)
    }
  }

  const restoreSnapshot = (snapData, snapWidth, snapHeight, offsetX = 0, offsetY = 0) => {
    const Module = wasmRef.current
    if (!Module) return
    
    const currentW = widthRef.current
    const currentH = heightRef.current
    const ptr = pixelsPtrRef.current
    
    console.log(`Restoring ${snapWidth}x${snapHeight} snapshot to ${currentW}x${currentH} canvas with offset (${offsetX}, ${offsetY})`)
    
    // Clear current canvas to white
    clearRef.current()
    
    // Calculate source and destination regions
    const srcStartX = Math.max(0, offsetX)
    const srcStartY = Math.max(0, offsetY)
    const dstStartX = Math.max(0, -offsetX)
    const dstStartY = Math.max(0, -offsetY)
    
    const copyW = Math.min(snapWidth - srcStartX, currentW - dstStartX)
    const copyH = Math.min(snapHeight - srcStartY, currentH - dstStartY)
    
    console.log(`Copying region: src(${srcStartX},${srcStartY}) -> dst(${dstStartX},${dstStartY}) size ${copyW}x${copyH}`)
    
    // Copy the snapshot data with offset
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        const snapIdx = ((srcStartY + y) * snapWidth + (srcStartX + x)) * 4
        const currentIdx = ((dstStartY + y) * currentW + (dstStartX + x)) * 4
        
        if (snapIdx >= 0 && snapIdx < snapData.length - 3) {
          Module.HEAPU8[ptr + currentIdx] = snapData[snapIdx]
          Module.HEAPU8[ptr + currentIdx + 1] = snapData[snapIdx + 1]
          Module.HEAPU8[ptr + currentIdx + 2] = snapData[snapIdx + 2]
          Module.HEAPU8[ptr + currentIdx + 3] = snapData[snapIdx + 3]
        }
      }
    }
  }

  const savePNG = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'drawing.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    })
  }

  // Draw line by calling WASM draw_line (supports thickness and eraser)
  const drawLine = (x0, y0, x1, y1, [r, g, b]) => {
    if (!drawLineRef.current) return
    const a = 255
    const eraseFlag = eraser ? 1 : 0
    // cwrap'd function signature:
    // draw_line(int x0,int y0,int x1,int y1,int r,int g,int b,int a,int thickness,int eraseFlag)
    drawLineRef.current(Math.floor(x0), Math.floor(y0), Math.floor(x1), Math.floor(y1),
                        r, g, b, a, thickness, eraseFlag)
  }

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    if (e.touches && e.touches.length) {
      const t = e.touches[0]
      return [Math.round(t.clientX - rect.left), Math.round(t.clientY - rect.top)]
    }
    if (e.changedTouches && e.changedTouches.length) {
      const t = e.changedTouches[0]
      return [Math.round(t.clientX - rect.left), Math.round(t.clientY - rect.top)]
    }
    // MouseEvent
    return [e.nativeEvent.offsetX, e.nativeEvent.offsetY]
  }

  const handleMouseDown = (e) => {
    pushSnapshot()
    setDrawing(true)
    lastPos.current = getPos(e)
  }

  const handleMouseMove = (e) => {
    if (!drawing) return
    const [x0, y0] = lastPos.current
    const [x1, y1] = getPos(e)
    drawLine(x0, y0, x1, y1, color)
    lastPos.current = [x1, y1]
  }

  const handleMouseUp = () => setDrawing(false)

  const clearCanvas = () => {
    if (clearRef.current) clearRef.current()
  }



  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const handlePaste = (e) => {
      if (!canvasRef.current || !wasmRef.current) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          const img = new window.Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            handlePasteImage(img, url);
          };
          img.src = url;
          e.preventDefault();
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Handle paste image - always keep canvas size
  const handlePasteImage = (img, url) => {
    if (!img || !canvasRef.current || !wasmRef.current) {
      if (url) URL.revokeObjectURL(url);
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Keep canvas size, draw at 0,0
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    // Copy canvas pixels to WASM buffer
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const Module = wasmRef.current;
    const ptr = pixelsPtrRef.current;
    Module.HEAPU8.set(imageData.data, ptr);
    if (imageDataRef.current) imageDataRef.current.data.set(imageData.data);
    
    if (url) URL.revokeObjectURL(url);
  };

  // --- Custom ResizeOverlay component ---
  function ResizeOverlay({ active, x, y, w, h, edge, onStartResize, onResize, onEndResize, containerRef, canvasSize }) {
    // Only render overlay if active
    if (!active) {
      // Render resize handles
      return (
        <>
          {['nw','n','ne','e','se','s','sw','w'].map(dir => (
            <div
              key={dir}
              className={`resize-handle resize-handle-${dir}`}
              onMouseDown={e => onStartResize(e, dir)}
              style={getHandleStyle(dir, canvasSize)}
            />
          ))}
        </>
      )
    }
    // Render dashed border preview
    return (
      <>
        <div
          className="resize-preview"
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: w,
            height: h,
            border: '1px dashed #2196f3',
            pointerEvents: 'none',
            zIndex: 10,
            background: 'rgba(33,150,243,0.04)'
          }}
        />
      </>
    )
  }
  function getHandleStyle(dir, { w, h }) {
    const size = 10;
    const half = size/2;
    const pos = {
      nw: { left: -half, top: -half },
      n:  { left: w/2-half, top: -half },
      ne: { left: w-half, top: -half },
      e:  { left: w-half, top: h/2-half },
      se: { left: w-half, top: h-half },
      s:  { left: w/2-half, top: h-half },
      sw: { left: -half, top: h-half },
      w:  { left: -half, top: h/2-half }
    }[dir];
    return {
      position: 'absolute',
      width: size,
      height: size,
      background: '#2196f3',
      borderRadius: '50%',
      border: '2px solid #fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      cursor: `${dir}-resize`,
      zIndex: 11,
      ...pos
    }
  }
  // --- End ResizeOverlay ---

  // --- Resize logic ---
  const handleStartResize = (e, edge) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    setResizeOverlay({
      active: true,
      x: 0,
      y: 0,
      w: rect.width,
      h: rect.height,
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height
    });
    window.addEventListener('mousemove', handleResize);
    window.addEventListener('mouseup', handleEndResize);
  };
  const handleResize = (e) => {
    setResizeOverlay(prev => {
      if (!prev.active) return prev;
      let dx = e.clientX - prev.startX;
      let dy = e.clientY - prev.startY;
      let { x, y, w, h } = prev;
      // Adjust based on edge
      switch (prev.edge) {
        case 'n': h = prev.startH - dy; y = dy; break;
        case 's': h = prev.startH + dy; break;
        case 'e': w = prev.startW + dx; break;
        case 'w': w = prev.startW - dx; x = dx; break;
        case 'nw': w = prev.startW - dx; x = dx; h = prev.startH - dy; y = dy; break;
        case 'ne': w = prev.startW + dx; h = prev.startH - dy; y = dy; break;
        case 'se': w = prev.startW + dx; h = prev.startH + dy; break;
        case 'sw': w = prev.startW - dx; x = dx; h = prev.startH + dy; break;
        default: break;
      }
      w = Math.max(32, w); h = Math.max(32, h);
      return { ...prev, x, y, w, h };
    });
  };
  const handleEndResize = () => {
    setHasResized(true)
    setResizeOverlay(prev => {
      if (!prev.active) return prev;
      
      const { w, h, x, y } = prev;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const oldW = canvas.width;
      const oldH = canvas.height;
      const newW = Math.round(w);
      const newH = Math.round(h);
      
      // Skip if no actual size change
      if (oldW === newW && oldH === newH) {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', handleEndResize);
        return { ...prev, active: false };
      }
      
      console.log('Resize from', oldW, 'x', oldH, 'to', newW, 'x', newH);
      
      // Save current state before resize
      pushSnapshot();
      
      // Update container size first
      const container = containerRef.current;
      container.style.width = newW + 'px';
      container.style.height = newH + 'px';
      
      // Update canvas dimensions (this clears the canvas)
      widthRef.current = canvas.width = newW;
      heightRef.current = canvas.height = newH;
      setCanvasSize({ w: newW, h: newH });
      
      // Resize WASM buffer
      resizeRef.current(newW, newH);
      pixelsPtrRef.current = getPixelsRef.current();
      imageDataRef.current = ctx.createImageData(newW, newH);
      
      // Restore the content from the snapshot with offset
      setTimeout(() => {
        undoWithOffset(x, y); // This will restore the saved content accounting for the overlay offset
      }, 0);
      
      console.log('Resize complete - content restored');
      
      // Remove listeners
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', handleEndResize);
      return { ...prev, active: false };
    });
  };
  // --- End Resize logic ---

  return (
    <div className="app-root">
      <AppBar position="static" sx={{ backgroundColor: '#2b2b2b' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>WASM Draw</Typography>
          <Box sx={{ mx: 2, fontSize: 16, color: '#aaa', minWidth: 120, textAlign: 'center' }}>
            {canvasSize.w} × {canvasSize.h} px
          </Box>

          <Tooltip title="Undo">
            <span>
              <IconButton color="inherit" onClick={undo} disabled={undoStackRef.current.length === 0}>
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Save">
            <IconButton color="inherit" onClick={savePNG}>
              <SaveIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Clear">
            <IconButton color="inherit" onClick={() => { pushSnapshot(); clearCanvas() }}>
              <ClearIcon />
            </IconButton>
          </Tooltip>

          <input
            type="color"
            disabled={eraser}
            value={(() => {
              const [r,g,b] = color
              const toHex = (v) => v.toString(16).padStart(2,'0')
              return `#${toHex(r)}${toHex(g)}${toHex(b)}`
            })()}
            onChange={e => {
              const hex = e.target.value
              setColor([
                parseInt(hex.slice(1, 3), 16),
                parseInt(hex.slice(3, 5), 16),
                parseInt(hex.slice(5, 7), 16)
              ])
              setEraser(false)
            }}
            style={{ marginLeft: 12 }}
          />

          <Box sx={{ width: 180, display: 'inline-flex', alignItems: 'center', mx: 2 }}>
            <LineWeightIcon sx={{ mr: 1 }} />
            <Slider value={thickness} min={1} max={50} onChange={(e, val) => setThickness(val)} sx={{ width: 140 }} />
          </Box>

          <Tooltip title="Eraser">
            <Switch checked={eraser} onChange={(e) => setEraser(e.target.checked)} color="default" />
          </Tooltip>
        </Toolbar>
      </AppBar>

      <div className="main-area">
        <div className={`canvas-container${hasResized ? ' resized' : ''}`} ref={containerRef} style={{ position: 'relative', resize: 'none' }}>
          <canvas
            id="cpp-canvas"
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={(e) => { e.preventDefault(); handleMouseMove(e) }}
            onTouchEnd={handleMouseUp}
            style={{ display: 'block', width: '100%', height: '100%' }}
          />
          {/* Custom resize handles and overlay */}
          <ResizeOverlay
            active={resizeOverlay.active}
            x={resizeOverlay.x}
            y={resizeOverlay.y}
            w={resizeOverlay.w}
            h={resizeOverlay.h}
            edge={resizeOverlay.edge}
            onStartResize={handleStartResize}
            onResize={handleResize}
            onEndResize={handleEndResize}
            containerRef={containerRef}
            canvasSize={canvasSize}
          />
        </div>
      </div>
      
    </div>
  )
}

export default App
