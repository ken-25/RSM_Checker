document.addEventListener('DOMContentLoaded', function () {
    if (!window.THREE) {
        console.error('Three.js が読み込まれていません。');
        return;
    }

    const viewer = document.getElementById('viewer');

    // ========= Three.js 基本セットアップ =========
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(
        45,
        viewer.clientWidth / viewer.clientHeight,
        0.1,
        1000
    );
    // 斜め上から地面(XZ)を見る位置
    camera.position.set(40, 40, 60);
    camera.up.set(0, 1, 0); // Y軸が上 (内部ロジック)

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewer.clientWidth, viewer.clientHeight);
    // Mobile Menu Toggle
    const menuToggle = document.getElementById('menuToggle');
    const ui = document.getElementById('ui');

    // Check if elements exist (robustness)
    if (menuToggle && ui) {
        menuToggle.addEventListener('click', () => {
            ui.classList.toggle('menu-active');
        });

        // Close menu when clicking outside on mobile (optional but good UX)
        // For simplicity, we can let user use the toggle button again,
        // or add a close button inside the UI. For now, Toggle is enough.
    }

    // Raycaster for dynamic measurement
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Mouse move event
    function onMouseMove(event) {
        // Calculate mouse position in normalized device coordinates
        // (-1 to +1) for both components
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    window.addEventListener('mousemove', onMouseMove, false);

    // init
    // init(); // Removed undefined function call
    viewer.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    // 極角制限：なし（自由回転）
    // controls.minPolarAngle = 0.1;
    // controls.maxPolarAngle = Math.PI; // Default is PI
    controls.screenSpacePanning = true; // CADのようなパン操作（画面の上下がワールド座標の移動に直結）
    controls.update();

    // 照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(50, 80, 60);
    scene.add(dirLight);

    // 地面 (Y=0) のグリッド（XZ平面）: three.js デフォルトそのまま
    const gridSize = 100;
    const gridDivisions = 20;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0xdddddd);
    // rotation 不要：XZ平面が地面
    scene.add(gridHelper);

    // 薄い地面の板（任意）
    const groundGeo = new THREE.PlaneGeometry(gridSize, gridSize);
    const groundMat = new THREE.MeshPhongMaterial({
        color: 0xeeeeee,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2; // XZ平面 (法線+Y)
    ground.position.y = 0;
    scene.add(ground);

    // 座標軸 (X:赤, Y:緑, Z:青)
    // User Vertical = Z (Blue), User Depth = Y (Green)
    // Internal Y (Vertical) -> Blue
    // Internal Z (Depth) -> Green
    const axesHelper = new THREE.AxesHelper(20);
    const colorRed = new THREE.Color(0xff0000);   // X
    const colorBlue = new THREE.Color(0x0000ff);  // Y (Internal) -> User Z
    const colorGreen = new THREE.Color(0x00ff00); // Z (Internal) -> User Y
    axesHelper.setColors(colorRed, colorBlue, colorGreen);
    scene.add(axesHelper);

    // ========= オブジェクト（針 & 球） =========
    const pinMaterial = new THREE.MeshPhongMaterial({ color: 0x0077ff });
    const pinTipMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
    const sphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x00aa00,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });

    // 文字ラベル用スプライト生成関数
    function createTextSprite(message) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 64;
        canvas.width = 128; // 適当なサイズ
        canvas.height = 128;

        context.font = `Bold ${fontSize}px Arial`;
        context.fillStyle = "rgba(0,0,0,1)";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(message, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false }); // 最前面に表示したければ depthTest: false, しかし平面上なら true でよい
        // 文字サイズ調整: 小さくする
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(2, 2, 1); // 3D空間でのサイズ (2m x 2m)
        return sprite;
    }

    const pins = [];
    const maxPins = 4;

    for (let i = 0; i < maxPins; i++) {
        // 円柱: デフォルトでY方向に伸びる (中心原点, 高さ1)
        const rodGeom = new THREE.CylinderGeometry(0.1, 0.1, 1, 16);
        const rodMesh = new THREE.Mesh(rodGeom, pinMaterial);
        scene.add(rodMesh);

        // 先端: 小球
        const tipGeom = new THREE.SphereGeometry(0.4, 16, 16);
        const tipMesh = new THREE.Mesh(tipGeom, pinTipMaterial);
        scene.add(tipMesh);

        // 番号ラベル
        const labelSprite = createTextSprite(String(i + 1));
        scene.add(labelSprite);

        pins.push({ rodMesh, tipMesh, labelSprite });
    }

    let sphereMesh;
    function ensureSphereMesh() {
        if (!sphereMesh) {
            const geom = new THREE.SphereGeometry(1, 32, 32);
            sphereMesh = new THREE.Mesh(geom, sphereMaterial);
            scene.add(sphereMesh);
        }
    }




    // ========= UI と同期 =========
    let measureLine = null;
    let measureDot = null;
    let refMarkerMesh = null;
    let centerGroundDot = null;

    // 可視化用のLineとDotを生成
    function ensureMeasureTools() {
        if (!measureLine) {
            const geometry = new THREE.BufferGeometry();
            // 2 points: Cursor (Sphere Surface) -> Ground
            const vertices = new Float32Array([0, 0, 0, 0, 0, 0]);
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
            measureLine = new THREE.Line(geometry, material);
            scene.add(measureLine);
        }
        if (!measureDot) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
            const material = new THREE.PointsMaterial({ color: 0xff00ff, size: 0.5 });
            measureDot = new THREE.Points(geometry, material);
            scene.add(measureDot);
        }
    }

    function getPinParams() {
        const pinsData = [];
        for (let i = 1; i <= maxPins; i++) {
            const enabled = document.getElementById(`pin${i}Enabled`).checked;
            const x = parseFloat(document.getElementById(`pin${i}x`).value);
            const z = parseFloat(document.getElementById(`pin${i}z`).value);
            const y = parseFloat(document.getElementById(`pin${i}y`).value);
            pinsData.push({ enabled, x, z, y });
        }
        return pinsData;
    }

    function updateScene() {
        const statusEl = document.getElementById('status');
        const radiusInfoEl = document.getElementById('radiusInfo');
        const sphereCenterEl = document.getElementById('sphereCenter');

        const distanceEl = document.getElementById('distanceToPlane');
        const distanceCommentEl = document.getElementById('distanceComment');

        let measureLabel = document.getElementById('measureLabel');

        statusEl.textContent = '';
        radiusInfoEl.textContent = '';
        if (sphereCenterEl) sphereCenterEl.textContent = '-';

        distanceEl.textContent = '-';
        distanceCommentEl.textContent = '';

        const radiusCandidate = parseFloat(document.getElementById('radiusSelect').value);
        const pinsData = getPinParams();

        // --- Reference Marker Update ---
        const refEnabled = document.getElementById('refMarkerEnabled').checked;
        if (refEnabled) {
            const rx = parseFloat(document.getElementById('refMarkerX').value);
            const rz = parseFloat(document.getElementById('refMarkerZ').value); // User Y -> Internal Z
            const ry = parseFloat(document.getElementById('refMarkerY').value); // User Z -> Internal Y

            if (!refMarkerMesh) {
                const geom = new THREE.SphereGeometry(0.2, 16, 16);
                const mat = new THREE.MeshPhongMaterial({ color: 0xffaa00 }); // Orange-ish
                refMarkerMesh = new THREE.Mesh(geom, mat);
                scene.add(refMarkerMesh);
            }
            refMarkerMesh.visible = true;
            refMarkerMesh.position.set(rx, ry, rz);
        } else {
            if (refMarkerMesh) refMarkerMesh.visible = false;
        }

        // --- Sphere Center Ground Dot Init ---
        if (!centerGroundDot) {
            const geom = new THREE.CircleGeometry(0.3, 32);
            const mat = new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide }); // Dark Grey
            centerGroundDot = new THREE.Mesh(geom, mat);
            centerGroundDot.rotation.x = -Math.PI / 2; // Face up
            scene.add(centerGroundDot);
        }

        const activeTips = [];

        pinsData.forEach((p, idx) => {
            const pinObj = pins[idx];
            if (!p.enabled) {
                pinObj.rodMesh.visible = false;
                pinObj.tipMesh.visible = false;
                pinObj.labelSprite.visible = false;
                return;
            }

            // 入力: x=横, z=UserY(奥行), y=UserZ(高さ)
            // Three.js (内部): x=x, y=高さ(UserZ), z=奥行(UserY)
            // なので、HTMLのinput id="pin1z" は 内部z (Depth) にマッピングされているが、ラベルは "Y (m)"
            // input id="pin1y" は 内部y (Height) にマッピングされているが、ラベルは "高さZ (m)"
            // したがって、p.x, p.y, p.z はそのまま Three.js の (x, y, z) として扱ってよい。
            // p.z は "pin1z" の値、つまり User Y
            // p.y は "pin1y" の値、つまり User Z
            const tipPos = new THREE.Vector3(p.x, p.y, p.z); // (x, y, z) = (Internal X, Internal Y, Internal Z)
            const height = Math.max(0.01, p.y);

            pinObj.rodMesh.visible = true;
            pinObj.tipMesh.visible = true;

            // 円柱は中心原点・高さ1 → scale.y=高さ, position.y=高さ/2 で地面から伸びる
            pinObj.rodMesh.scale.set(1, height, 1);
            pinObj.rodMesh.position.set(p.x, p.y / 2, p.z);

            pinObj.tipMesh.position.copy(tipPos);

            // ラベル位置: 地面(y=0)付近、ピンの中心から少しずらす
            // ピン半径が0.1なので、0.5くらいずらせば重ならない
            pinObj.labelSprite.visible = true;
            pinObj.labelSprite.position.set(p.x + 0.8, 0.5, p.z + 0.8);

            activeTips.push({ x: p.x, y: p.y, z: p.z });
        });

        ensureSphereMesh();
        ensureMeasureTools(); // 可視化ツール準備

        if (activeTips.length === 0) {
            sphereMesh.visible = false;
            measureLine.visible = false;
            measureDot.visible = false;
            if (centerGroundDot) centerGroundDot.visible = false;
            if (measureLabel) measureLabel.style.display = 'none';
            statusEl.textContent = '針を1本以上有効にしてください。';
            return;
        }

        // ここで固定半径の計算
        const sphere = SphereCalculator.calcSphereFixedRadius(activeTips, radiusCandidate);

        if (!sphere) {
            sphereMesh.visible = false;
            measureLine.visible = false;
            measureDot.visible = false;
            if (centerGroundDot) centerGroundDot.visible = false;
            if (measureLabel) measureLabel.style.display = 'none';
            statusEl.textContent = `選択された配置では半径 ${radiusCandidate} m の球をすべてのピンに通すことはできません（距離過大または配置不整合）。`;
            return;
        }

        const { center, radius } = sphere;
        const bottomY = center.y - radius;

        sphereMesh.visible = true;
        sphereMesh.position.set(center.x, center.y, center.z);
        sphereMesh.geometry.dispose();
        // 見た目をよくするためにセグメントを少し増やす
        sphereMesh.geometry = new THREE.SphereGeometry(radius, 64, 64);

        // Update Center Ground Dot
        if (centerGroundDot) {
            centerGroundDot.visible = true;
            centerGroundDot.position.set(center.x, 0.05, center.z); // Slightly above existing ground (0)
        }

        // --- 可視化ライン更新 (旧ロジック: 静的表示) ---
        // 動的表示に切り替えるため、ここでは初期状態(非表示)にするか、animateで制御する。
        // ここでの更新は削除し、animateでのみ更新する。
        measureLine.visible = false;
        measureDot.visible = false;

        /*
        measureLine.visible = true;
        measureDot.visible = true;
        const positions = measureLine.geometry.attributes.position.array;

        const bottomY = center.y - radius;

        // Center
        positions[0] = center.x;
        positions[1] = center.y;
        positions[2] = center.z;
        // Bottom (Sphere surface)
        positions[3] = center.x;
        positions[4] = bottomY;
        positions[5] = center.z;
        // Ground
        positions[6] = center.x;
        positions[7] = 0;
        positions[8] = center.z;

        measureLine.geometry.attributes.position.needsUpdate = true;

        // Dot at bottom
        measureDot.position.set(center.x, bottomY, center.z);
        measureDot.visible = false; // Hide dot by default, or only show on hover? Let's hide static dot.
        */

        /*
        // --- ラベル更新 (旧ロジック: 静的表示) ---
        if (measureLabel) {
             measureLabel.style.display = 'block';
             // 表示: R, 高さ Dist (Internal Y)
             measureLabel.innerHTML = `半径：R = ${radius} m<br>地面からの高さ：Dist = ${bottomY.toFixed(3)} m`;
             updateLabelPosition();
        }
        */
        // Initial state for label is hidden until hover
        if (measureLabel) {
            measureLabel.style.display = 'none';
        }

        // 情報表示
        radiusInfoEl.textContent = `半径: ${radius} m`;
        statusEl.textContent = '判定: 配置可能 (外接)';
        if (sphereCenterEl) {
            // 表示順序変更: (Internal X, Internal Z, Internal Y) -> (User X, User Y, User Z)
            sphereCenterEl.textContent = `(${center.x.toFixed(3)}, ${center.z.toFixed(3)}, ${center.y.toFixed(3)})`;
        }

        const distanceToPlane = bottomY;

        distanceEl.textContent = distanceToPlane.toFixed(3);

        if (distanceToPlane > 0) {
            distanceCommentEl.textContent = '(浮いています)';
            distanceCommentEl.style.color = "blue";
        } else if (distanceToPlane < 0) {
            distanceCommentEl.textContent = '(めり込んでいます)';
            distanceCommentEl.style.color = "red";
        } else {
            distanceCommentEl.textContent = '(接しています)';
            distanceCommentEl.style.color = "green";
        }
    }

    // document.getElementById('updateBtn').addEventListener('click', updateScene);
    document.getElementById('radiusSelect').addEventListener('change', updateScene);
    Array.from(document.querySelectorAll('input[type="number"], input[type="checkbox"]'))
        .forEach(el => el.addEventListener('change', updateScene));

    // 初期描画
    updateScene();

    function updateLabelPosition() {
        // Deprecated: Logic moved to animate loop with raycasting
    }

    // レンダリングループ
    function animate() {
        requestAnimationFrame(animate);
        controls.update();

        // Raycasting
        if (sphereMesh && sphereMesh.visible) {
            raycaster.setFromCamera(mouse, camera);

            // Raycast to Ground Plane (y=0)
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            const hit = raycaster.ray.intersectPlane(groundPlane, intersectPoint);

            const measureLabel = document.getElementById('measureLabel');
            let showMeasurement = false;

            if (hit) {
                const center = sphereMesh.position;
                const dx = intersectPoint.x - center.x;
                const dz = intersectPoint.z - center.z;
                const distSq = dx * dx + dz * dz;
                const radius = sphereMesh.geometry.parameters.radius;

                if (distSq < radius * radius) {
                    showMeasurement = true;
                    // Calculate sphere bottom height at this XZ position
                    const dy = Math.sqrt(radius * radius - distSq);
                    const sphereBottomY = center.y - dy;

                    // Display Height
                    measureLabel.innerHTML = `地面からの高さ：Dist = ${sphereBottomY.toFixed(3)} m`;
                    measureLabel.style.display = 'block';

                    // Position label near the SPHERE BOTTOM point
                    const targetPoint = new THREE.Vector3(intersectPoint.x, sphereBottomY, intersectPoint.z);
                    const vec = targetPoint.clone();
                    vec.project(camera);

                    const w = viewer.clientWidth;
                    const h = viewer.clientHeight;
                    const rect = viewer.getBoundingClientRect();

                    const x = (vec.x + 1) / 2 * w + rect.left;
                    const y = -(vec.y - 1) / 2 * h + rect.top;

                    measureLabel.style.left = `${x + 15}px`;
                    measureLabel.style.top = `${y - 15}px`;

                    // --- Update Line & Dot ---
                    if (measureLine) {
                        measureLine.visible = true;
                        const positions = measureLine.geometry.attributes.position.array;
                        // Point 1: Sphere Bottom
                        positions[0] = targetPoint.x;
                        positions[1] = targetPoint.y;
                        positions[2] = targetPoint.z;
                        // Point 2: Ground
                        positions[3] = targetPoint.x;
                        positions[4] = 0;
                        positions[5] = targetPoint.z;
                        measureLine.geometry.attributes.position.needsUpdate = true;
                    }
                    if (measureDot) {
                        measureDot.visible = true;
                        measureDot.position.copy(targetPoint);
                    }
                }
            }

            if (!showMeasurement) {
                if (measureLabel) {
                    measureLabel.style.display = 'none';
                }
                if (measureLine) measureLine.visible = false;
                if (measureDot) measureDot.visible = false;
            }
        }

        renderer.render(scene, camera);
        // updateLabelPosition(); // logic moved inside
    }
    animate();

    // リサイズ対応
    window.addEventListener('resize', () => {
        const w = viewer.clientWidth;
        const h = viewer.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });
});