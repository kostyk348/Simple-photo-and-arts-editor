
import React, { useState, useCallback, useRef, useEffect, useImperativeHandle } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";
import { FILTERS, Filter, AppliedFilter, FilterParameter, FilterCategory } from './filters';

// --- GLSL Shaders ---
const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`;

// This is now a shader SNIPPET, not a full shader program.
const COPY_SHADER_FRAG = `gl_FragColor = color;`;


// --- WebGL Renderer ---
interface WebGLRendererProps {
  image: HTMLImageElement | null;
  appliedFilters: AppliedFilter[];
  onRender?: () => void;
  mousePos: {x: number, y: number};
}

interface WebGLRendererRef {
  loadImage: (image: HTMLImageElement) => void;
  applyFilters: (filters: AppliedFilter[]) => void;
  getCanvasDataURL: (filters: AppliedFilter[]) => string;
}

const WebGLRenderer = React.forwardRef<WebGLRendererRef, WebGLRendererProps>(({ image, appliedFilters, onRender, mousePos }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programsRef = useRef<{ [key: string]: WebGLProgram }>({});
  const texturesRef = useRef<{ [key: string]: WebGLTexture | null }>({});
  const framebuffersRef = useRef<{ [key: string]: WebGLFramebuffer | null }>({});
  const imageRef = useRef<HTMLImageElement | null>(null);
  const positionBufferRef = useRef<WebGLBuffer | null>(null);
  const texCoordBufferRef = useRef<WebGLBuffer | null>(null);
  const renderRequestIdRef = useRef<number>(0);

  const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) => {
    const program = gl.createProgram();
    if (!program) throw new Error('Could not create program');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  };

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }
    glRef.current = gl;

    positionBufferRef.current = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    texCoordBufferRef.current = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBufferRef.current);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  }, []);

  useEffect(() => {
    setup();
    return () => {
      // Cleanup WebGL resources
      const gl = glRef.current;
      if (gl) {
        Object.values(programsRef.current).forEach(p => gl.deleteProgram(p));
        Object.values(texturesRef.current).forEach(t => gl.deleteTexture(t));
        Object.values(framebuffersRef.current).forEach(f => gl.deleteFramebuffer(f));
        gl.deleteBuffer(positionBufferRef.current);
        gl.deleteBuffer(texCoordBufferRef.current);
      }
    };
  }, [setup]);

  const getProgram = (shader: string, params: FilterParameter[], helpers: string = '', inputs: { [uniformName: string]: string }): WebGLProgram | null => {
      const gl = glRef.current;
      if (!gl) return null;

      const paramKey = params.map(p => p.id).join(',');
      const inputsKey = Object.keys(inputs).sort().join(',');
      const key = shader + helpers + paramKey + inputsKey;
      if (programsRef.current[key]) return programsRef.current[key];

      const samplerDeclarations = Object.keys(inputs)
          .map(uniformName => `uniform sampler2D ${uniformName};`)
          .join('\n');
      
      const hasPrimaryTexture = Object.keys(inputs).includes('u_texture');

      const fragmentShaderSource = `
        precision mediump float;
        varying vec2 v_texCoord;
        
        ${samplerDeclarations}

        uniform vec2 u_resolution;
        uniform float u_time;
        uniform float u_mouseX;
        uniform float u_mouseY;
        
        ${params.map(p => `uniform float u_${p.id};`).join('\n')}
        ${helpers}

        void main() {
          ${hasPrimaryTexture ? 'vec4 color = texture2D(u_texture, v_texCoord);' : ''}
          ${shader}
        }
      `;

      const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      
      if (!vertexShader || !fragmentShader) return null;
      
      const program = createProgram(gl, vertexShader, fragmentShader);
      if (program) programsRef.current[key] = program;
      
      return program;
  };

  const createTextureAndFramebuffer = (gl: WebGLRenderingContext, key: string) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    texturesRef.current[key] = texture;

    const fbo = gl.createFramebuffer();
    framebuffersRef.current[key] = fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  };

  const loadImageTexture = (image: HTMLImageElement) => {
    const gl = glRef.current;
    if (!gl) return;
    imageRef.current = image;
    
    Object.values(texturesRef.current).forEach(t => gl.deleteTexture(t));
    texturesRef.current = {};
    Object.values(framebuffersRef.current).forEach(f => gl.deleteFramebuffer(f));
    framebuffersRef.current = {};

    const sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    texturesRef.current['source'] = sourceTexture;

    canvasRef.current!.width = image.width;
    canvasRef.current!.height = image.height;
    
    // Create ping-pong buffers
    createTextureAndFramebuffer(gl, 'ping');
    createTextureAndFramebuffer(gl, 'pong');
  };
  
  const drawToCanvas = (texture: WebGLTexture) => {
    const gl = glRef.current;
    if(!gl) return;
    const program = getProgram(COPY_SHADER_FRAG, [], '', { 'u_texture': 'source' });
    if (!program) return;
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBufferRef.current);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Synchronous draw function
  const drawFrame = (filtersToApply: AppliedFilter[], timeInSeconds: number) => {
    const gl = glRef.current;
    const image = imageRef.current;
    if (!gl || !image) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    if (filtersToApply.length === 0) {
        drawToCanvas(texturesRef.current['source']!);
        return;
    }

    let sourceKey = 'source';
    const pingKey = 'ping';
    const pongKey = 'pong';
    let destKey = pingKey;

    filtersToApply.forEach((appliedFilter) => {
        const filterDef = FILTERS.find(f => f.id === appliedFilter.id);
        if (!filterDef) return;

        filterDef.passes.forEach(pass => {
            const isFinalPassOfFilter = pass.output === 'final';
            const outputKey = isFinalPassOfFilter ? destKey : pass.output;
            
            if (!isFinalPassOfFilter && !texturesRef.current[outputKey]) {
                createTextureAndFramebuffer(gl, outputKey);
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, isFinalPassOfFilter ? framebuffersRef.current[destKey] : framebuffersRef.current[outputKey]);
            
            const program = getProgram(pass.shader, filterDef.params, pass.helpers, pass.inputs);
            if (!program) return;
            gl.useProgram(program);

            // Setup attributes
            const positionLocation = gl.getAttribLocation(program, "a_position");
            const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBufferRef.current);
            gl.enableVertexAttribArray(texCoordLocation);
            gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
            
            // Setup uniforms
            gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), gl.canvas.width, gl.canvas.height);
            gl.uniform1f(gl.getUniformLocation(program, "u_time"), timeInSeconds);
            gl.uniform1f(gl.getUniformLocation(program, "u_mouseX"), mousePos.x);
            gl.uniform1f(gl.getUniformLocation(program, "u_mouseY"), mousePos.y);

            
            filterDef.params.forEach(p => {
                const value = appliedFilter.params[p.id] ?? p.initialValue;
                gl.uniform1f(gl.getUniformLocation(program, `u_${p.id}`), value);
            });

            // Bind input textures
            let textureUnit = 0;
            for (const uniformName in pass.inputs) {
                const textureKey = pass.inputs[uniformName];
                const inputTextureKey = textureKey === 'source' ? sourceKey : textureKey;
                const inputTexture = texturesRef.current[inputTextureKey];

                gl.activeTexture(gl.TEXTURE0 + textureUnit);
                gl.bindTexture(gl.TEXTURE_2D, inputTexture!);
                gl.uniform1i(gl.getUniformLocation(program, uniformName), textureUnit);
                textureUnit++;
            }
            
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });
        // Swap for next filter
        if (filterDef.passes.some(p => p.output === 'final')) {
            sourceKey = destKey;
            destKey = (sourceKey === pingKey) ? pongKey : pingKey;
        }
    });

    // Final draw to screen
    drawToCanvas(texturesRef.current[sourceKey]!);
  };
  
  // Asynchronous render for UI updates
  const render = (filters: AppliedFilter[]) => {
      if (renderRequestIdRef.current) {
        cancelAnimationFrame(renderRequestIdRef.current);
      }

      renderRequestIdRef.current = requestAnimationFrame((time) => {
        drawFrame(filters, time / 1000.0);
        if(onRender) onRender();
      });
  };

  useImperativeHandle(ref, () => ({
    loadImage: (image: HTMLImageElement) => {
      loadImageTexture(image);
      render([]);
    },
    applyFilters: (filters: AppliedFilter[]) => {
      render(filters);
    },
    getCanvasDataURL: (filtersToApply: AppliedFilter[]) => {
      // Re-render synchronously with the provided filters to ensure the canvas buffer is up-to-date
      drawFrame(filtersToApply, performance.now() / 1000.0);
      return canvasRef.current?.toDataURL('image/png') || '';
    },
  }));

  return <canvas ref={canvasRef} className="main-canvas" />;
});


// --- React Components ---

const FilterControl = ({ filterId, param, value, onChange }) => {
  return (
    <div className="filter-control">
      <div className="filter-control-header">
        <label htmlFor={`${filterId}-${param.id}`}>{param.name}</label>
        <span className="filter-value">{Number(value).toFixed(param.step < 0.1 ? 4 : 2)}{param.unit}</span>
      </div>
      <input
        type="range"
        id={`${filterId}-${param.id}`}
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        onChange={(e) => onChange(param.id, parseFloat(e.target.value))}
      />
    </div>
  );
};

const AppliedFilterItem = ({ appliedFilter, onRemove, onParamChange }) => {
  const filterDef = FILTERS.find(f => f.id === appliedFilter.id);
  if (!filterDef) return null;

  return (
    <div className="applied-filter-item">
      <div className="applied-filter-header">
        <h3>{filterDef.name}</h3>
        <button className="remove-filter-btn" onClick={onRemove} aria-label={`Remove ${filterDef.name} filter`}>&times;</button>
      </div>
      {filterDef.params.map(param => (
        <FilterControl
          key={param.id}
          filterId={filterDef.id}
          param={param}
          value={appliedFilter.params[param.id]}
          onChange={(paramId, newValue) => onParamChange(paramId, newValue)}
        />
      ))}
    </div>
  );
};

const FilterPreview = ({ filter, onClick, isApplied }) => {
  return (
    <div className={`filter-preview ${isApplied ? 'applied' : ''}`} onClick={onClick} role="button" tabIndex={0}>
        <div className='image-wrapper-preview'>
        </div>
      <p>{filter.name}</p>
    </div>
  );
};

const CollapsibleSection = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className='collapsible-section'>
            <h2 className='collapsible-header' onClick={() => setIsOpen(!isOpen)}>
                {title}
                <span className={`chevron ${isOpen ? 'open': ''}`}>▼</span>
            </h2>
            {isOpen && <>{children}</>}
            <div className='category-separator'></div>
        </div>
    )
}

const App = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [originalImageBeforeAi, setOriginalImageBeforeAi] = useState<HTMLImageElement | null>(null);
  const webglCanvasRef = useRef<WebGLRendererRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

  useEffect(() => {
    if (image && webglCanvasRef.current) {
      webglCanvasRef.current.loadImage(image);
    }
  }, [image]);

  useEffect(() => {
    if (image && webglCanvasRef.current) {
      webglCanvasRef.current.applyFilters(appliedFilters);
    }
  }, [appliedFilters, image, mousePos]);

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setAppliedFilters([]); // Reset filters on new image
        setOriginalImageBeforeAi(null); // Clear AI revert state
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageUpload(e.target.files[0]);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = 1.0 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)); // Invert Y and clamp
    setMousePos({ x, y });
  };

  const addFilter = (filterId: string) => {
    if (appliedFilters.some(f => f.id === filterId)) return;
    const filterDef = FILTERS.find(f => f.id === filterId);
    if (!filterDef) return;
    const newFilter: AppliedFilter = {
      id: filterId,
      params: filterDef.params.reduce((acc, p) => ({ ...acc, [p.id]: p.initialValue }), {}),
    };
    setAppliedFilters(prev => [...prev, newFilter]);
  };

  const removeFilter = (filterId: string) => {
    setAppliedFilters(prev => prev.filter(f => f.id !== filterId));
  };

  const updateFilterParam = (filterId: string, paramId: string, value: number) => {
    setAppliedFilters(prev =>
      prev.map(f =>
        f.id === filterId ? { ...f, params: { ...f.params, [paramId]: value } } : f
      )
    );
  };

  const handleSaveImage = () => {
    if (!webglCanvasRef.current || !image) return;
    const dataUrl = webglCanvasRef.current.getCanvasDataURL(appliedFilters);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'edited-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAiGenerate = async () => {
    if (!image || !webglCanvasRef.current || !aiPrompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    if (!originalImageBeforeAi) { // Save the very first version before any AI edits
        setOriginalImageBeforeAi(image);
    }
    
    try {
        const dataUrl = webglCanvasRef.current.getCanvasDataURL(appliedFilters);
        const base64Data = dataUrl.split(',')[1];
        
        const imagePart = {
            inlineData: {
                mimeType: 'image/png',
                data: base64Data,
            },
        };
        const textPart = { text: aiPrompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        let foundImage = false;
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const newBase64 = part.inlineData.data;
                const newImg = new Image();
                newImg.onload = () => {
                    setImage(newImg);
                    setAppliedFilters([]);
                    setAiPrompt('');
                };
                newImg.src = `data:${part.inlineData.mimeType};base64,${newBase64}`;
                foundImage = true;
                break;
            }
        }

        if (!foundImage) {
            throw new Error("AI did not return an image. It might have refused the request.");
        }

    } catch (err) {
        console.error("AI Generation Error:", err);
        setError("Sorry, there was an error with the AI request.");
        setTimeout(() => setError(null), 5000);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleRevertAi = () => {
      if (originalImageBeforeAi) {
          setImage(originalImageBeforeAi);
          setOriginalImageBeforeAi(null);
          setAppliedFilters([]);
      }
  };

  const filterCategories = FILTERS.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {} as Record<FilterCategory, Filter[]>);
  
  const orderedCategories: FilterCategory[] = ['Adrenaline Rush', 'Benchmark', 'Ultimate Engines', 'Aesthetic Core Engine', 'Advanced Engine', 'Color & Tone', 'Effects & Texture', 'Distortion'];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
            <div className='sidebar-title-bar'>
                <h1>AI Post-Pro</h1>
                <button className='save-btn' onClick={handleSaveImage} disabled={!image}>Save</button>
            </div>
            <p>Advanced real-time image filter editor.</p>
        </div>
        
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
        <div className="upload-section" onClick={() => fileInputRef.current?.click()} onDrop={handleDrop} onDragOver={handleDragOver}>
            <p>Drag & drop an image here, or click to select</p>
        </div>
        
        <div className="applied-filters-list">
            {appliedFilters.map(af => (
                <AppliedFilterItem
                key={af.id}
                appliedFilter={af}
                onRemove={() => removeFilter(af.id)}
                onParamChange={(paramId, value) => updateFilterParam(af.id, paramId, value)}
                />
            ))}
        </div>

        <CollapsibleSection title="AI Generative Edit">
            <div className="ai-edit-section">
                <p className="ai-edit-description">Describe a change you want to make to the image. Be descriptive!</p>
                <textarea 
                    className="ai-prompt-input"
                    placeholder="e.g., make the sky look like a van gogh painting"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    disabled={isGenerating || !image}
                    aria-label="AI editing prompt"
                />
                <div className="ai-buttons">
                    <button 
                        className="ai-generate-btn" 
                        onClick={handleAiGenerate} 
                        disabled={isGenerating || !image || !aiPrompt.trim()}
                        aria-live="polite"
                    >
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                    {originalImageBeforeAi && (
                        <button 
                            className="ai-revert-btn" 
                            onClick={handleRevertAi}
                            disabled={isGenerating}
                        >
                            Revert AI Edit
                        </button>
                    )}
                </div>
                {isGenerating && <p className="loading-message">AI is thinking... this can take a moment.</p>}
            </div>
        </CollapsibleSection>

        <div className="filters-gallery-container">
            {orderedCategories.map(category => filterCategories[category] && (
                <CollapsibleSection key={category} title={category}>
                    <div className="filter-gallery">
                        {filterCategories[category].map(filter => (
                        <FilterPreview
                            key={filter.id}
                            filter={filter}
                            isApplied={appliedFilters.some(af => af.id === filter.id)}
                            onClick={() => {
                                if(appliedFilters.some(af => af.id === filter.id)) {
                                    removeFilter(filter.id)
                                } else {
                                    addFilter(filter.id)
                                }
                            }}
                        />
                        ))}
                    </div>
                </CollapsibleSection>
            ))}
        </div>
      </aside>
      <main className="main-content" onMouseMove={handleMouseMove}>
        <div className={`image-wrapper-outer ${isGenerating ? 'loading' : ''}`}>
            {!image && <p className="image-placeholder">Your image will appear here</p>}
            <WebGLRenderer ref={webglCanvasRef} image={image} appliedFilters={appliedFilters} mousePos={mousePos} />
        </div>
      </main>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);