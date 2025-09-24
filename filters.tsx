// --- Type definitions ---
export interface FilterParameter {
  id: string;
  name: string;
  min: number;
  max: number;
  step: number;
  initialValue: number;
  unit: string;
}

export interface FilterPass {
    shader: string; 
    inputs: { [uniformName: string]: string }; 
    output: string;
    helpers?: string; // For GLSL helper functions
}

export type FilterCategory = 'Adrenaline Rush' | 'Benchmark' | 'Color & Tone' | 'Effects & Texture' | 'Distortion' | 'Aesthetic Core Engine' | 'Advanced Engine' | 'Ultimate Engines';

export interface Filter {
  id: string;
  name: string;
  category: FilterCategory;
  params: FilterParameter[];
  passes: FilterPass[];
}

export interface AppliedFilter {
  id: string;
  params: { [key: string]: number };
}

// --- Filter Definitions with Shaders ---
export const FILTERS: Filter[] = [
  // --- Adrenaline Rush ---
  {
    id: 'hyperion-light-engine',
    name: 'Hyperion Light Engine',
    category: 'Adrenaline Rush',
    params: [
      { id: 'intensity', name: 'Intensity', min: 0, max: 2, step: 0.01, initialValue: 0.5, unit: '' },
      { id: 'threshold', name: 'Threshold', min: 0.8, max: 1, step: 0.001, initialValue: 0.95, unit: '' },
      { id: 'rayLength', name: 'Ray Length', min: 0.8, max: 0.99, step: 0.001, initialValue: 0.95, unit: '' },
      { id: 'flareSpread', name: 'Flare Spread', min: 1, max: 5, step: 0.1, initialValue: 2.0, unit: 'x' }
    ],
    passes: [
      { // 0: Isolate bright areas
        shader: `float lum=dot(color.rgb,vec3(0.2126,0.7152,0.0722)); gl_FragColor=vec4(color.rgb*smoothstep(u_threshold,u_threshold+0.05,lum),color.a);`,
        inputs: {'u_texture': 'source'}, output: 'hyperion_bright'
      },
      { // 1: Anamorphic Flares (horizontal blur)
        shader: `
          vec4 sum = vec4(0.0);
          vec2 p = vec2(u_flareSpread / u_resolution.x, 0.0);
          float weights[5] = float[](0.22, 0.2, 0.15, 0.1, 0.05);
          for(int i = 0; i < 5; i++) {
            float fi = float(i);
            sum.r += texture2D(u_texture, v_texCoord + p * fi).r * weights[i];
            sum.r += texture2D(u_texture, v_texCoord - p * fi).r * weights[i];
            sum.g += texture2D(u_texture, v_texCoord + p * fi * 0.9).g * weights[i];
            sum.g += texture2D(u_texture, v_texCoord - p * fi * 0.9).g * weights[i];
            sum.b += texture2D(u_texture, v_texCoord + p * fi * 0.8).b * weights[i];
            sum.b += texture2D(u_texture, v_texCoord - p * fi * 0.8).b * weights[i];
          }
          gl_FragColor = sum / 2.0;
        `,
        inputs: {'u_texture': 'hyperion_bright'}, output: 'hyperion_flare'
      },
      { // 2: God Rays (radial blur)
        shader: `
          vec2 dir = v_texCoord - vec2(0.5);
          vec4 sum = vec4(0.0);
          float decay = 1.0;
          for (int i = 0; i < 30; i++) {
            sum += texture2D(u_texture, v_texCoord) * decay;
            v_texCoord -= dir * (1.0 / 30.0) * 0.1;
            decay *= u_rayLength;
          }
          gl_FragColor = sum / 30.0;
        `,
        inputs: {'u_texture': 'hyperion_bright'}, output: 'hyperion_rays'
      },
      { // 3: Composite
        shader: `
          vec3 flare = texture2D(u_flare_tex, v_texCoord).rgb;
          vec3 rays = texture2D(u_rays_tex, v_texCoord).rgb;
          gl_FragColor = vec4(color.rgb + (flare + rays) * u_intensity, color.a);
        `,
        inputs: {'u_texture': 'source', 'u_flare_tex': 'hyperion_flare', 'u_rays_tex': 'hyperion_rays'}, output: 'final'
      }
    ]
  },
  {
    id: 'crystalline-amplifier',
    name: 'Crystalline Amplifier',
    category: 'Adrenaline Rush',
    params: [
      { id: 'purity', name: 'Color Purity', min: 1, max: 2, step: 0.01, initialValue: 1.2, unit: 'x' },
      { id: 'sharpness', name: 'Detail Sharpness', min: 0, max: 3, step: 0.01, initialValue: 1.5, unit: '' },
      { id: 'gloss', name: 'Glossiness', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' }
    ],
    passes: [
      { // 0: Low frequency pass (color/volume layer)
        shader: `vec2 p=4.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'crys_low'
      },
      { // 1: Composite
        shader: `
          vec3 low_freq = texture2D(u_crys_low_tex, v_texCoord).rgb;
          vec3 high_freq = color.rgb - low_freq;
          
          // Crystallize colors
          vec3 luma_vec = vec3(0.2126, 0.7152, 0.0722);
          float luma = dot(low_freq, luma_vec);
          vec3 color_crys = mix(vec3(luma), low_freq, u_purity);
          color_crys = ((color_crys - 0.5) * u_purity) + 0.5;

          // Sharpen details
          vec3 details_sharp = high_freq * u_sharpness;
          
          vec3 combined = color_crys + details_sharp;
          
          // Add gloss
          float gloss_luma = dot(combined, luma_vec);
          float gloss_effect = smoothstep(0.8, 1.0, gloss_luma) * u_gloss;
          vec3 final_color = combined + gloss_effect;

          gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_crys_low_tex': 'crys_low'}, output: 'final'
      }
    ]
  },
  // --- Benchmark ---
  {
    id: 'tactile-realism',
    name: 'Tactile Realism',
    category: 'Benchmark',
    params: [
      { id: 'intensity', name: 'Parallax', min: 0, max: 0.01, step: 0.0001, initialValue: 0.002, unit: '' },
      { id: 'specular', name: 'Specular', min: 0, max: 2.0, step: 0.01, initialValue: 0.5, unit: '' },
    ],
    passes: [
      { // 0: Blur source for high-pass
        shader: `vec2 p=2.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'tr_blur'
      },
      { // 1: Height map (high-pass filter)
        shader: `vec3 blur = texture2D(u_tr_blur_tex, v_texCoord).rgb; gl_FragColor = vec4(color.rgb - blur + 0.5, 1.0);`,
        inputs: {'u_texture': 'source', 'u_tr_blur_tex': 'tr_blur'}, output: 'tr_height'
      },
      { // 2: Composite
        shader: `
          float height = (texture2D(u_tr_height_tex, v_texCoord).r - 0.5) * u_intensity;
          
          // Micro-parallax
          float r = texture2D(u_texture, v_texCoord - vec2(height, 0.0)).r;
          vec2 gb = texture2D(u_texture, v_texCoord + vec2(height, 0.0)).gb;
          vec3 parallax_color = vec3(r, gb);

          // Specularity from height map gradients
          vec2 p = 1.0 / u_resolution;
          float h_l = texture2D(u_tr_height_tex, v_texCoord - vec2(p.x, 0.0)).r;
          float h_r = texture2D(u_tr_height_tex, v_texCoord + vec2(p.x, 0.0)).r;
          float h_u = texture2D(u_tr_height_tex, v_texCoord + vec2(0.0, p.y)).r;
          float h_d = texture2D(u_tr_height_tex, v_texCoord - vec2(0.0, p.y)).r;
          
          vec3 normal = normalize(vec3(h_l - h_r, h_d - h_u, 0.1));
          vec3 light_dir = normalize(vec3(0.5, 0.5, 1.0));
          float spec = pow(max(dot(normal, light_dir), 0.0), 16.0) * u_specular;
          
          gl_FragColor = vec4(clamp(parallax_color + spec, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_tr_height_tex': 'tr_height'}, output: 'final'
      }
    ]
  },
  {
    id: 'contrast-harmonizer',
    name: 'Contrast Harmonizer',
    category: 'Benchmark',
    params: [
      { id: 'harmony', name: 'Harmony', min: 0, max: 2, step: 0.01, initialValue: 1.0, unit: 'x' }
    ],
    passes: [
      { // 0: Luma Contrast Map (Sobel)
        shader: `
            vec2 p = 1.0 / u_resolution;
            float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float Gx = lumE - lumW; float Gy = lumS - lumN;
            gl_FragColor = vec4(vec3(sqrt(Gx*Gx + Gy*Gy)), 1.0);`,
        inputs: {'u_texture': 'source'}, output: 'ch_luma_c'
      },
      { // 1: Chroma Contrast Map
        helpers: `vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x); }`,
        shader: `
            vec2 p = 1.0/u_resolution;
            vec3 center_hsv = rgb2hsv(texture2D(u_texture, v_texCoord).rgb);
            vec3 right_hsv = rgb2hsv(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb);
            vec3 down_hsv = rgb2hsv(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb);
            float chroma_diff = abs(center_hsv.y - right_hsv.y) + abs(center_hsv.y - down_hsv.y);
            gl_FragColor = vec4(vec3(chroma_diff), 1.0);`,
        inputs: {'u_texture': 'source'}, output: 'ch_chroma_c'
      },
      { // 2: Blur for unsharp masking
        shader: `vec2 p=2.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'ch_blur'
      },
      { // 3: Composite
        helpers: `
            vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x); }
            vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }`,
        shader: `
            float luma_c = texture2D(u_ch_luma_c_tex, v_texCoord).r;
            float chroma_c = texture2D(u_ch_chroma_c_tex, v_texCoord).r * 5.0;
            vec3 blur = texture2D(u_ch_blur_tex, v_texCoord).rgb;

            // Boost details where chroma contrast is low
            float detail_boost = (1.0 - smoothstep(0.0, 0.4, chroma_c)) * u_harmony;
            vec3 details = color.rgb - blur;
            vec3 final_color = color.rgb + details * detail_boost;

            // Boost saturation where luma contrast is low
            float sat_boost = (1.0 - smoothstep(0.0, 0.4, luma_c)) * u_harmony;
            vec3 hsv = rgb2hsv(final_color);
            hsv.y *= (1.0 + sat_boost);

            gl_FragColor = vec4(clamp(hsv2rgb(hsv), 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_ch_luma_c_tex': 'ch_luma_c', 'u_ch_chroma_c_tex': 'ch_chroma_c', 'u_ch_blur_tex': 'ch_blur'}, output: 'final'
      }
    ]
  },
  {
    id: 'spectral-normalizer',
    name: 'Spectral Normalizer',
    category: 'Benchmark',
    params: [
      { id: 'purity', name: 'Purity', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' },
      { id: 'richness', name: 'Richness', min: 0, max: 2, step: 0.01, initialValue: 0.3, unit: '' }
    ],
    passes: [
      { // 0: Create a very blurred color field
        shader: `vec2 p = 20.0 / u_resolution; vec4 sum=vec4(0.0); for(float x=-2.;x<=2.;x++){for(float y=-2.;y<=2.;y++){sum+=texture2D(u_texture,v_texCoord+p*vec2(x,y));}} gl_FragColor=sum/25.;`,
        inputs: {'u_texture': 'source'}, output: 'sn_color_field'
      },
      { // 1: Composite in OkLab space
        helpers: `
          const mat3 RGB_TO_LMS = mat3(0.4121656, 0.5362752, 0.0514575, 0.2118591, 0.6807189, 0.1074069, 0.0883097, 0.2818471, 0.6302613);
          const mat3 LMS_TO_OKLAB = mat3(0.2104542, 0.7936178, -0.0040720, 1.9779985, -2.4285922, 0.4505937, 0.0259040, 0.7827718, -0.8086758);
          vec3 rgb2oklab(vec3 c) { c = pow(c, vec3(2.2)); vec3 lms = c * RGB_TO_LMS; lms = pow(lms, vec3(1.0/3.0)); return lms * LMS_TO_OKLAB; }
          const mat3 OKLAB_TO_LMS = mat3(1.0, 0.3963378, 0.2158037, 1.0, -0.1055613, -0.0638542, 1.0, -0.0894842, -1.2914855);
          const mat3 LMS_TO_RGB = mat3(4.0767245, -3.3072169, 0.2307590, -1.2681438, 2.6093323, -0.3411344, -0.0041945, -0.7034763, 1.7068626);
          vec3 oklab2rgb(vec3 c) { vec3 lms = c * OKLAB_TO_LMS; lms = pow(lms, vec3(3.0)); vec3 rgb = lms * LMS_TO_RGB; return pow(rgb, vec3(1.0/2.2)); }
        `,
        shader: `
          vec3 original_oklab = rgb2oklab(color.rgb);
          vec3 field_oklab = rgb2oklab(texture2D(u_sn_color_field_tex, v_texCoord).rgb);
          
          // Purity: pull color towards the harmonized field color
          vec2 new_chroma = mix(original_oklab.yz, field_oklab.yz, u_purity);
          
          // Richness: add back some of the original color variance
          float chroma_dist = distance(original_oklab.yz, field_oklab.yz);
          new_chroma += normalize(original_oklab.yz - field_oklab.yz) * chroma_dist * u_richness;
          
          vec3 final_oklab = vec3(original_oklab.x, new_chroma);
          gl_FragColor = vec4(clamp(oklab2rgb(final_oklab), 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_sn_color_field_tex': 'sn_color_field'}, output: 'final'
      }
    ]
  },
  {
    id: 'apochromatic-lens',
    name: 'Apochromatic Lens',
    category: 'Benchmark',
    params: [
      { id: 'correction', name: 'Correction', min: 0, max: 0.005, step: 0.0001, initialValue: 0.001, unit: '' }
    ],
    passes: [{
      shader: `
          vec2 p = 1.0 / u_resolution;
          float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
          float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
          float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
          float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          
          vec2 grad = vec2(lumE - lumW, lumS - lumN);
          vec2 grad_perp = normalize(vec2(grad.y, -grad.x) + 1e-5);
          
          float r = texture2D(u_texture, v_texCoord - grad_perp * u_correction).r;
          float g = texture2D(u_texture, v_texCoord).g;
          float b = texture2D(u_texture, v_texCoord + grad_perp * u_correction).b;
          
          gl_FragColor = vec4(r, g, b, color.a);
      `,
      inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },
  {
    id: 'global-illumination',
    name: 'Global Illumination',
    category: 'Benchmark',
    params: [
      { id: 'intensity', name: 'Intensity', min: 0, max: 2, step: 0.01, initialValue: 0.8, unit: '' },
      { id: 'spread', name: 'Spread', min: 20, max: 200, step: 1, initialValue: 100, unit: 'px' }
    ],
    passes: [
      { // 0: Radiance Map (bright areas)
        shader: `
          float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          float mask = smoothstep(0.6, 0.9, lum);
          gl_FragColor = vec4(color.rgb * mask, 1.0);`,
        inputs: {'u_texture': 'source'}, output: 'gi_radiance'
      },
      { // 1: First light bounce (wide blur)
        shader: `
          vec2 p = u_spread / u_resolution; vec4 sum=vec4(0.0);
          for(float x=-4.;x<=4.;x+=2.){ for(float y=-4.;y<=4.;y+=2.){ sum+=texture2D(u_texture,v_texCoord+p*vec2(x,y)); } }
          gl_FragColor=sum/25.;`,
        inputs: {'u_texture': 'gi_radiance'}, output: 'gi_bounce1'
      },
      { // 2: Composite
        shader: `
          vec3 bounced_light = texture2D(u_gi_bounce1_tex, v_texCoord).rgb;
          float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          float shadow_mask = 1.0 - smoothstep(0.0, 0.5, lum);
          
          vec3 final_color = color.rgb + bounced_light * shadow_mask * u_intensity;
          gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_gi_bounce1_tex': 'gi_bounce1'}, output: 'final'
      }
    ]
  },
  {
    id: 'color-contrast-separator',
    name: 'Color Contrast Separator',
    category: 'Benchmark',
    params: [
      { id: 'lumaContrast', name: 'Luma Contrast', min: 0, max: 2, step: 0.01, initialValue: 1, unit: 'x' },
      { id: 'chromaContrast', name: 'Chroma Contrast', min: 0, max: 2, step: 0.01, initialValue: 1, unit: 'x' },
    ],
    passes: [
      { // 0: Convert to OkLab
        helpers: `
          const mat3 RGB_TO_LMS = mat3(0.4121656, 0.5362752, 0.0514575, 0.2118591, 0.6807189, 0.1074069, 0.0883097, 0.2818471, 0.6302613);
          const mat3 LMS_TO_OKLAB = mat3(0.2104542, 0.7936178, -0.0040720, 1.9779985, -2.4285922, 0.4505937, 0.0259040, 0.7827718, -0.8086758);
          vec3 rgb2oklab(vec3 c) { c = pow(c, vec3(2.2)); vec3 lms = c * RGB_TO_LMS; lms = pow(lms, vec3(1.0/3.0)); return lms * LMS_TO_OKLAB; }
        `,
        shader: `gl_FragColor = vec4(rgb2oklab(color.rgb), color.a);`,
        inputs: {'u_texture': 'source'}, output: 'ccs_oklab'
      },
      { // 1: Composite
        helpers: `
          const mat3 OKLAB_TO_LMS = mat3(1.0, 0.3963378, 0.2158037, 1.0, -0.1055613, -0.0638542, 1.0, -0.0894842, -1.2914855);
          const mat3 LMS_TO_RGB = mat3(4.0767245, -3.3072169, 0.2307590, -1.2681438, 2.6093323, -0.3411344, -0.0041945, -0.7034763, 1.7068626);
          vec3 oklab2rgb(vec3 c) { vec3 lms = c * OKLAB_TO_LMS; lms = pow(lms, vec3(3.0)); vec3 rgb = lms * LMS_TO_RGB; return pow(rgb, vec3(1.0/2.2)); }
        `,
        shader: `
          vec3 oklab = texture2D(u_ccs_oklab_tex, v_texCoord).rgb;
          // Apply Luma contrast
          oklab.x = (oklab.x - 0.5) * u_lumaContrast + 0.5;
          // Apply Chroma contrast
          oklab.yz *= u_chromaContrast;
          
          gl_FragColor = vec4(clamp(oklab2rgb(oklab), 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_ccs_oklab_tex': 'ccs_oklab'}, output: 'final'
      }
    ]
  },
  {
    id: 'structural-sharpener',
    name: 'Structural Sharpener',
    category: 'Benchmark',
    params: [
      { id: 'amount', name: 'Amount', min: 0, max: 5, step: 0.1, initialValue: 1.5, unit: 'x' },
      { id: 'threshold', name: 'Edge Threshold', min: 0, max: 0.5, step: 0.01, initialValue: 0.1, unit: '' }
    ],
    passes: [
      { // 0: Edge detection
        shader: `
            vec2 p = 1.0 / u_resolution;
            float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float Gx = lumE - lumW; float Gy = lumS - lumN;
            float edge = sqrt(Gx*Gx + Gy*Gy);
            gl_FragColor = vec4(vec3(smoothstep(u_threshold, u_threshold + 0.2, edge)), 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'ss_edge'
      },
      { // 1: Blur for unsharp mask
        shader: `vec2 p=1.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'ss_blur'
      },
      { // 2: Composite
        shader: `
            float edge_mask = texture2D(u_ss_edge_tex, v_texCoord).r;
            vec3 blur = texture2D(u_ss_blur_tex, v_texCoord).rgb;
            vec3 details = color.rgb - blur;
            vec3 final_color = color.rgb + details * u_amount * edge_mask;
            gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_ss_edge_tex': 'ss_edge', 'u_ss_blur_tex': 'ss_blur'}, output: 'final'
      }
    ]
  },
  // --- Ultimate Engines ---
   {
    id: 'parallax-simulator',
    name: 'Binocular Parallax Simulator',
    category: 'Ultimate Engines',
    params: [
      { id: 'intensity', name: 'Intensity', min: 0, max: 0.1, step: 0.001, initialValue: 0.02, unit: '' },
      { id: 'focus', name: 'Focus Plane', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' }
    ],
    passes: [
      { // 0: Pseudo Depth Map
        shader: `
          float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          float depth = smoothstep(1.0, 0.0, v_texCoord.y) * 0.7 + luma * 0.3;
          gl_FragColor = vec4(vec3(depth), 1.0);`,
        inputs: {'u_texture': 'source'}, output: 'parallax_depth'
      },
      { // 1: Composite with parallax shift
        shader: `
          float depth = texture2D(u_parallax_depth_tex, v_texCoord).r;
          vec2 shift_direction = (vec2(u_mouseX, u_mouseY) - 0.5) * 2.0;
          float shift_amount = (depth - u_focus) * u_intensity;
          vec2 offset = shift_direction * shift_amount;
          gl_FragColor = texture2D(u_texture, v_texCoord - offset);
        `,
        inputs: {'u_texture': 'source', 'u_parallax_depth_tex': 'parallax_depth'}, output: 'final'
      }
    ]
  },
  {
    id: 'reflex-analysis',
    name: 'Reflex Analysis',
    category: 'Ultimate Engines',
    params: [
      { id: 'enhance', name: 'Enhance Harmony', min: 0, max: 2, step: 0.01, initialValue: 0.5, unit: '' },
      { id: 'suppress', name: 'Suppress Dirt', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' }
    ],
    passes: [
      { // 0: Radiance Map (bright, saturated areas)
        helpers: `vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x); }`,
        shader: `
            vec3 hsv = rgb2hsv(color.rgb);
            float mask = smoothstep(0.4, 0.6, hsv.y) * smoothstep(0.6, 0.8, hsv.z);
            gl_FragColor = vec4(color.rgb * mask, 1.0);`,
        inputs: {'u_texture': 'source'}, output: 'reflex_radiance'
      },
      { // 1: Blurred radiance map (color bleed)
        shader: `
            vec2 p = 30.0 / u_resolution; vec4 sum=vec4(0.0);
            for(float x=-2.;x<=2.;x++){ for(float y=-2.;y<=2.;y++){ sum+=texture2D(u_texture,v_texCoord+p*vec2(x,y)); } }
            gl_FragColor=sum/25.;`,
        inputs: {'u_texture': 'reflex_radiance'}, output: 'reflex_bleed'
      },
      { // 2: Composite
        helpers: `
            vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x); }
            float hue_dist(float a,float b){ float d=abs(a-b); return min(d,1.0-d); }
        `,
        shader: `
            vec3 base_color = color.rgb;
            vec3 reflection_color = texture2D(u_reflex_bleed_tex, v_texCoord).rgb;
            
            vec3 base_hsv = rgb2hsv(base_color);
            vec3 reflection_hsv = rgb2hsv(reflection_color);
            
            float dirt_mask = smoothstep(0.3, 0.5, hue_dist(base_hsv.x, reflection_hsv.x)) * (1.0 - smoothstep(0.1, 0.3, base_hsv.y));
            vec3 reflection_neutral = vec3(dot(reflection_color, vec3(0.333)));
            vec3 clean_reflection = mix(reflection_color, reflection_neutral, dirt_mask * u_suppress);

            float shadow_mask = 1.0 - smoothstep(0.0, 0.5, base_hsv.z);
            
            vec3 final_color = base_color + clean_reflection * u_enhance * shadow_mask;
            gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_reflex_bleed_tex': 'reflex_bleed'}, output: 'final'
      }
    ]
  },
  {
    id: 'deconvolution-denoise',
    name: 'Hybrid Deconvolution Denoise',
    category: 'Ultimate Engines',
    params: [
      { id: 'strength', name: 'Strength', min: 0, max: 1, step: 0.01, initialValue: 0.8, unit: '' },
      { id: 'edgeThreshold', name: 'Edge Threshold', min: 0.01, max: 0.5, step: 0.01, initialValue: 0.1, unit: '' }
    ],
    passes: [
      { // 0: Create a very smooth base layer
        shader: `
          vec2 p = 8.0 / u_resolution; vec4 sum = vec4(0.0);
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.;
          gl_FragColor = sum;`,
        inputs: {'u_texture': 'source'}, output: 'denoise_base'
      },
      { // 1: Create an edge map for regularization
        shader: `
            vec2 p = 1.0 / u_resolution;
            float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float Gx = lumE - lumW; float Gy = lumS - lumN;
            float edge = sqrt(Gx*Gx + Gy*Gy);
            float edge_mask = 1.0 - smoothstep(u_edgeThreshold, u_edgeThreshold + 0.1, edge);
            gl_FragColor = vec4(vec3(edge_mask), 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'denoise_edges'
      },
      { // 2: Composite
        shader: `
            vec3 base_color = texture2D(u_denoise_base_tex, v_texCoord).rgb;
            float edge_mask = texture2D(u_denoise_edges_tex, v_texCoord).r;
            float mix_factor = edge_mask * u_strength;
            gl_FragColor = vec4(mix(color.rgb, base_color, mix_factor), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_denoise_base_tex': 'denoise_base', 'u_denoise_edges_tex': 'denoise_edges'}, output: 'final'
      }
    ]
  },
  {
    id: 'hierarchical-contrast',
    name: 'Adaptive Hierarchical Contrast',
    category: 'Ultimate Engines',
    params: [
        { id: 'drama', name: 'Dramatism', min: 0, max: 2, step: 0.01, initialValue: 1.0, unit: '' }
    ],
    passes: [
      { // 0: Low frequency (large shapes)
        shader: `vec2 p=12.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'hc_low'
      },
      { // 1: Mid frequency (texture)
        shader: `vec2 p=3.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'hc_mid'
      },
      { // 2: Composite
        shader: `
            vec3 low_freq = texture2D(u_hc_low_tex, v_texCoord).rgb;
            vec3 mid_freq = texture2D(u_hc_mid_tex, v_texCoord).rgb;
            
            vec3 low_band = low_freq;
            vec3 mid_band = mid_freq - low_freq;
            vec3 high_band = color.rgb - mid_freq;

            float low_mult = u_drama;
            float mid_mult = pow(u_drama, 0.7);
            float high_mult = pow(u_drama, 0.4);

            vec3 enhanced_low = ((low_band - 0.5) * low_mult) + 0.5;
            vec3 enhanced_mid = mid_band * mid_mult;
            vec3 enhanced_high = high_band * high_mult;
            
            gl_FragColor = vec4(clamp(enhanced_low + enhanced_mid + enhanced_high, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_hc_low_tex': 'hc_low', 'u_hc_mid_tex': 'hc_mid'}, output: 'final'
      }
    ]
  },
  {
    id: 'color-flow',
    name: 'Color Flow Analysis',
    category: 'Ultimate Engines',
    params: [
      { id: 'harmony', name: 'Harmony', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' }
    ],
    passes: [
      { // 0: Create a heavily blurred color flow map
        shader: `vec2 p = 25.0/u_resolution; vec4 sum=vec4(0.0); for(float x=-2.;x<=2.;x++){for(float y=-2.;y<=2.;y++){sum+=texture2D(u_texture,v_texCoord+p*vec2(x,y));}} gl_FragColor=sum/25.;`,
        inputs: {'u_texture': 'source'}, output: 'cf_flowmap'
      },
      { // 1: Composite using hue from flow map
        helpers: `
          vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x); }
          vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
        `,
        shader: `
          vec3 original_hsv = rgb2hsv(color.rgb);
          vec3 flow_hsv = rgb2hsv(texture2D(u_cf_flowmap_tex, v_texCoord).rgb);
          
          float new_hue = mix(original_hsv.x, flow_hsv.x, u_harmony);
          
          vec3 final_hsv = vec3(new_hue, original_hsv.y, original_hsv.z);
          
          gl_FragColor = vec4(hsv2rgb(final_hsv), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_cf_flowmap_tex': 'cf_flowmap'}, output: 'final'
      }
    ]
  },
  {
    id: 'atmospheric-scattering',
    name: 'Atmospheric Scattering Synthesizer',
    category: 'Ultimate Engines',
    params: [
      { id: 'density', name: 'Air Density (Rayleigh)', min: 0, max: 1, step: 0.01, initialValue: 0.2, unit: '' },
      { id: 'haze', name: 'Haze/Dust (Mie)', min: 0, max: 1, step: 0.01, initialValue: 0.1, unit: '' }
    ],
    passes: [
      { // 0: Pseudo Depth Map
        shader: `
          float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          float depth = smoothstep(1.0, 0.0, v_texCoord.y) * 0.8 + luma * 0.2;
          gl_FragColor = vec4(vec3(depth), 1.0);`,
        inputs: {'u_texture': 'source'}, output: 'as_depth'
      },
      { // 1: Composite with scattering simulation
        shader: `
          float depth = texture2D(u_as_depth_tex, v_texCoord).r;
          
          vec3 rayleigh_color = vec3(0.1, 0.2, 0.4); // Blue sky
          vec3 mie_color = vec3(0.9, 0.9, 0.8);      // White/Sun haze
          
          float rayleigh_factor = pow(depth, 2.0) * u_density;
          float mie_factor = pow(depth, 0.5) * u_haze;
          
          vec3 final_color = mix(color.rgb, rayleigh_color, rayleigh_factor);
          final_color = mix(final_color, mie_color, mie_factor);
          
          float contrast_loss = 1.0 - depth * (u_density + u_haze) * 0.5;
          final_color = ((final_color - 0.5) * contrast_loss) + 0.5;
          
          gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_as_depth_tex': 'as_depth'}, output: 'final'
      }
    ]
  },
  {
    id: 'entropic-balancer',
    name: 'Entropic Balancer',
    category: 'Ultimate Engines',
    params: [
      { id: 'balance', name: 'Balance', min: 0, max: 4, step: 0.05, initialValue: 1.5, unit: 'x' },
      { id: 'threshold', name: 'Threshold', min: 0, max: 0.5, step: 0.01, initialValue: 0.1, unit: '' }
    ],
    passes: [
      { // 0: Entropy Map (edge detection)
        shader: `
            vec2 p = 1.0 / u_resolution;
            float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float Gx = lumE - lumW; float Gy = lumS - lumN;
            float edge = sqrt(Gx*Gx + Gy*Gy);
            float entropy = smoothstep(u_threshold, u_threshold + 0.2, edge);
            gl_FragColor = vec4(vec3(entropy), 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'eb_entropy_map'
      },
      { // 1: Blur for unsharp mask and smoothing
        shader: `vec2 p=2.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'eb_blur'
      },
      { // 2: Composite
        shader: `
            vec3 blur = texture2D(u_eb_blur_tex, v_texCoord).rgb;
            float entropy = texture2D(u_eb_entropy_map_tex, v_texCoord).r;
            vec3 details = (color.rgb - blur) * u_balance;
            vec3 sharpened_color = color.rgb + details;
            
            vec3 final_color = mix(blur, sharpened_color, entropy);
            gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_eb_entropy_map_tex': 'eb_entropy_map', 'u_eb_blur_tex': 'eb_blur'}, output: 'final'
      }
    ]
  },
  {
    id: 'hierarchical-texture-synthesizer',
    name: 'Hierarchical Texture Synthesizer',
    category: 'Ultimate Engines',
    params: [
      { id: 'synthesis', name: 'Synthesis', min: 0, max: 0.2, step: 0.001, initialValue: 0.05, unit: '' },
      { id: 'sharpness', name: 'Sharpness', min: 0, max: 5, step: 0.1, initialValue: 1.0, unit: '' }
    ],
    passes: [
      { // 0: Flat area detection (inverted Sobel)
        shader: `
            vec2 p = 1.0 / u_resolution;
            float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float Gx = lumE - lumW; float Gy = lumS - lumN;
            float edge = sqrt(Gx*Gx + Gy*Gy);
            gl_FragColor = vec4(vec3(1.0 - smoothstep(0.0, 0.2, edge)), 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'hts_flat_mask'
      },
      { // 1: Unsharp mask blur
        shader: `vec2 p=1.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'hts_blur'
      },
      { // 2: Composite
        helpers: `float random(vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453); }`,
        shader: `
            vec3 blur = texture2D(u_hts_blur_tex, v_texCoord).rgb;
            vec3 details = (color.rgb - blur) * u_sharpness;
            vec3 sharpened = color.rgb + details;
            float flat_mask = texture2D(u_hts_flat_mask_tex, v_texCoord).r;
            float noise = (random(v_texCoord * u_resolution.x * (u_time*0.1)) - 0.5) * u_synthesis;
            vec3 final_color = mix(sharpened, sharpened + noise, flat_mask);
            gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_hts_flat_mask_tex': 'hts_flat_mask', 'u_hts_blur_tex': 'hts_blur'}, output: 'final'
      }
    ]
  },
  {
      id: 'entropic-recombination',
      name: 'Entropic Recombination',
      category: 'Ultimate Engines',
      params: [
        { id: 'balance', name: 'Balance', min: 0.5, max: 1.5, step: 0.01, initialValue: 1.0, unit: '' }
      ],
      passes: [
        { // 0: Entropy map (Sobel)
          shader: `
              vec2 p = 1.0 / u_resolution;
              float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
              float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
              float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
              float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
              float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
              float Gx = lumE - lumW; float Gy = lumS - lumN;
              float edge = sqrt(Gx*Gx + Gy*Gy);
              gl_FragColor = vec4(vec3(edge), 1.0);
          `,
          inputs: {'u_texture': 'source'}, output: 'er_entropy_map'
        },
        { // 1: Blur
          shader: `vec2 p=2.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
          inputs: {'u_texture': 'source'}, output: 'er_blur'
        },
        { // 2: Composite
          shader: `
              float entropy = texture2D(u_er_entropy_map_tex, v_texCoord).r;
              vec3 blur = texture2D(u_er_blur_tex, v_texCoord).rgb;
              vec3 details = color.rgb - blur;
              float chaos_factor = smoothstep(0.4, 0.8, entropy);
              float flatness_factor = 1.0 - smoothstep(0.0, 0.2, entropy);
              float smoothing_amount = max(0.0, 1.0 - u_balance) * 2.0 * chaos_factor;
              float sharpening_amount = max(0.0, u_balance - 1.0) * 2.0 * flatness_factor;
              vec3 final_color = color.rgb;
              final_color = mix(final_color, blur, smoothing_amount);
              final_color += details * sharpening_amount;
              gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
          `,
          inputs: {'u_texture': 'source', 'u_er_entropy_map_tex': 'er_entropy_map', 'u_er_blur_tex': 'er_blur'}, output: 'final'
        }
      ]
  },
  {
      id: 'apophenia-simulator',
      name: 'Apophenia Simulator',
      category: 'Ultimate Engines',
      params: [
        { id: 'imagination', name: 'Imagination', min: 0, max: 0.02, step: 0.0001, initialValue: 0.005, unit: '' }
      ],
      passes: [{
        helpers: `
          float random (vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453); }
          float noise (vec2 st) {
              vec2 i = floor(st);
              vec2 f = fract(st);
              float a = random(i);
              float b = random(i + vec2(1.0, 0.0));
              float c = random(i + vec2(0.0, 1.0));
              float d = random(i + vec2(1.0, 1.0));
              vec2 u = f*f*(3.0-2.0*f);
              return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }
        `,
        shader: `
          vec2 offset_n = vec2(noise(v_texCoord * 5.0 + u_time), noise(v_texCoord * 5.0 + vec2(10.0, 10.0) - u_time)) - 0.5;
          float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          vec2 offset = offset_n * u_imagination * (1.0 - lum);
          gl_FragColor = texture2D(u_texture, v_texCoord + offset);
        `,
        inputs: {'u_texture': 'source'}, output: 'final'
      }]
  },
  {
      id: 'material-synthesizer',
      name: 'Material Synthesizer',
      category: 'Ultimate Engines',
      params: [
        { id: 'clarity', name: 'Albedo Clarity', min: 1, max: 2, step: 0.01, initialValue: 1.2, unit: 'x' },
        { id: 'glossiness', name: 'Glossiness', min: 0, max: 3, step: 0.1, initialValue: 1.0, unit: '' },
        { id: 'relief', name: 'Relief', min: 0, max: 0.5, step: 0.01, initialValue: 0.1, unit: '' }
      ],
      passes: [
        { // 0: Specular/Gloss map
          shader: `float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114)); gl_FragColor = vec4(vec3(smoothstep(0.8, 1.0, lum)), 1.0);`,
          inputs: {'u_texture': 'source'}, output: 'ms_spec_map'
        },
        { // 1: Albedo map (wide blur)
          shader: `vec2 p = 20.0 / u_resolution; vec4 sum=vec4(0.0); for(float x=-2.;x<=2.;x++){for(float y=-2.;y<=2.;y++){sum+=texture2D(u_texture,v_texCoord+p*vec2(x,y));}} gl_FragColor=sum/25.;`,
          inputs: {'u_texture': 'source'}, output: 'ms_albedo_map'
        },
        { // 2: Composite
          shader: `
              vec3 albedo = texture2D(u_ms_albedo_map_tex, v_texCoord).rgb;
              vec3 details = color.rgb - albedo;
              // Clean albedo
              vec3 luma_vec = vec3(0.299, 0.587, 0.114);
              float albedo_lum = dot(albedo, luma_vec);
              vec3 clean_albedo = mix(vec3(albedo_lum), albedo, u_clarity);
              // Enhance gloss
              float spec_mask = texture2D(u_ms_spec_map_tex, v_texCoord).r;
              vec3 glossed_details = details * (1.0 + spec_mask * u_glossiness);
              // Fake relief
              vec2 p = 1.0/u_resolution;
              float l_l = dot(texture2D(u_texture, v_texCoord - vec2(p.x,0)).rgb, luma_vec);
              float l_r = dot(texture2D(u_texture, v_texCoord + vec2(p.x,0)).rgb, luma_vec);
              float l_u = dot(texture2D(u_texture, v_texCoord + vec2(0,p.y)).rgb, luma_vec);
              float l_d = dot(texture2D(u_texture, v_texCoord - vec2(0,p.y)).rgb, luma_vec);
              vec3 normal = normalize(vec3(l_l-l_r, l_d-l_u, 0.5));
              vec3 light_dir = normalize(vec3(0.5, 0.5, 1.0));
              float relief_mod = dot(normal, light_dir) * u_relief;
              vec3 final_color = clean_albedo + glossed_details + relief_mod - (u_relief * 0.5);
              gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
          `,
          inputs: {'u_texture': 'source', 'u_ms_spec_map_tex': 'ms_spec_map', 'u_ms_albedo_map_tex': 'ms_albedo_map'}, output: 'final'
        }
      ]
  },
  // Color & Tone
  { id: 'brightness', name: 'Brightness', category: 'Color & Tone', params: [{ id: 'amount', name: 'Amount', min: 0, max: 2, step: 0.01, initialValue: 1, unit: 'x' }], passes: [{ shader: `gl_FragColor = vec4(color.rgb * u_amount, color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'contrast', name: 'Contrast', category: 'Color & Tone', params: [{ id: 'amount', name: 'Amount', min: 0, max: 2, step: 0.01, initialValue: 1, unit: 'x' }], passes: [{ shader: `gl_FragColor = vec4(((color.rgb - 0.5) * u_amount) + 0.5, color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'saturate', name: 'Saturate', category: 'Color & Tone', params: [{ id: 'amount', name: 'Amount', min: 0, max: 2, step: 0.01, initialValue: 1, unit: 'x' }], passes: [{ shader: `vec3 luminance = vec3(0.2125, 0.7154, 0.0721); vec3 gray = vec3(dot(color.rgb, luminance)); gl_FragColor = vec4(mix(gray, color.rgb, u_amount), color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'grayscale', name: 'Grayscale', category: 'Color & Tone', params: [{ id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '%' }], passes: [{ shader: `vec3 luminance = vec3(0.2125, 0.7154, 0.0721); vec3 gray = vec3(dot(color.rgb, luminance)); gl_FragColor = vec4(mix(color.rgb, gray, u_amount), color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'sepia', name: 'Sepia', category: 'Color & Tone', params: [{ id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '%' }], passes: [{ shader: `vec3 sepia = vec3(dot(color.rgb, vec3(0.393, 0.769, 0.189)), dot(color.rgb, vec3(0.349, 0.686, 0.168)), dot(color.rgb, vec3(0.272, 0.534, 0.131))); gl_FragColor = vec4(mix(color.rgb, sepia, u_amount), color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'invert', name: 'Invert', category: 'Color & Tone', params: [{ id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0, unit: '%' }], passes: [{ shader: `gl_FragColor = vec4(mix(color.rgb, 1.0 - color.rgb, u_amount), color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'blur', name: 'Blur', category: 'Color & Tone', params: [{ id: 'amount', name: 'Amount', min: 0, max: 10, step: 0.1, initialValue: 0, unit: 'px' }], passes: [{ shader: `if (u_amount == 0.0) { gl_FragColor = color; return; } vec2 p = u_amount / u_resolution; vec4 sum = vec4(0.0); sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.; gl_FragColor = sum;`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'hue-rotate', name: 'Hue Shift', category: 'Color & Tone', params: [{ id: 'angle', name: 'Angle', min: 0, max: 360, step: 1, initialValue: 0, unit: 'deg' }], passes: [{ shader: `float a = u_angle*3.14159/180.0; mat3 m = mat3(0.213,0.715,0.072, 0.213,0.715,0.072, 0.213,0.715,0.072) + mat3(cos(a),-sin(a),0.0, sin(a),cos(a),0.0, 0.0,0.0,1.0) * mat3(0.787,-0.715,-0.072, -0.213,0.285,-0.072, -0.213,-0.715,0.928); gl_FragColor = vec4(color.rgb * m, color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  
  // Effects & Texture
  { id: 'vignette', name: 'Vignette', category: 'Effects & Texture', params: [{ id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0.3, unit: '' },{ id: 'size', name: 'Size', min: 0, max: 1, step: 0.01, initialValue: 0.7, unit: '' }], passes: [{ shader: `float d=distance(v_texCoord,vec2(0.5)); gl_FragColor=vec4(color.rgb*(1.0-smoothstep(u_size-0.4,u_size,d)*u_amount),color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'scanlines', name: 'Scanlines', category: 'Effects & Texture', params: [{ id: 'density', name: 'Density', min: 100, max: 1000, step: 1, initialValue: 500, unit: '' },{ id: 'opacity', name: 'Opacity', min: 0, max: 1, step: 0.01, initialValue: 0.1, unit: '' }], passes: [{ shader: `float l=sin(v_texCoord.y*u_density); float d=(1.0-u_opacity)+(l*u_opacity); gl_FragColor=vec4(color.rgb*d,color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  {
    id: 'bloom',
    name: 'Bloom',
    category: 'Effects & Texture',
    params: [
      { id: 'intensity', name: 'Intensity', min: 0, max: 3, step: 0.01, initialValue: 0.8, unit: '' },
      { id: 'threshold', name: 'Threshold', min: 0, max: 1, step: 0.01, initialValue: 0.85, unit: '' },
      { id: 'radius', name: 'Radius', min: 1, max: 20, step: 1, initialValue: 8, unit: 'px' }
    ],
    passes: [
      { // 0: Bright Pass
        shader: `
          float lum = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(color.rgb * smoothstep(u_threshold - 0.1, u_threshold + 0.1, lum), color.a);
        `,
        inputs: {'u_texture': 'source'}, output: 'bloom_bright'
      },
      { // 1: Horizontal Blur
        shader: `
          vec2 p = vec2(u_radius / u_resolution.x, 0.0);
          vec4 sum = vec4(0.0);
          float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
          sum += texture2D(u_texture, v_texCoord) * weights[0];
          for(int i = 1; i < 5; i++) {
              sum += texture2D(u_texture, v_texCoord + p * float(i)) * weights[i];
              sum += texture2D(u_texture, v_texCoord - p * float(i)) * weights[i];
          }
          gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'bloom_bright'}, output: 'bloom_blur_h'
      },
      { // 2: Vertical Blur
        shader: `
          vec2 p = vec2(0.0, u_radius / u_resolution.y);
          vec4 sum = vec4(0.0);
          float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
          sum += texture2D(u_texture, v_texCoord) * weights[0];
          for(int i = 1; i < 5; i++) {
              sum += texture2D(u_texture, v_texCoord + p * float(i)) * weights[i];
              sum += texture2D(u_texture, v_texCoord - p * float(i)) * weights[i];
          }
          gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'bloom_blur_h'}, output: 'bloom_blur_v'
      },
      { // 3: Composite
        shader: `
          vec4 bloom_color = texture2D(u_bloom_blur_v_tex, v_texCoord);
          gl_FragColor = vec4(color.rgb + bloom_color.rgb * u_intensity, color.a);
        `,
        inputs: {'u_texture': 'source', 'u_bloom_blur_v_tex': 'bloom_blur_v'}, output: 'final'
      }
    ]
  },
  {
    id: 'halftone',
    name: 'Halftone',
    category: 'Effects & Texture',
    params: [
      { id: 'frequency', name: 'Frequency', min: 5, max: 100, step: 1, initialValue: 20, unit: '' },
      { id: 'angle', name: 'Angle', min: 0, max: 3.1415, step: 0.01, initialValue: 0.785, unit: 'rad' },
      { id: 'scale', name: 'Scale', min: 0.5, max: 2.0, step: 0.01, initialValue: 1.2, unit: 'x' }
    ],
    passes: [{
      helpers: `mat2 rotate(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }`,
      shader: `
        float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        vec2 rotated_uv = rotate(u_angle) * (v_texCoord - 0.5) * (u_resolution.x / u_resolution.y);
        vec2 grid_uv = fract(rotated_uv * u_frequency);
        float dist = distance(grid_uv, vec2(0.5)) * 2.0;
        float dot_size = mix(1.5, 0.5, lum) * u_scale;
        float halftone = smoothstep(dot_size, dot_size - 0.1, dist);
        gl_FragColor = vec4(vec3(halftone), color.a);
      `,
      inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },

  // Distortion
  { id: 'aberration', name: 'Aberration', category: 'Distortion', params: [{ id: 'offset', name: 'Offset', min: 0, max: 0.02, step: 0.0001, initialValue: 0.002, unit: '' }], passes: [{ shader: `float r=texture2D(u_texture,v_texCoord+vec2(u_offset,0.0)).r; float g=texture2D(u_texture,v_texCoord).g; float b=texture2D(u_texture,v_texCoord-vec2(u_offset,0.0)).b; gl_FragColor=vec4(r,g,b,color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'hex-pixelate', name: 'Hex Pixelate', category: 'Distortion', params: [{ id: 'size', name: 'Size', min: 5, max: 50, step: 1, initialValue: 10, unit: 'px' }], passes: [{ shader: `vec2 p=v_texCoord*u_resolution; vec2 r=vec2(1.0,1.732); vec2 h=r*0.5; vec2 a=mod(p,r)-h; vec2 b=mod(p-h,r)-h; vec2 g=dot(a,a)<dot(b,b)?a:b; gl_FragColor=texture2D(u_texture,(p-g)/u_resolution);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'dot-screen', name: 'Dot Screen', category: 'Distortion', params: [{id: 'angle', name: 'Angle', min: 0, max: 3.14, step: 0.01, initialValue: 1.57, unit: ''},{id: 'size', name: 'Size', min: 1, max: 10, step: 0.1, initialValue: 3, unit: ''}], passes: [{ shader: `float s=sin(u_angle),c=cos(u_angle); vec2 tex=v_texCoord*u_resolution.xy; vec2 p=vec2(c*tex.x-s*tex.y,s*tex.x+c*tex.y)*u_size; float pat=(sin(p.x)*sin(p.y))*4.0; float avg=(color.r+color.g+color.b)/3.0; gl_FragColor=vec4(vec3(avg*10.0-5.0+pat),color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  { id: 'adv-glitch', name: 'Advanced Glitch', category: 'Distortion', params: [{ id: 'intensity', name: 'Intensity', min: 0, max: 1, step: 0.01, initialValue: 0.1, unit: '' }], passes: [{ shader: `if(u_intensity==0.0){gl_FragColor=color;return;} float t=floor(u_time*10.0); float d=fract(sin(dot(vec2(t),vec2(12.9898,78.233)))*43758.5453)*u_intensity*0.2; if(v_texCoord.y>fract(t/2.0)-0.025&&v_texCoord.y<fract(t/2.0)+0.025){d+=fract(sin(dot(vec2(t*2.0),vec2(12.9898,78.233)))*43758.5453)*u_intensity*0.2;} vec2 o=vec2(d,0.0); float r=texture2D(u_texture,v_texCoord+o).r; float g=color.g; float b=texture2D(u_texture,v_texCoord-o).b; gl_FragColor=vec4(r,g,b,color.a);`, inputs: {'u_texture': 'source'}, output: 'final' }] },
  {
    id: 'lens-correction',
    name: 'Lens Correction',
    category: 'Distortion',
    params: [
      { id: 'correction', name: 'Distortion', min: -1, max: 1, step: 0.01, initialValue: 0, unit: '' },
      { id: 'chroma', name: 'Fringing', min: -0.05, max: 0.05, step: 0.001, initialValue: 0, unit: '' }
    ],
    passes: [{
      shader: `
        vec2 p = (v_texCoord - 0.5) * 2.0;
        float r_dist = 1.0 + dot(p,p) * (u_correction + u_chroma);
        float g_dist = 1.0 + dot(p,p) * u_correction;
        float b_dist = 1.0 + dot(p,p) * (u_correction - u_chroma);
        vec2 pr = p * r_dist * 0.5 + 0.5;
        vec2 pg = p * g_dist * 0.5 + 0.5;
        vec2 pb = p * b_dist * 0.5 + 0.5;
        float r = texture2D(u_texture, pr).r;
        float g = texture2D(u_texture, pg).g;
        float b = texture2D(u_texture, pb).b;
        if (pr.x > 1.0 || pr.x < 0.0 || pr.y > 1.0 || pr.y < 0.0) r = 0.0;
        if (pg.x > 1.0 || pg.x < 0.0 || pg.y > 1.0 || pg.y < 0.0) g = 0.0;
        if (pb.x > 1.0 || pb.x < 0.0 || pb.y > 1.0 || pb.y < 0.0) b = 0.0;
        gl_FragColor = vec4(r, g, b, color.a);
      `,
      inputs: {'u_texture': 'source'},
      output: 'final'
    }]
  },
  {
    id: 'tilt-shift',
    name: 'Tilt Shift',
    category: 'Distortion',
    params: [
      { id: 'blurRadius', name: 'Blur Radius', min: 0, max: 20, step: 1, initialValue: 10, unit: 'px' },
      { id: 'focusSize', name: 'Focus Size', min: 0.01, max: 0.5, step: 0.01, initialValue: 0.2, unit: '' },
      { id: 'center', name: 'Focus Center', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' }
    ],
    passes: [
      { // 0: Horizontal Blur
        shader: `
          vec2 p = vec2(u_blurRadius / u_resolution.x, 0.0);
          vec4 sum = vec4(0.0);
          float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
          sum += texture2D(u_texture, v_texCoord) * weights[0];
          for(int i = 1; i < 5; i++) {
              sum += texture2D(u_texture, v_texCoord + p * float(i)) * weights[i];
              sum += texture2D(u_texture, v_texCoord - p * float(i)) * weights[i];
          }
          gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'source'}, output: 'tilt_blur_h'
      },
      { // 1: Vertical Blur
        shader: `
          vec2 p = vec2(0.0, u_blurRadius / u_resolution.y);
          vec4 sum = vec4(0.0);
          float weights[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
          sum += texture2D(u_texture, v_texCoord) * weights[0];
          for(int i = 1; i < 5; i++) {
              sum += texture2D(u_texture, v_texCoord + p * float(i)) * weights[i];
              sum += texture2D(u_texture, v_texCoord - p * float(i)) * weights[i];
          }
          gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'tilt_blur_h'}, output: 'tilt_blur_v'
      },
      { // 2: Composite
        shader: `
          float dist = abs(v_texCoord.y - u_center);
          float focus_area = (0.5 - u_focusSize);
          float focus = smoothstep(focus_area, 0.5, dist);
          vec4 blur_color = texture2D(u_tilt_blur_v_tex, v_texCoord);
          gl_FragColor = mix(color, blur_color, focus);
        `,
        inputs: {'u_texture': 'source', 'u_tilt_blur_v_tex': 'tilt_blur_v'}, output: 'final'
      }
    ]
  },

  // --- Aesthetic Core Engine ---
  {
    id: 'dream-eater',
    name: 'Dream Eater',
    category: 'Aesthetic Core Engine',
    params: [
      { id: 'glow', name: 'Glow', min: 0, max: 2, step: 0.01, initialValue: 0.4, unit: '' },
      { id: 'haze', name: 'Haze', min: 0, max: 0.5, step: 0.01, initialValue: 0.1, unit: '' },
      { id: 'aberration', name: 'Fringing', min: 0, max: 0.005, step: 0.0001, initialValue: 0.001, unit: '' }
    ],
    passes: [
      { // 0: Isolate bright areas for glow
        shader: `float lum=dot(color.rgb,vec3(0.2126,0.7152,0.0722)); gl_FragColor=vec4(color.rgb*smoothstep(0.7,0.9,lum),color.a);`,
        inputs: {'u_texture': 'source'}, output: 'dream_bright'
      },
      { // 1: Blur the bright areas
        shader: `
          vec2 p = 8.0 / u_resolution; vec4 sum = vec4(0.0);
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.;
          gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'dream_bright'}, output: 'dream_glow'
      },
      { // 2: Composite
        shader: `
          vec3 glow = texture2D(u_dream_glow_tex, v_texCoord).rgb;
          // Aberration
          float r = texture2D(u_texture, v_texCoord + vec2(u_aberration, 0.0)).r;
          float b = texture2D(u_texture, v_texCoord - vec2(u_aberration, 0.0)).b;
          vec3 aberrated_color = vec3(r, color.g, b);
          // Screen blend glow
          vec3 final_color = 1.0 - (1.0 - aberrated_color) * (1.0 - glow * u_glow);
          // Haze
          final_color = mix(final_color, vec3(1.0), u_haze);
          // Desaturate shadows slightly
          float lum = dot(final_color, vec3(0.299, 0.587, 0.114));
          vec3 gray = vec3(lum);
          final_color = mix(final_color, gray, (1.0 - smoothstep(0.0, 0.3, lum)) * 0.2);
          gl_FragColor = vec4(final_color, color.a);
        `,
        inputs: {'u_texture': 'source', 'u_dream_glow_tex': 'dream_glow'}, output: 'final'
      }
    ]
  },
  {
    id: 'structural-light', name: 'Structural Light', category: 'Aesthetic Core Engine',
    params: [
      { id: 'microContrast', name: 'Micro Contrast', min: 1, max: 5, step: 0.1, initialValue: 1, unit: 'x' },
      { id: 'macroContrast', name: 'Macro Contrast', min: 1, max: 2, step: 0.01, initialValue: 1, unit: 'x' },
    ],
    passes: [
      { // 0: Low-pass blur
        shader: `vec2 p = 8.0 / u_resolution; vec4 sum = vec4(0.0); sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.; gl_FragColor = sum;`,
        inputs: {'u_texture': 'source'}, output: 'low_pass'
      },
      { // 1: Final composition
        shader: `vec4 low = texture2D(u_low_pass_tex, v_texCoord); vec4 high = color - low + 0.5; high = (high - 0.5) * u_microContrast + 0.5; vec3 macro = ((low.rgb - 0.5) * u_macroContrast) + 0.5; gl_FragColor = vec4(macro + high.rgb - 0.5, color.a);`,
        inputs: {'u_texture': 'source', 'u_low_pass_tex': 'low_pass'}, output: 'final'
      }
    ]
  },
  {
    id: 'color-harmony', name: 'Color Harmony', category: 'Aesthetic Core Engine',
    params: [
        { id: 'teal', name: 'Hue 1 (Teal)', min: 0, max: 360, step: 1, initialValue: 180, unit: '°' },
        { id: 'orange', name: 'Hue 2 (Orange)', min: 0, max: 360, step: 1, initialValue: 30, unit: '°' },
        { id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' }
    ],
    passes: [{
        helpers: `
            vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x); }
            vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
            float hue_dist(float a,float b){ float d=abs(a-b); return min(d,1.0-d); }
        `,
        shader: `
            vec3 hsv = rgb2hsv(color.rgb);
            float skin_mask = smoothstep(0.03, 0.05, hsv.x) * (1.0 - smoothstep(0.1, 0.12, hsv.x)) * smoothstep(0.2, 0.3, hsv.y);
            float target_hue1 = u_teal / 360.0; float target_hue2 = u_orange / 360.0;
            float target_hue = hue_dist(hsv.x, target_hue1) < hue_dist(hsv.x, target_hue2) ? target_hue1 : target_hue2;
            hsv.x = mix(hsv.x, target_hue, u_amount * (1.0 - skin_mask));
            gl_FragColor = vec4(hsv2rgb(hsv), color.a);
        `, 
        inputs: {'u_texture': 'source'}, output: 'final' 
    }]
  },
  {
    id: 'perceptual-depth', name: 'Perceptual Depth', category: 'Aesthetic Core Engine',
    params: [
      { id: 'haze', name: 'Haze', min: 0, max: 1, step: 0.01, initialValue: 0.3, unit: '' },
      { id: 'blur', name: 'Focus Blur', min: 0, max: 5, step: 0.1, initialValue: 2, unit: '' },
    ],
    passes: [
      { // 0: Depth Map
        shader: `float lum=dot(color.rgb,vec3(0.299,0.587,0.114)); float depth=smoothstep(0.0,1.0,v_texCoord.y)*0.8+lum*0.2; gl_FragColor=vec4(vec3(depth),1.0);`,
        inputs: {'u_texture': 'source'}, output: 'depth_map'
      },
      { // 1: Blur far areas
        shader: `
            float depth = texture2D(u_depth_map_tex, v_texCoord).r;
            if (depth < 0.3) { gl_FragColor = texture2D(u_texture, v_texCoord); return; }
            vec2 p = u_blur * depth * depth / u_resolution;
            vec4 sum = vec4(0.0);
            sum += texture2D(u_texture, v_texCoord + p * vec2(-1.0, -1.0)); sum += texture2D(u_texture, v_texCoord + p * vec2( 0.0, -1.0)); sum += texture2D(u_texture, v_texCoord + p * vec2( 1.0, -1.0));
            sum += texture2D(u_texture, v_texCoord + p * vec2(-1.0,  0.0)); sum += texture2D(u_texture, v_texCoord + p * vec2( 0.0,  0.0)); sum += texture2D(u_texture, v_texCoord + p * vec2( 1.0,  0.0));
            sum += texture2D(u_texture, v_texCoord + p * vec2(-1.0,  1.0)); sum += texture2D(u_texture, v_texCoord + p * vec2( 0.0,  1.0)); sum += texture2D(u_texture, v_texCoord + p * vec2( 1.0,  1.0));
            gl_FragColor = sum / 9.0;
        `,
        inputs: {'u_texture': 'source', 'u_depth_map_tex': 'depth_map'}, output: 'blurred'
      },
      { // 2: Final composite
        shader: `float depth=texture2D(u_depth_map_tex,v_texCoord).r; vec4 blurred_color=texture2D(u_blurred_tex,v_texCoord); vec4 final_color=mix(color,blurred_color,smoothstep(0.4,0.8,depth)); vec3 haze_color=vec3(0.8,0.9,1.0); gl_FragColor=vec4(mix(final_color.rgb,haze_color,depth*u_haze),color.a);`,
        inputs: {'u_texture': 'source', 'u_depth_map_tex': 'depth_map', 'u_blurred_tex': 'blurred'}, output: 'final'
      }
    ]
  },
  {
    id: 'subsurface-glow', name: 'Subsurface Glow', category: 'Aesthetic Core Engine',
    params: [{ id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' }],
    passes: [
      { // 0: Blur pass
        shader: `vec2 p=6.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'blur_tex'
      },
      { // 1: Composite
        shader: `float lum=dot(color.rgb,vec3(0.299,0.587,0.114)); vec4 blur=texture2D(u_blur_tex,v_texCoord); vec3 screen=1.0-(1.0-color.rgb)*(1.0-blur.rgb); float mask=smoothstep(0.5,1.0,lum); gl_FragColor=vec4(mix(color.rgb,screen,u_amount*mask),color.a);`,
        inputs: {'u_texture': 'source', 'u_blur_tex': 'blur_tex'}, output: 'final'
      }
    ]
  },
  {
    id: 'dynamic-clarity', name: 'Dynamic Clarity', category: 'Aesthetic Core Engine',
    params: [{ id: 'amount', name: 'Amount', min: 0, max: 5, step: 0.1, initialValue: 1.0, unit: '' }],
    passes: [
      { // 0: Edge/Midtone mask
        shader: `
            float tx = 1.0 / u_resolution.x;
            float ty = 1.0 / u_resolution.y;
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, -ty)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord + vec2(0.0,  ty)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord + vec2(-tx, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2( tx, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float edge = sqrt(pow(lumE - lumW, 2.0) + pow(lumS - lumN, 2.0));
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float midtone_mask = 1.0 - abs(lum - 0.5) * 2.0;
            gl_FragColor = vec4(vec3(clamp(edge * midtone_mask * 5.0, 0.0, 1.0)), 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'clarity_mask'
      },
      { // 1: Blur the source image for unsharp mask
        shader: `
            vec2 p = 2.0 / u_resolution; 
            vec4 sum = vec4(0.0);
            sum += texture2D(u_texture, v_texCoord + p * vec2(-1.0, -1.0)) * 1.0 / 16.0; sum += texture2D(u_texture, v_texCoord + p * vec2( 0.0, -1.0)) * 2.0 / 16.0; sum += texture2D(u_texture, v_texCoord + p * vec2( 1.0, -1.0)) * 1.0 / 16.0;
            sum += texture2D(u_texture, v_texCoord + p * vec2(-1.0,  0.0)) * 2.0 / 16.0; sum += texture2D(u_texture, v_texCoord + p * vec2( 0.0,  0.0)) * 4.0 / 16.0; sum += texture2D(u_texture, v_texCoord + p * vec2( 1.0,  0.0)) * 2.0 / 16.0;
            sum += texture2D(u_texture, v_texCoord + p * vec2(-1.0,  1.0)) * 1.0 / 16.0; sum += texture2D(u_texture, v_texCoord + p * vec2( 0.0,  1.0)) * 2.0 / 16.0; sum += texture2D(u_texture, v_texCoord + p * vec2( 1.0,  1.0)) * 1.0 / 16.0;
            gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'source'}, output: 'clarity_blur'
      },
      { // 2: Composite using original, mask, and blurred image
        shader: `
            vec4 blur = texture2D(u_clarity_blur_tex, v_texCoord);
            vec4 sharp_details = color - blur;
            float mask = texture2D(u_clarity_mask_tex, v_texCoord).r;
            gl_FragColor = vec4(color.rgb + sharp_details.rgb * u_amount * mask, color.a);
        `,
        inputs: {
            'u_texture': 'source', 
            'u_clarity_mask_tex': 'clarity_mask', 
            'u_clarity_blur_tex': 'clarity_blur'
        }, 
        output: 'final'
      }
    ]
  },
   {
    id: 'perceptual-decontrast', name: 'Perceptual De-Contrasting', category: 'Aesthetic Core Engine',
    params: [
        { id: 'softness', name: 'Shadow Softness', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' },
        { id: 'detail', name: 'Detail Recovery', min: 0, max: 1, step: 0.01, initialValue: 0.8, unit: '' }
    ],
    passes: [
        { // 0: Create shadow mask
            shader: `float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114)); float mask = 1.0 - smoothstep(0.0, 0.5, lum); gl_FragColor = vec4(vec3(mask), 1.0);`,
            inputs: {'u_texture': 'source'}, output: 'decontrast_mask'
        },
        { // 1: Create low-frequency (blurred) version
            shader: `vec2 p=4.0/u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
            inputs: {'u_texture': 'source'}, output: 'decontrast_blur'
        },
        { // 2: Composite
            shader: `
                float mask = texture2D(u_decontrast_mask_tex, v_texCoord).r;
                vec3 blurred = texture2D(u_decontrast_blur_tex, v_texCoord).rgb;
                vec3 detail = color.rgb - blurred;
                float decontrast_amount = 1.0 - u_softness;
                vec3 soft_low_freq = ((blurred - 0.5) * decontrast_amount) + 0.5;
                vec3 reconstructed_shadows = soft_low_freq + detail * u_detail;
                gl_FragColor = vec4(mix(color.rgb, reconstructed_shadows, mask), color.a);
            `,
            inputs: {'u_texture': 'source', 'u_decontrast_mask_tex': 'decontrast_mask', 'u_decontrast_blur_tex': 'decontrast_blur'}, output: 'final'
        }
    ]
   },
  {
    id: 'psychoacoustic-clarity',
    name: 'Psychoacoustic Clarity',
    category: 'Aesthetic Core Engine',
    params: [
      { id: 'amount', name: 'Intensity', min: 0, max: 2, step: 0.01, initialValue: 0.5, unit: '' }
    ],
    passes: [
      { // 0: Saliency Map Pass
        shader: `
          vec2 p = 1.0 / u_resolution;
          float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
          float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
          float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
          float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float Gx = lumE - lumW;
          float Gy = lumS - lumN;
          float edge = sqrt(Gx*Gx + Gy*Gy);
          float avg = (lumC + lumN + lumS + lumW + lumE) / 5.0;
          float variance = (pow(lumC-avg, 2.0) + pow(lumN-avg, 2.0) + pow(lumS-avg, 2.0) + pow(lumW-avg, 2.0) + pow(lumE-avg, 2.0)) / 5.0;
          float saliency = edge * 2.0 + variance * 20.0;
          gl_FragColor = vec4(vec3(smoothstep(0.05, 0.5, saliency)), 1.0);
        `,
        inputs: {'u_texture': 'source'},
        output: 'clarity_saliency_map'
      },
      { // 1: Blur for unsharp masking and smoothing
        shader: `
          vec2 p = 2.0 / u_resolution; vec4 sum = vec4(0.0);
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.;
          gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'source'},
        output: 'clarity_blur'
      },
      { // 2: Composite
        shader: `
          vec4 blur = texture2D(u_clarity_blur_tex, v_texCoord);
          float saliency = texture2D(u_clarity_saliency_map_tex, v_texCoord).r;
          vec3 details = color.rgb - blur.rgb;
          vec3 sharpened = color.rgb + details * u_amount * 1.5;
          vec3 smoothed = mix(color.rgb, blur.rgb, (1.0 - saliency) * u_amount * 0.5);
          gl_FragColor = vec4(mix(smoothed, sharpened, saliency), color.a);
        `,
        inputs: {
          'u_texture': 'source',
          'u_clarity_saliency_map_tex': 'clarity_saliency_map',
          'u_clarity_blur_tex': 'clarity_blur'
        },
        output: 'final'
      }
    ]
  },
  {
    id: 'chromatic-orchestration',
    name: 'Chromatic Orchestration',
    category: 'Aesthetic Core Engine',
    params: [
      { id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0.2, unit: '' },
      { id: 'hue1', name: 'Tint 1', min: 0, max: 360, step: 1, initialValue: 190, unit: '°' },
      { id: 'hue2', name: 'Tint 2', min: 0, max: 360, step: 1, initialValue: 30, unit: '°' }
    ],
    passes: [{
      helpers: `
          vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x); }
          vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
          vec3 overlay(vec3 base, vec3 blend) {
              return vec3(
                  base.r < 0.5 ? (2.0 * base.r * blend.r) : (1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r)),
                  base.g < 0.5 ? (2.0 * base.g * blend.g) : (1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g)),
                  base.b < 0.5 ? (2.0 * base.b * blend.b) : (1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b))
              );
          }
      `,
      shader: `
          vec3 hsv = rgb2hsv(color.rgb);
          float midtone_mask = clamp(1.0 - abs(hsv.z - 0.5) * 2.0, 0.0, 1.0);
          float mask = smoothstep(0.4, 0.0, hsv.y) * midtone_mask;
          vec3 tint_color = hsv.z < 0.5 ? hsv2rgb(vec3(u_hue1/360.0, 0.4, 0.6)) : hsv2rgb(vec3(u_hue2/360.0, 0.4, 0.6));
          vec3 blended = overlay(color.rgb, tint_color);
          gl_FragColor = vec4(mix(color.rgb, blended, mask * u_amount), color.a);
      `,
      inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },
  {
    id: 'chromatic-coherence',
    name: 'Chromatic Coherence',
    category: 'Aesthetic Core Engine',
    params: [
      { id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' },
      { id: 'spread', name: 'Spread', min: 2, max: 50, step: 1, initialValue: 20, unit: 'px' }
    ],
    passes: [
      { // 0: Blurred color field
        shader: `
          vec4 sum = vec4(0.0);
          vec2 p = u_spread / u_resolution / 4.0;
          for(float x = -2.0; x <= 2.0; x += 1.0) {
              for(float y = -2.0; y <= 2.0; y += 1.0) {
                  sum += texture2D(u_texture, v_texCoord + p * vec2(x, y));
              }
          }
          gl_FragColor = sum / 25.0;
        `,
        inputs: {'u_texture': 'source'}, output: 'coherence_blur'
      },
      { // 1: Final composite
        helpers: `
          vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1.0e-10; return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x); }
          vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0); vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y); }
        `,
        shader: `
          vec3 original_hsv = rgb2hsv(color.rgb);
          vec3 blur_hsv = rgb2hsv(texture2D(u_coherence_blur_tex, v_texCoord).rgb);
          float new_hue = mix(original_hsv.x, blur_hsv.x, u_amount);
          vec3 final_hsv = vec3(new_hue, original_hsv.y, original_hsv.z);
          gl_FragColor = vec4(hsv2rgb(final_hsv), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_coherence_blur_tex': 'coherence_blur'}, output: 'final'
      }
    ]
  },
    {
    id: 'perceptual-quantization',
    name: 'Perceptual Quantization',
    category: 'Aesthetic Core Engine',
    params: [
      { id: 'brushSize', name: 'Brush Size', min: 1, max: 20, step: 1, initialValue: 5, unit: 'px' }
    ],
    passes: [{
      shader: `
        vec2 p = u_brushSize / u_resolution;
        vec2 grid_coord = floor(v_texCoord / p) * p + p * 0.5;
        vec4 sum = vec4(0.0);
        int count = 0;
        for (float i = -1.0; i <= 1.0; i += 1.0) {
            for (float j = -1.0; j <= 1.0; j += 1.0) {
                vec2 sample_coord = grid_coord + vec2(i, j) * p / 2.0;
                if (sample_coord.x >= 0.0 && sample_coord.x <= 1.0 && sample_coord.y >= 0.0 && sample_coord.y <= 1.0) {
                    sum += texture2D(u_texture, sample_coord);
                    count++;
                }
            }
        }
        gl_FragColor = sum / float(count);
      `,
      inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },

   // --- Advanced Engine ---
  {
    id: 'perceptual-grain', name: 'Perceptual Grain', category: 'Advanced Engine',
    params: [{ id: 'amount', name: 'Amount', min: 0, max: 0.5, step: 0.01, initialValue: 0.1, unit: '' }],
    passes: [{
        helpers: `float random(vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453); }`,
        shader: `
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float midtone_mask = (1.0 - abs(lum - 0.5) * 2.0);
            float grain = (random(v_texCoord + u_time) - 0.5) * u_amount * midtone_mask;
            gl_FragColor = vec4(color.rgb + grain, color.a);
        `,
        inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },
   {
    id: 'micro-texture', name: 'Micro-Texture', category: 'Advanced Engine',
    params: [{ id: 'amount', name: 'Amount', min: 0, max: 0.1, step: 0.001, initialValue: 0.02, unit: '' }],
    passes: [{
        helpers: `float random(vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453); }`,
        shader: `
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float midtone_mask = 1.0 - abs(lum - 0.5) * 2.0;
            midtone_mask = smoothstep(0.0, 1.0, midtone_mask);
            float noise = (random(v_texCoord * 1000.0) - 0.5) * u_amount;
            gl_FragColor = vec4(color.rgb + noise * midtone_mask, color.a);
        `,
        inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },
  {
    id: 'spectral-dispersion', name: 'Spectral Dispersion', category: 'Advanced Engine',
    params: [{ id: 'amount', name: 'Amount', min: 0, max: 0.01, step: 0.0001, initialValue: 0.003, unit: '' }],
    passes: [{
      shader: `
        float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        float mask = smoothstep(0.7, 0.9, lum);
        float dist = distance(v_texCoord, vec2(0.5));
        
        vec2 offset = normalize(v_texCoord - vec2(0.5)) * u_amount * mask * dist;

        float r = texture2D(u_texture, v_texCoord - offset).r;
        float g = texture2D(u_texture, v_texCoord).g;
        float b = texture2D(u_texture, v_texCoord + offset).b;

        gl_FragColor = vec4(r, g, b, color.a);
      `,
      inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },
  {
    id: 'diffuse-interreflection', name: 'Diffuse Inter-reflection', category: 'Advanced Engine',
    params: [
        { id: 'amount', name: 'Amount', min: 0, max: 1, step: 0.01, initialValue: 0.7, unit: '' },
        { id: 'blurSize', name: 'Spread', min: 10, max: 100, step: 1, initialValue: 50, unit: 'px' }
    ],
    passes: [
        { // 0: Radiance Map
            helpers: `vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }`,
            shader: `vec3 hsv = rgb2hsv(color.rgb); float mask = smoothstep(0.4, 0.6, hsv.y) * smoothstep(0.5, 0.7, hsv.z); gl_FragColor = vec4(color.rgb * mask, 1.0);`,
            inputs: {'u_texture': 'source'}, output: 'radiance_map'
        },
        { // 1: Blur Radiance Map
            shader: `vec2 p = u_blurSize / u_resolution; vec4 sum=vec4(0.0); for(float x=-4.;x<=4.;x++){for(float y=-4.;y<=4.;y++){sum+=texture2D(u_texture,v_texCoord+p*vec2(x,y));}} gl_FragColor=sum/81.;`,
            inputs: {'u_texture': 'radiance_map'}, output: 'reflection_map'
        },
        { // 2: Composite
            shader: `
                float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                float shadow_mask = (1.0 - smoothstep(0.0, 0.6, lum)) * u_amount;
                vec3 reflection = texture2D(u_reflection_map_tex, v_texCoord).rgb;
                vec3 final_color = color.rgb + reflection * shadow_mask;
                gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
            `,
            inputs: {'u_texture': 'source', 'u_reflection_map_tex': 'reflection_map'}, output: 'final'
        }
    ]
  },
  {
    id: 'light-decomposition', name: 'Light Decomposition', category: 'Advanced Engine',
    params: [
      { id: 'ambientIntensity', name: 'Ambient Intensity', min: 0, max: 2, step: 0.01, initialValue: 1, unit: '' },
      { id: 'ambientSoftness', name: 'Ambient Softness', min: 1, max: 50, step: 1, initialValue: 20, unit: 'px' },
      { id: 'ambientTintR', name: 'Ambient Tint R', min: 0, max: 1, step: 0.01, initialValue: 0, unit: '' },
      { id: 'ambientTintG', name: 'Ambient Tint G', min: 0, max: 1, step: 0.01, initialValue: 0, unit: '' },
      { id: 'ambientTintB', name: 'Ambient Tint B', min: 0, max: 1, step: 0.01, initialValue: 0, unit: '' },
      { id: 'specularIntensity', name: 'Specular Intensity', min: 0, max: 5, step: 0.1, initialValue: 1, unit: '' },
      { id: 'specularThreshold', name: 'Specular Threshold', min: 0.5, max: 1, step: 0.01, initialValue: 0.9, unit: '' },
      { id: 'directContrast', name: 'Direct Contrast', min: 1, max: 3, step: 0.01, initialValue: 1, unit: '' }
    ],
    passes: [
      { // 0: Ambient Light (wide blur)
        shader: `
            vec4 sum = vec4(0.0);
            vec2 p = u_ambientSoftness / u_resolution / 4.0;
            for(float x = -2.0; x <= 2.0; x += 1.0) {
                for(float y = -2.0; y <= 2.0; y += 1.0) {
                    sum += texture2D(u_texture, v_texCoord + p * vec2(x, y));
                }
            }
            gl_FragColor = sum / 25.0;
        `,
        inputs: {'u_texture': 'source'}, output: 'ambient_pass'
      },
      { // 1: Specular Highlights (threshold)
        shader: `
            float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float spec = smoothstep(u_specularThreshold - 0.05, u_specularThreshold + 0.05, lum);
            gl_FragColor = vec4(color.rgb * spec, 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'specular_pass'
      },
      { // 2: Final Composition
        shader: `
            vec3 ambient_light = texture2D(u_ambient_pass_tex, v_texCoord).rgb;
            vec3 specular_light = texture2D(u_specular_pass_tex, v_texCoord).rgb;
            
            vec3 direct_light = color.rgb - ambient_light;
            
            ambient_light = ambient_light * u_ambientIntensity + vec3(u_ambientTintR, u_ambientTintG, u_ambientTintB) * 0.5 * u_ambientIntensity;
            specular_light = specular_light * u_specularIntensity;
            direct_light = ((direct_light - 0.5) * u_directContrast) + 0.5;

            gl_FragColor = vec4(clamp(ambient_light + direct_light + specular_light, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_ambient_pass_tex': 'ambient_pass', 'u_specular_pass_tex': 'specular_pass'}, output: 'final'
      }
    ]
  },
  {
    id: 'structural-coherence', name: 'Structural Coherence', category: 'Advanced Engine',
    params: [
      { id: 'suppression', name: 'Chaos Suppression', min: 0, max: 1, step: 0.01, initialValue: 0.5, unit: '' },
      { id: 'emphasis', name: 'Structure Emphasis', min: 0, max: 3, step: 0.01, initialValue: 1, unit: '' }
    ],
    passes: [
      { // 0: Coherence Map (Sobel edge detection)
        shader: `
            vec2 p = 1.0 / u_resolution;
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float Gx = lumE - lumW;
            float Gy = lumS - lumN;
            float edge = sqrt(Gx*Gx + Gy*Gy);
            float coherence = smoothstep(0.05, 0.4, edge);
            gl_FragColor = vec4(vec3(coherence), 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'coherence_map'
      },
      { // 1: Blurred source for mixing and sharpening
        shader: `
            vec2 p = 2.0 / u_resolution; vec4 sum = vec4(0.0);
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.;
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.;
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.;
            gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'source'}, output: 'coherence_blur'
      },
      { // 2: Final Composite
        shader: `
            vec4 blur_color = texture2D(u_coherence_blur_tex, v_texCoord);
            float coherence = texture2D(u_coherence_map_tex, v_texCoord).r;
            
            // Suppress chaos by blending in blur where coherence is low
            float suppression_mix = (1.0 - coherence) * u_suppression;
            vec3 calmed_color = mix(color.rgb, blur_color.rgb, suppression_mix);
            
            // Emphasize structure by adding unsharp details where coherence is high
            vec3 sharp_details = calmed_color - blur_color.rgb;
            vec3 final_color = calmed_color + sharp_details * coherence * u_emphasis;

            gl_FragColor = vec4(final_color, color.a);
        `,
        inputs: {'u_texture': 'source', 'u_coherence_map_tex': 'coherence_map', 'u_coherence_blur_tex': 'coherence_blur'}, output: 'final'
      }
    ]
  },
  {
    id: 'deband',
    name: 'Deband',
    category: 'Advanced Engine',
    params: [{ id: 'amount', name: 'Amount', min: 0, max: 0.1, step: 0.001, initialValue: 0.02, unit: '' }],
    passes: [{
        helpers: `float random(vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453); }`,
        shader: `
            float tx = 1.0 / u_resolution.x;
            float ty = 1.0 / u_resolution.y;
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, -ty)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord + vec2(0.0,  ty)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord + vec2(-tx, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2( tx, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float edge = abs(lumE - lumW) + abs(lumS - lumN);
            float smooth_mask = 1.0 - smoothstep(0.0, 0.05, edge);
            float noise = (random(v_texCoord) - 0.5) * u_amount * smooth_mask;
            gl_FragColor = vec4(color.rgb + noise, color.a);
        `,
        inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },
  {
    id: 'frequency-separation',
    name: 'Frequency Separation',
    category: 'Advanced Engine',
    params: [
      { id: 'lowContrast', name: 'Volume', min: 0, max: 2, step: 0.01, initialValue: 1, unit: 'x' },
      { id: 'midEmphasis', name: 'Texture', min: 0, max: 5, step: 0.1, initialValue: 1, unit: 'x' },
      { id: 'highEmphasis', name: 'Details', min: 0, max: 5, step: 0.1, initialValue: 1, unit: 'x' }
    ],
    passes: [
      { // 0: Wide blur
        shader: `vec2 p = 10.0 / u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'fs_wide_blur'
      },
      { // 1: Narrow blur
        shader: `vec2 p = 2.0 / u_resolution; vec4 sum=vec4(0.0); sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,-1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,-1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,0))*4./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,0))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(-1,1))*1./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(0,1))*2./16.; sum+=texture2D(u_texture,v_texCoord+p*vec2(1,1))*1./16.; gl_FragColor=sum;`,
        inputs: {'u_texture': 'source'}, output: 'fs_narrow_blur'
      },
      { // 2: Composite
        shader: `
            vec3 wide = texture2D(u_fs_wide_blur_tex, v_texCoord).rgb;
            vec3 narrow = texture2D(u_fs_narrow_blur_tex, v_texCoord).rgb;
            vec3 low_freq_contrasted = ((wide - 0.5) * u_lowContrast) + 0.5;
            vec3 mid_details = (narrow - wide) * u_midEmphasis;
            vec3 high_details = (color.rgb - narrow) * u_highEmphasis;
            vec3 final_color = low_freq_contrasted + mid_details + high_details;
            gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_fs_wide_blur_tex': 'fs_wide_blur', 'u_fs_narrow_blur_tex': 'fs_narrow_blur'}, output: 'final'
      }
    ]
  },
  {
    id: 'dissociative-denoise',
    name: 'Dissociative Denoise',
    category: 'Advanced Engine',
    params: [
      { id: 'smoothing', name: 'Smoothing', min: 1, max: 20, step: 1, initialValue: 8, unit: 'px' },
      { id: 'details', name: 'Detail Recovery', min: 0, max: 2, step: 0.01, initialValue: 1.0, unit: '' }
    ],
    passes: [
      { // 0: Create the ultra-smooth base layer ("The Surgeon")
        shader: `
          vec4 sum = vec4(0.0);
          vec2 p = u_smoothing / u_resolution;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.;
          gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'source'}, output: 'denoise_base'
      },
      { // 1: Extract the high-frequency detail layer ("The Restorer")
        shader: `
            vec3 base_color = texture2D(u_denoise_base_tex, v_texCoord).rgb;
            vec3 detail = color.rgb - base_color + 0.5;
            gl_FragColor = vec4(detail, 1.0);
        `,
        inputs: {'u_texture': 'source', 'u_denoise_base_tex': 'denoise_base'}, output: 'denoise_details'
      },
      { // 2: Reconstruct the final image
        shader: `
          vec4 base_color = texture2D(u_denoise_base_tex, v_texCoord);
          vec3 details = (texture2D(u_denoise_details_tex, v_texCoord).rgb - 0.5) * u_details;
          gl_FragColor = vec4(clamp(base_color.rgb + details, 0.0, 1.0), base_color.a);
        `,
        inputs: {'u_denoise_base_tex': 'denoise_base', 'u_denoise_details_tex': 'denoise_details'}, output: 'final'
      }
    ]
  },
  {
    id: 'inverse-aberration',
    name: 'Inverse Aberration',
    category: 'Advanced Engine',
    params: [
      { id: 'amount', name: 'Correction', min: 0, max: 0.01, step: 0.0001, initialValue: 0.001, unit: '' }
    ],
    passes: [{
      shader: `
        vec2 p = 1.0 / u_resolution;
        vec3 c0 = texture2D(u_texture, v_texCoord).rgb;
        vec3 c_r = texture2D(u_texture, v_texCoord + p * vec2(1.0, 1.0) * u_amount).rgb;
        vec3 c_g = texture2D(u_texture, v_texCoord + p * vec2(-1.0, 1.0) * u_amount).rgb;
        vec3 c_b = texture2D(u_texture, v_texCoord + p * vec2(0.0, -1.0) * u_amount).rgb;
        float r = c0.r * 1.2 - (c_g.r + c_b.r) * 0.1;
        float g = c0.g * 1.2 - (c_r.g + c_b.g) * 0.1;
        float b = c0.b * 1.2 - (c_r.b + c_g.b) * 0.1;
        gl_FragColor = vec4(r, g, b, color.a);
      `,
      inputs: {'u_texture': 'source'}, output: 'final'
    }]
  },
  {
    id: 'saccadic-path',
    name: 'Saccadic Path',
    category: 'Advanced Engine',
    params: [
      { id: 'emphasis', name: 'Emphasis', min: 0, max: 0.5, step: 0.01, initialValue: 0.2, unit: '' },
      { id: 'deemphasis', name: 'De-emphasis', min: 0, max: 0.5, step: 0.01, initialValue: 0.2, unit: '' }
    ],
    passes: [
      { // 0: Saliency Map Pass
        shader: `
          vec2 p = 1.0 / u_resolution;
          float lumC = dot(texture2D(u_texture, v_texCoord).rgb, vec3(0.299, 0.587, 0.114));
          float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
          float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
          float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
          float Gx = lumE - lumW;
          float Gy = lumS - lumN;
          float edge = sqrt(Gx*Gx + Gy*Gy);
          gl_FragColor = vec4(vec3(smoothstep(0.1, 0.5, edge)), 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'saccadic_saliency'
      },
      { // 1: Composite
        shader: `
          float saliency = texture2D(u_saccadic_saliency_tex, v_texCoord).r;
          
          vec2 poi1 = vec2(0.3, 0.7);
          vec2 poi2 = vec2(0.7, 0.5);
          vec2 poi3 = vec2(0.4, 0.3);
          
          float d1 = smoothstep(0.3, 0.0, distance(v_texCoord, poi1));
          float d2 = smoothstep(0.3, 0.0, distance(v_texCoord, poi2));
          float d3 = smoothstep(0.3, 0.0, distance(v_texCoord, poi3));
          
          float poi_mask = max(max(d1, d2), d3);
          
          float final_mask = pow(poi_mask * saliency, 2.0);
          
          float mod = mix(1.0 - u_deemphasis, 1.0 + u_emphasis, final_mask);
          
          vec3 final_color = ((color.rgb - 0.5) * mod) + 0.5;
          final_color = mix(color.rgb, final_color, final_mask * 0.5 + 0.5); // Blend for subtlety

          gl_FragColor = vec4(final_color, color.a);
        `,
        inputs: {'u_texture': 'source', 'u_saccadic_saliency_tex': 'saccadic_saliency'}, output: 'final'
      }
    ]
  },
  {
    id: 'frequency-sync',
    name: 'Frequency Sync',
    category: 'Advanced Engine',
    params: [
      { id: 'cohesion', name: 'Cohesion', min: 0, max: 2, step: 0.01, initialValue: 0.5, unit: '' },
      { id: 'scale', name: 'Scale', min: 1, max: 10, step: 0.1, initialValue: 3.0, unit: 'px' }
    ],
    passes: [
      { // 0: Blur pass
        shader: `
          vec2 p = u_scale / u_resolution; vec4 sum = vec4(0.0);
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.;
          sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.;
          gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'source'}, output: 'sync_blur'
      },
      { // 1: Composite
        shader: `
            vec3 blur_color = texture2D(u_sync_blur_tex, v_texCoord).rgb;
            vec3 details = color.rgb - blur_color.rgb;
            
            // Calculate local texture density (edge detection)
            vec2 p = 1.0 / u_resolution;
            float lumC = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            float lumN = dot(texture2D(u_texture, v_texCoord + vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumS = dot(texture2D(u_texture, v_texCoord - vec2(0.0, p.y)).rgb, vec3(0.299, 0.587, 0.114));
            float lumW = dot(texture2D(u_texture, v_texCoord - vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float lumE = dot(texture2D(u_texture, v_texCoord + vec2(p.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
            float edge = sqrt(pow(lumE - lumW, 2.0) + pow(lumS - lumN, 2.0));
            
            // Modulate detail based on texture density
            float target_density = 0.2; // The "golden standard" texture level
            float modulation = mix(1.0, target_density / (edge + 0.01), u_cohesion);
            modulation = clamp(modulation, 0.0, 5.0);
            
            vec3 new_details = details * modulation;
            
            // Add procedural texture to flat areas
            float flat_mask = 1.0 - smoothstep(0.0, 0.1, edge);
            float random_noise = (fract(sin(dot(v_texCoord, vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.05;
            vec3 procedural_details = vec3(random_noise) * flat_mask * (2.0 - modulation);

            gl_FragColor = vec4(clamp(blur_color + new_details + procedural_details, 0.0, 1.0), color.a);
        `,
        inputs: {'u_texture': 'source', 'u_sync_blur_tex': 'sync_blur'}, output: 'final'
      }
    ]
  },
  {
    id: 'phase-congruency',
    name: 'Phase Congruency',
    category: 'Advanced Engine',
    params: [
      { id: 'emphasis', name: 'Emphasis', min: 0, max: 5, step: 0.1, initialValue: 1.5, unit: 'x' },
      { id: 'threshold', name: 'Noise Threshold', min: 0, max: 0.2, step: 0.001, initialValue: 0.05, unit: '' },
      { id: 'softness', name: 'Feature Scale', min: 1, max: 10, step: 0.1, initialValue: 2.0, unit: 'px' }
    ],
    passes: [
      { // 0: Gradients (High Frequency)
        helpers: `float luma(vec3 color) { return dot(color, vec3(0.299, 0.587, 0.114)); }`,
        shader: `
            vec2 p = 1.0 / u_resolution;
            float tl = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0, 1.0)).rgb);
            float t  = luma(texture2D(u_texture, v_texCoord + p * vec2( 0.0, 1.0)).rgb);
            float tr = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0, 1.0)).rgb);
            float l  = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0, 0.0)).rgb);
            float r  = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0, 0.0)).rgb);
            float bl = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0,-1.0)).rgb);
            float b  = luma(texture2D(u_texture, v_texCoord + p * vec2( 0.0,-1.0)).rgb);
            float br = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0,-1.0)).rgb);
            float Gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
            float Gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
            gl_FragColor = vec4(Gx * 0.5 + 0.5, Gy * 0.5 + 0.5, 0.0, 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'pc_grad_high'
      },
      { // 1: Low-pass filter (blur)
        shader: `
            vec2 p = u_softness / u_resolution; vec4 sum = vec4(0.0);
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.;
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.;
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.;
            gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'source'}, output: 'pc_lowpass'
      },
      { // 2: Gradients (Low Frequency)
        helpers: `float luma(vec3 color) { return dot(color, vec3(0.299, 0.587, 0.114)); }`,
        shader: `
            vec2 p = 1.0 / u_resolution;
            float tl = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0, 1.0)).rgb);
            float t  = luma(texture2D(u_texture, v_texCoord + p * vec2( 0.0, 1.0)).rgb);
            float tr = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0, 1.0)).rgb);
            float l  = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0, 0.0)).rgb);
            float r  = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0, 0.0)).rgb);
            float bl = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0,-1.0)).rgb);
            float b  = luma(texture2D(u_texture, v_texCoord + p * vec2( 0.0,-1.0)).rgb);
            float br = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0,-1.0)).rgb);
            float Gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
            float Gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
            gl_FragColor = vec4(Gx * 0.5 + 0.5, Gy * 0.5 + 0.5, 0.0, 1.0);
        `,
        inputs: {'u_texture': 'pc_lowpass'}, output: 'pc_grad_low'
      },
      { // 3: Composite
        shader: `
            vec2 grad_h = (texture2D(u_pc_grad_high_tex, v_texCoord).rg - 0.5) * 2.0;
            vec2 grad_l = (texture2D(u_pc_grad_low_tex, v_texCoord).rg - 0.5) * 2.0;
            
            float energy_h = length(grad_h);
            float energy_l = length(grad_l);
            
            float dot_prod = dot(normalize(grad_h + 1e-5), normalize(grad_l + 1e-5));
            float total_energy = energy_h + energy_l;
            float congruency = max(0.0, dot_prod);
            float structure = total_energy * congruency;
            
            structure = smoothstep(u_threshold, u_threshold + 0.1, structure);
            
            vec3 blur_color = texture2D(u_pc_lowpass_tex, v_texCoord).rgb;
            vec3 details = color.rgb - blur_color;
            vec3 final_color = color.rgb + details * u_emphasis * structure;
            
            gl_FragColor = vec4(clamp(final_color, 0.0, 1.0), color.a);
        `,
        inputs: {
          'u_texture': 'source',
          'u_pc_grad_high_tex': 'pc_grad_high',
          'u_pc_grad_low_tex': 'pc_grad_low',
          'u_pc_lowpass_tex': 'pc_lowpass'
        },
        output: 'final'
      }
    ]
  },
  {
    id: 'cinematic-rim-light',
    name: 'Cinematic Rim Light',
    category: 'Advanced Engine',
    params: [
        { id: 'intensity', name: 'Intensity', min: 0, max: 10, step: 0.1, initialValue: 2.0, unit: '' },
        { id: 'power', name: 'Power', min: 1, max: 20, step: 0.1, initialValue: 5.0, unit: '' },
        { id: 'softness', name: 'Softness', min: 1, max: 50, step: 1, initialValue: 10, unit: 'px' },
        { id: 'colorR', name: 'Color R', min: 0, max: 1, step: 0.01, initialValue: 1.0, unit: '' },
        { id: 'colorG', name: 'Color G', min: 0, max: 1, step: 0.01, initialValue: 0.9, unit: '' },
        { id: 'colorB', name: 'Color B', min: 0, max: 1, step: 0.01, initialValue: 0.8, unit: '' }
    ],
    passes: [
      { // 0: Normal Map
        helpers: `float luma(vec3 color) { return dot(color, vec3(0.299, 0.587, 0.114)); }`,
        shader: `
            vec2 p = 1.0 / u_resolution;
            float tl = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0, 1.0)).rgb);
            float t  = luma(texture2D(u_texture, v_texCoord + p * vec2( 0.0, 1.0)).rgb);
            float tr = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0, 1.0)).rgb);
            float l  = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0, 0.0)).rgb);
            float r  = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0, 0.0)).rgb);
            float bl = luma(texture2D(u_texture, v_texCoord + p * vec2(-1.0,-1.0)).rgb);
            float b  = luma(texture2D(u_texture, v_texCoord + p * vec2( 0.0,-1.0)).rgb);
            float br = luma(texture2D(u_texture, v_texCoord + p * vec2( 1.0,-1.0)).rgb);
            float Gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
            float Gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
            vec3 normal = normalize(vec3(Gx, Gy, 0.2));
            gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
        `,
        inputs: {'u_texture': 'source'}, output: 'rim_normals'
      },
      { // 1: Rim Mask
        shader: `
            vec3 normal = texture2D(u_rim_normals_tex, v_texCoord).rgb * 2.0 - 1.0;
            vec3 viewDir = vec3(0.0, 0.0, 1.0);
            float rim_factor = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), u_power) * u_intensity;
            rim_factor = smoothstep(0.0, 1.0, rim_factor);
            gl_FragColor = vec4(vec3(rim_factor), 1.0);
        `,
        inputs: {'u_rim_normals_tex': 'rim_normals'}, output: 'rim_mask'
      },
      { // 2: Blur the mask
        shader: `
            vec2 p = u_softness / u_resolution; vec4 sum = vec4(0.0);
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,-1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,-1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,-1))*1./16.;
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,0))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,0))*4./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,0))*2./16.;
            sum += texture2D(u_texture, v_texCoord + p*vec2(-1,1))*1./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(0,1))*2./16.; sum += texture2D(u_texture, v_texCoord + p*vec2(1,1))*1./16.;
            gl_FragColor = sum;
        `,
        inputs: {'u_texture': 'rim_mask'}, output: 'rim_blur'
      },
      { // 3: Composite
        shader: `
            vec3 glow = texture2D(u_rim_blur_tex, v_texCoord).rgb * vec3(u_colorR, u_colorG, u_colorB);
            vec3 final_color = color.rgb + glow;
            gl_FragColor = vec4(final_color, color.a);
        `,
        inputs: {'u_texture': 'source', 'u_rim_blur_tex': 'rim_blur'}, output: 'final'
      }
    ]
  },
];
