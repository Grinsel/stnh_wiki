/**
 * 3D Ship Model Viewer (IIFE).
 * Lazy-loads Three.js + GLTFLoader + OrbitControls from CDN on demand.
 * Renders GLB models in a WebGL canvas with orbit controls.
 */
const ShipViewer = (() => {
    const THREE_VERSION = '0.172.0';
    const CDN_BASE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

    let _loaded = false;
    let _threePromise = null;
    const THREE_LOAD_TIMEOUT_MS = 15000;

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
        if (_threePromise) return _threePromise;

        _threePromise = new Promise((resolve, reject) => {
            let settled = false;
            let importMap = null;
            let loader = null;
            let timeoutId = null;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                window.removeEventListener('three-ready', onReady);
            };
            // On failure, reset so a later createViewer() can retry cleanly,
            // and remove the injected nodes we added.
            const fail = (err) => {
                if (settled) return;
                settled = true;
                cleanup();
                _threePromise = null;
                if (importMap && importMap.parentNode) importMap.parentNode.removeChild(importMap);
                if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
                reject(err);
            };
            const onReady = () => {
                if (settled) return;
                settled = true;
                cleanup();
                _loaded = true;
                resolve();
            };

            // Timeout catches the case where the script tag loads but an
            // import throws at runtime (CDN/import-map mismatch): three-ready
            // then never fires and every queued viewer would hang forever.
            timeoutId = setTimeout(
                () => fail(new Error('Three.js load timed out')),
                THREE_LOAD_TIMEOUT_MS
            );

            window.addEventListener('three-ready', onReady, { once: true });

            // Inject import map so ES module imports of 'three' resolve
            importMap = document.createElement('script');
            importMap.type = 'importmap';
            importMap.textContent = JSON.stringify({
                imports: {
                    'three': `${CDN_BASE}/build/three.module.js`,
                    'three/addons/': `${CDN_BASE}/examples/jsm/`,
                }
            });
            document.head.appendChild(importMap);

            // Use an inline ES module to import everything
            loader = document.createElement('script');
            loader.type = 'module';
            loader.textContent = `
                import * as THREE from 'three';
                import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
                import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
                window.THREE = THREE;
                window.__THREE_ADDONS = { GLTFLoader, OrbitControls };
                window.dispatchEvent(new Event('three-ready'));
            `;
            loader.onerror = () => fail(new Error('Failed to load Three.js'));
            document.head.appendChild(loader);
        });

        return _threePromise;
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

            // Hide collision meshes (invisible in-game click hitboxes)
            gltf.scene.traverse(obj => {
                if (obj.isMesh && obj.name && obj.name.toLowerCase().includes('collis')) {
                    obj.visible = false;
                }
            });

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
    // Texture slots a GLTF PBR material may carry — all are GPU allocations
    // that leak if only material.map is disposed.
    const _TEXTURE_SLOTS = [
        'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap',
        'aoMap', 'specularMap', 'envMap', 'alphaMap', 'bumpMap',
        'displacementMap', 'lightMap',
    ];

    function _disposeMaterial(m) {
        if (!m) return;
        for (const slot of _TEXTURE_SLOTS) {
            if (m[slot] && typeof m[slot].dispose === 'function') {
                m[slot].dispose();
            }
        }
        m.dispose();
    }

    function dispose() {
        if (_animFrameId) {
            cancelAnimationFrame(_animFrameId);
            _animFrameId = null;
        }
        if (_controls) {
            _controls.dispose();
            _controls = null;
        }
        if (_scene) {
            _scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(_disposeMaterial);
                    } else {
                        _disposeMaterial(obj.material);
                    }
                }
            });
            _scene = null;
        }
        if (_renderer) {
            // Free the WebGL context explicitly and detach the canvas.
            // Without forceContextLoss() the context lingers until GC, and
            // browsers cap live contexts (~16 in Chrome) — repeated ship/faction
            // switches would exhaust the pool and the viewer would go black.
            _renderer.forceContextLoss();
            _renderer.dispose();
            if (_renderer.domElement && _renderer.domElement.parentNode) {
                _renderer.domElement.parentNode.removeChild(_renderer.domElement);
            }
            _renderer = null;
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
