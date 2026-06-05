import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Quality, detectQuality } from '../utils/constants';

// ─── Custom Vignette Shader ───
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDarkness: { value: 1.2 },
    uOffset: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uDarkness;
    uniform float uOffset;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float vig = 1.0 - dot(uv * uOffset * 0.5, uv * uOffset * 0.5);
      vig = clamp(vig, 0.0, 1.0);
      float factor = mix(1.0 - uDarkness, 1.0, vig);
      color.rgb *= max(0.0, factor);
      color.rgb = max(vec3(0.0), color.rgb);
      gl_FragColor = color;
    }
  `,
};

// ─── Custom Chromatic Aberration Shader ───
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    uOffset: { value: 0.001 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      float r = texture2D(tDiffuse, vUv + dir * uOffset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir * uOffset).b;
      float a = texture2D(tDiffuse, vUv).a;
      gl_FragColor = vec4(r, g, b, a);
    }
  `,
};

// ─── Custom Film Grain Shader ───
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0.0 },
    uAmount: { value: 0.03 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    varying vec2 vUv;
    
    float random(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float noise = random(vUv + uTime) * uAmount;
      color.rgb += noise - uAmount * 0.5;
      color.rgb = max(vec3(0.0), color.rgb);
      gl_FragColor = color;
    }
  `,
};

export class Renderer {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public composer: EffectComposer;
  public quality: Quality;
  
  private bloomPass: UnrealBloomPass;
  private chromaticPass: ShaderPass;
  private filmGrainPass: ShaderPass | null = null;
  private vignettePass: ShaderPass;
  private container: HTMLElement;
  private resizeTimeout: number = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.quality = detectQuality();

    // ─── Renderer ───
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality >= Quality.MEDIUM,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x050510);
    this.renderer.shadowMap.enabled = this.quality >= Quality.HIGH;
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    // ─── Scene ───
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050510, 0.0003);

    // ─── Camera (perspective, tilted top-down) ───
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      10,
      5000
    );
    // Position above, looking down at an angle
    this.camera.position.set(0, 800, 500);
    this.camera.lookAt(0, 0, 0);

    // ─── Lighting ───
    const ambient = new THREE.AmbientLight(0x222233, 0.6);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(200, 500, 300);
    if (this.quality >= Quality.HIGH) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 10;
      dirLight.shadow.camera.far = 1500;
      dirLight.shadow.camera.left = -600;
      dirLight.shadow.camera.right = 600;
      dirLight.shadow.camera.top = 600;
      dirLight.shadow.camera.bottom = -600;
    }
    this.scene.add(dirLight);

    // ─── Post Processing ───
    const bloomResolution = this.quality === Quality.LOW
      ? new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2)
      : new THREE.Vector2(window.innerWidth, window.innerHeight);
    
    this.composer = new EffectComposer(this.renderer);
    
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.bloomPass = new UnrealBloomPass(
      bloomResolution,
      this.quality === Quality.LOW ? 0.8 : 1.2,
      0.4,
      0.2
    );
    this.composer.addPass(this.bloomPass);

    // Chromatic aberration
    this.chromaticPass = new ShaderPass(ChromaticAberrationShader);
    this.chromaticPass.uniforms.uOffset.value = 0.001;
    this.composer.addPass(this.chromaticPass);

    // Film grain (desktop only)
    if (this.quality >= Quality.MEDIUM) {
      this.filmGrainPass = new ShaderPass(FilmGrainShader);
      this.composer.addPass(this.filmGrainPass);
    }

    // Vignette
    this.vignettePass = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignettePass);

    // ─── Resize ───
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private onResize(): void {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = window.setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    }, 100);
  }

  setChromaticAberration(amount: number): void {
    this.chromaticPass.uniforms.uOffset.value = amount;
  }

  render(time: number): void {
    if (this.filmGrainPass) {
      this.filmGrainPass.uniforms.uTime.value = time;
    }
    this.composer.render();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    this.renderer.dispose();
  }
}
