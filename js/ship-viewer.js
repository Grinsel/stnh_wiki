/**
 * 3D Ship Model Viewer (IIFE).
 * Lazy-loads Three.js + GLTFLoader + OrbitControls from CDN on demand.
 * Renders GLB models in a WebGL canvas with orbit controls.
 */
const ShipViewer = (() => {
    const THREE_VERSION = '0.172.0';
    const CDN_BASE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

    let _loaded = false;
    let _loading = false;
    let _loadCallbacks = [];

    // Active viewer state
    let _renderer = null;
    let _scene = null;
    let _camera = null;
    let _controls = null;
    let _animFrameId = null;
    let _container = null;

    /**
     * Lazy-load Three.js + addons from CDN via import map + dynamic import.
     */
    function _ensureThreeJS() {
        if (_loaded) return Promise.resolve();
        if (_loading) {
            return new Promise(resolve => _loadCallbacks.push(resolve));
        }
        _loading = true;

        return new Promise((resolve, reject) => {
            _loadCallbacks.push(resolve);

            // Inject import map so ES module imports of 'three' resolve
            const importMap = document.createElement('script');
            importMap.type = 'importmap';
            importMap.textContent = JSON.stringify({
                imports: {
                    'three': `${CDN_BASE}/build/three.module.js`,
                    'three/addons/': `${CDN_BASE}/examples/jsm/`,
                }
            });
            document.head.appendChild(importMap);

            // Use an inline ES module to import everything
            const loader = document.createElement('script');
            loader.type = 'module';
            loader.textContent = `
                import * as THREE from 'three';
                import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
                import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
                window.THREE = THREE;
                window.__THREE_ADDONS = { GLTFLoader, OrbitControls };
                window.dispatchEvent(new Event('three-ready'));
            `;
            window.addEventListener('three-ready', () => {
                _loaded = true;
                _loading = false;
                _loadCallbacks.forEach(cb => cb());
                _loadCallbacks = [];
            }, { once: true });
            loader.onerror = () => {
                _loading = false;
                reject(new Error('Failed to load Three.js'));
            };
            document.head.appendChild(loader);
        });
    }

    /**
     * Create a 3D viewer in the given container, loading the GLB model.
     * @param {HTMLElement} container - The DOM element to render into
     * @param {string} glbPath - Path to the .glb file
     */
    async function createViewer(container, glbPath) {
        dispose(); // Clean up any previous viewer

        _container = container;
        const loadingText = (typeof I18n !== 'undefined') ? I18n.ui('ui.loading.generic') : 'Loading...';
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted,#999);font-size:0.8rem;">' + loadingText + '</div>';

        try {
            await _ensureThreeJS();
        } catch (e) {
            const errText = (typeof I18n !== 'undefined') ? I18n.ui('ui.error.model_load_failed') : 'Could not load 3D model';
            container.innerHTML = '<div style="padding:1rem;color:#f44;">' + errText + '</div>';
            return;
        }

        const THREE = window.THREE;
        const { GLTFLoader, OrbitControls } = window.__THREE_ADDONS;

        const width = container.clientWidth;
        const height = 300;

        // Scene
        _scene = new THREE.Scene();

        // Camera
        _camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

        // Renderer
        _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        _renderer.setSize(width, height);
        _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        _renderer.setClearColor(0x000000, 0);

        container.innerHTML = '';
        container.appendChild(_renderer.domElement);

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        _scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(5, 10, 7);
        _scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        backLight.position.set(-5, -3, -5);
        _scene.add(backLight);

        // Controls
        _controls = new OrbitControls(_camera, _renderer.domElement);
        _controls.enableDamping = true;
        _controls.dampingFactor = 0.1;
        _controls.autoRotate = true;
        _controls.autoRotateSpeed = 1.0;

        // Load GLB model
        const loader = new GLTFLoader();
        try {
            const gltf = await new Promise((resolve, reject) => {
                loader.load(glbPath, resolve, undefined, reject);
            });

            _scene.add(gltf.scene);

            // Auto-center and auto-scale to fit view
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Center the model
            gltf.scene.position.sub(center);

            // Position camera to frame the model
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = _camera.fov * (Math.PI / 180);
            const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.5;
            _camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7);
            _camera.lookAt(0, 0, 0);
            _controls.target.set(0, 0, 0);
            _camera.near = distance * 0.01;
            _camera.far = distance * 100;
            _camera.updateProjectionMatrix();

        } catch (e) {
            const errText = (typeof I18n !== 'undefined') ? I18n.ui('ui.error.model_load_failed') : 'Could not load 3D model';
            container.innerHTML = '<div style="padding:1rem;color:#f44;">' + errText + '</div>';
            return;
        }

        // Animation loop
        function animate() {
            _animFrameId = requestAnimationFrame(animate);
            if (_controls) _controls.update();
            if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
        }
        animate();

        // Handle resize
        const resizeObserver = new ResizeObserver(entries => {
            if (!_renderer) return;
            const entry = entries[0];
            const w = entry.contentRect.width;
            if (w > 0) {
                _renderer.setSize(w, 300);
                _camera.aspect = w / 300;
                _camera.updateProjectionMatrix();
            }
        });
        resizeObserver.observe(container);
        container._resizeObserver = resizeObserver;
    }

    /**
     * Dispose the current viewer, freeing WebGL resources.
     */
    function dispose() {
        if (_animFrameId) {
            cancelAnimationFrame(_animFrameId);
            _animFrameId = null;
        }
        if (_controls) {
            _controls.dispose();
            _controls = null;
        }
        if (_renderer) {
            _renderer.dispose();
            _renderer = null;
        }
        if (_scene) {
            _scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => {
                            if (m.map) m.map.dispose();
                            m.dispose();
                        });
                    } else {
                        if (obj.material.map) obj.material.map.dispose();
                        obj.material.dispose();
                    }
                }
            });
            _scene = null;
        }
        if (_container && _container._resizeObserver) {
            _container._resizeObserver.disconnect();
            delete _container._resizeObserver;
        }
        _camera = null;
        _container = null;
    }

    return { createViewer, dispose };
})();
