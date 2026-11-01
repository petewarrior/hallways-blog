AFRAME.registerComponent('doorway-fog', {
    schema: {
        width: { type: 'number', default: 2.1 },
        height: { type: 'number', default: 2.8 }
    },

    init() {
        const geometry = new THREE.PlaneGeometry(this.data.width, this.data.height);
        const material = new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 } },
            vertexShader: `
                varying vec2 vUv;

                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                varying vec2 vUv;

                float hash(vec2 point) {
                    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
                }

                float noise(vec2 point) {
                    vec2 cell = floor(point);
                    vec2 blend = fract(point);
                    blend = blend * blend * (3.0 - 2.0 * blend);
                    return mix(
                        mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
                        mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x),
                        blend.y
                    );
                }

                void main() {
                    vec2 uv = vUv;
                    vec2 drift = vec2(time * 0.012, sin(time * 0.16) * 0.08);
                    float clouds = noise(uv * vec2(5.0, 3.5) + drift);
                    clouds = clouds * 0.65 + noise(uv * vec2(10.0, 7.0) - drift * 1.4) * 0.35;
                    float haze = smoothstep(0.34, 0.78, clouds);
                    float edges = smoothstep(0.0, 0.16, uv.x) * smoothstep(0.0, 0.16, 1.0 - uv.x);
                    edges *= smoothstep(0.0, 0.12, uv.y) * smoothstep(0.0, 0.12, 1.0 - uv.y);
                    float alpha = haze * edges * 0.82;
                    gl_FragColor = vec4(vec3(0.78, 0.78, 0.75), alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.el.setObject3D('mesh', new THREE.Mesh(geometry, material));
    },

    tick(time) {
        const mesh = this.el.getObject3D('mesh');
        if (mesh) mesh.material.uniforms.time.value = time / 1000;
    },

    remove() {
        const mesh = this.el.getObject3D('mesh');
        if (!mesh) return;
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.el.removeObject3D('mesh');
    }
});

class RoomGenerator {
    constructor(options) {
        this.lobbyContainer = options.lobbyContainer || document.getElementById('lobby-container');
        this.categoryLobbyContainer = options.categoryLobbyContainer || document.getElementById('category-lobby-container');
        this.roomContainer = options.roomContainer || document.getElementById('room-container');
        this.canvasPlane = null;
        this.doorways = [];
        this.boundaries = [];
    }

    createLobby(posts = [], container = this.lobbyContainer, options = {}) {
        this.clearLobby(container);
        if (container === this.lobbyContainer) this.clearReadingRoom();
        container.setAttribute('visible', 'true');

        const sides = Math.max(3, posts.length + Number(Boolean(options.entrance)));
        const radius = Math.max(8, 5.5 / (2 * Math.sin(Math.PI / sides)));
        const edgeLength = 2 * radius * Math.sin(Math.PI / sides);
        const apothem = radius * Math.cos(Math.PI / sides);
        this.lobbyApothem = apothem;
        const doorWidth = 2.2;

        const floor = document.createElement('a-cylinder');
        floor.setAttribute('position', '0 0 0');
        floor.setAttribute('radius', options.entrance ? apothem : radius + 1);
        floor.setAttribute('height', '0.12');
        floor.setAttribute('color', '#C9C8C2');
        floor.setAttribute('segments-radial', '64');
        container.appendChild(floor);

        this.doorways = [];
        this.boundaries = [];
        if (!posts.length) {
            const emptyState = document.createElement('a-text');
            emptyState.setAttribute('value', 'NO POSTS YET');
            emptyState.setAttribute('position', '0 2.2 -3');
            emptyState.setAttribute('align', 'center');
            emptyState.setAttribute('width', '4');
            emptyState.setAttribute('color', '#555');
            container.appendChild(emptyState);
            return this.doorways;
        }

        let entranceSide = options.entranceSide;
        if (options.entrance && entranceSide === undefined) {
            entranceSide = 0;
            for (let side = 1; side < sides; side++) {
                const normalZ = Math.sin(-Math.PI / 2 + side * Math.PI * 2 / sides);
                const entranceNormalZ = Math.sin(-Math.PI / 2 + entranceSide * Math.PI * 2 / sides);
                if (normalZ > entranceNormalZ) entranceSide = side;
            }
        }

        for (let side = 0; side < sides; side++) {
            const theta = -Math.PI / 2 + (side * Math.PI * 2) / sides;
            const normalX = Math.cos(theta);
            const normalZ = Math.sin(theta);
            const tangentX = -normalZ;
            const tangentZ = normalX;
            const centerX = normalX * apothem;
            const centerZ = normalZ * apothem;
            const yaw = -theta - Math.PI / 2;
            const isEntrance = options.entrance && side === entranceSide;
            const postIndex = options.entrance && side > entranceSide ? side - 1 : side;
            const destination = isEntrance ? options.entranceDestination : posts[postIndex];
            const hasOpening = Boolean(destination || isEntrance);
            const openingWidth = hasOpening ? doorWidth : 0;
            const segmentWidth = (edgeLength - openingWidth) / 2;

            this.boundaries.push({
                x: centerX,
                z: centerZ,
                normalX,
                normalZ,
                tangentX,
                tangentZ,
                apothem,
                width: openingWidth
            });

            for (const direction of (hasOpening ? [-1, 1] : [0])) {
                const width = hasOpening ? segmentWidth : edgeLength;
                const offset = hasOpening ? direction * (doorWidth / 2 + segmentWidth / 2) : 0;
                const wall = document.createElement('a-box');
                wall.setAttribute('position', `${centerX + tangentX * offset} 2 ${centerZ + tangentZ * offset}`);
                wall.setAttribute('rotation', `0 ${yaw * 180 / Math.PI} 0`);
                wall.setAttribute('width', width);
                wall.setAttribute('height', '4');
                wall.setAttribute('depth', '0.28');
                wall.setAttribute('color', '#85867F');
                container.appendChild(wall);
            }

            if (!destination) continue;
            this.createDoorwayFrame(destination, centerX, centerZ, normalX, normalZ, yaw, doorWidth, container);
            this.doorways.push({
                post: destination,
                x: centerX,
                z: centerZ,
                normalX,
                normalZ,
                tangentX,
                tangentZ,
                apothem,
                width: doorWidth,
                rotationY: yaw * 180 / Math.PI
            });
        }

        return this.doorways;
    }

    getWorldLobby(container, doorways, boundaries) {
        container.object3D.updateMatrixWorld(true);
        const rotation = container.object3D.getWorldQuaternion(new THREE.Quaternion());
        const yaw = new THREE.Euler().setFromQuaternion(rotation, 'YXZ').y;
        const transformPoint = (x, z) => container.object3D.localToWorld(new THREE.Vector3(x, 0, z));
        const transformDirection = (x, z) => new THREE.Vector3(x, 0, z).applyQuaternion(rotation);
        return {
            doorways: doorways.map(doorway => {
                const point = transformPoint(doorway.x, doorway.z);
                const normal = transformDirection(doorway.normalX, doorway.normalZ);
                const tangent = transformDirection(doorway.tangentX, doorway.tangentZ);
                return {
                    ...doorway,
                    x: point.x,
                    z: point.z,
                    normalX: normal.x,
                    normalZ: normal.z,
                    tangentX: tangent.x,
                    tangentZ: tangent.z,
                    rotationY: doorway.rotationY + yaw * 180 / Math.PI
                };
            }),
            boundaries: boundaries.map(boundary => {
                const point = transformPoint(boundary.x, boundary.z);
                const normal = transformDirection(boundary.normalX, boundary.normalZ);
                const tangent = transformDirection(boundary.tangentX, boundary.tangentZ);
                return {
                    ...boundary,
                    x: point.x,
                    z: point.z,
                    normalX: normal.x,
                    normalZ: normal.z,
                    tangentX: tangent.x,
                    tangentZ: tangent.z
                };
            })
        };
    }

    createDoorwayFrame(destination, x, z, normalX, normalZ, yaw, width, container) {
        const frame = document.createElement('a-entity');
        frame.setAttribute('position', `${x} 0 ${z}`);
        frame.setAttribute('rotation', `0 ${yaw * 180 / Math.PI} 0`);

        for (const direction of [-1, 1]) {
            const jamb = document.createElement('a-box');
            jamb.setAttribute('position', `${direction * (width / 2 - 0.08)} 1.45 0`);
            jamb.setAttribute('width', '0.16');
            jamb.setAttribute('height', '2.9');
            jamb.setAttribute('depth', '0.24');
            jamb.setAttribute('color', '#745A43');
            frame.appendChild(jamb);
        }

        const lintel = document.createElement('a-box');
        lintel.setAttribute('position', '0 2.98 0');
        lintel.setAttribute('width', width);
        lintel.setAttribute('height', '0.16');
        lintel.setAttribute('depth', '0.24');
        lintel.setAttribute('color', '#745A43');
        frame.appendChild(lintel);

        const fog = document.createElement('a-entity');
        fog.setAttribute('doorway-fog', `width: ${width - 0.12}; height: 2.75`);
        fog.setAttribute('position', '0 1.5 -0.16');
        // frame.appendChild(fog);

        container.appendChild(frame);

        const title = document.createElement('a-text');
        const label = destination.title || destination.name || 'Untitled';
        title.setAttribute('value', label.length > 34 ? `${label.slice(0, 33)}...` : label);
        title.setAttribute('position', `${x - normalX * 0.2} 3.35 ${z - normalZ * 0.2}`);
        title.setAttribute('rotation', `0 ${yaw * 180 / Math.PI} 0`);
        title.setAttribute('align', 'center');
        title.setAttribute('width', '4.5');
        title.setAttribute('color', '#30312E');
        container.appendChild(title);

        const titleBoard = document.createElement('a-plane');
        title.appendChild(titleBoard);
        titleBoard.setAttribute('position', '0 0 -0.01');
        titleBoard.setAttribute('width', '4.55');
        titleBoard.setAttribute('height', '0.6');
        titleBoard.setAttribute('color', '#ddd');
        
    }

    setLobbyVisible(visible) {
        this.lobbyContainer.setAttribute('visible', visible);
        this.roomContainer.parentElement.setAttribute('visible', !visible);
    }

    createReadingRoom(post, corridorEnd, imagePanels = []) {
        this.clearReadingRoom();
        this.roomContainer.setAttribute('visible', 'true');
        const width = 16;
        const depth = 12;
        const imageRows = Math.ceil(imagePanels.length / 2);
        const height = Math.max(8, imageRows * 2.15 + 2.4);
        const centerZ = corridorEnd - depth / 2;
        const backWallZ = corridorEnd - depth;
        const addBox = (position, dimensions, color) => {
            const box = document.createElement('a-box');
            box.setAttribute('position', position);
            box.setAttribute('width', dimensions[0]);
            box.setAttribute('height', dimensions[1]);
            box.setAttribute('depth', dimensions[2]);
            box.setAttribute('color', color);
            this.roomContainer.appendChild(box);
        };

        addBox(`0 0.05 ${centerZ}`, [width, 0.1, depth], '#D4D1C8');
        addBox(`0 ${height - 0.05} ${centerZ}`, [width, 0.1, depth], '#D9D8D1');
        addBox(`${-width / 2 + 0.05} ${height / 2} ${centerZ}`, [0.1, height, depth], '#85867F');
        addBox(`${width / 2 - 0.05} ${height / 2} ${centerZ}`, [0.1, height, depth], '#85867F');
        addBox(`0 ${height / 2} ${backWallZ}`, [width, height, 0.12], '#85867F');

        const doorwayWidth = 2.2;
        const frontWallWidth = (width - doorwayWidth) / 2;
        const frontWallOffset = doorwayWidth / 2 + frontWallWidth / 2;
        const doorwayHeight = 2.9;
        const lintelHeight = height - doorwayHeight;
        addBox(`${-frontWallOffset} ${height / 2} ${corridorEnd}`, [frontWallWidth, height, 0.12], '#85867F');
        addBox(`${frontWallOffset} ${height / 2} ${corridorEnd}`, [frontWallWidth, height, 0.12], '#85867F');
        addBox(`0 ${doorwayHeight + lintelHeight / 2} ${corridorEnd}`, [doorwayWidth, lintelHeight, 0.12], '#85867F');

        const textY = Math.min(3.8, height * 0.48);
        this.canvasPlane = document.createElement('a-plane');
        this.canvasPlane.setAttribute('position', `0 ${textY} ${backWallZ + 0.08}`);
        this.canvasPlane.setAttribute('width', '5.4');
        this.canvasPlane.setAttribute('height', '3.6');
        this.canvasPlane.setAttribute('material', 'shader: flat; src: #post-canvas; side: double');
        this.roomContainer.appendChild(this.canvasPlane);

        const scrollbar = document.createElement('a-entity');
        scrollbar.setAttribute('position', `2.88 ${textY} ${backWallZ + 0.16}`);
        scrollbar.setAttribute('post-scrollbar', 'range: 0.92');

        const track = document.createElement('a-box');
        track.classList.add('post-scrollbar-track', 'scrollable');
        track.setAttribute('position', '0 0 0');
        track.setAttribute('width', '0.08');
        track.setAttribute('height', '3.2');
        track.setAttribute('depth', '0.04');
        track.setAttribute('color', '#77796F');
        scrollbar.appendChild(track);

        const thumb = document.createElement('a-box');
        thumb.classList.add('post-scrollbar-thumb', 'scrollable');
        thumb.setAttribute('position', '0 1.48 0.07');
        thumb.setAttribute('width', '0.26');
        thumb.setAttribute('height', '0.2');
        thumb.setAttribute('depth', '0.12');
        thumb.setAttribute('color', '#B35C3A');
        scrollbar.appendChild(thumb);
        this.roomContainer.appendChild(scrollbar);

        const rowCount = Math.max(1, imageRows);
        const verticalSpace = height - 2.4;
        const rowStep = verticalSpace / rowCount;
        const maxPanelHeight = Math.min(1.9, rowStep * 0.72);
        const obstacles = [];
        imagePanels.forEach((image, index) => {
            const side = index % 2 === 0 ? -1 : 1;
            const row = Math.floor(index / 2);
            const x = side * 5.45;
            const y = height - 1.2 - rowStep * (row + 0.5);
            const z = backWallZ + 1.1;
            const imageAvailable = image.available === true;
            const aspect = imageAvailable && Number.isFinite(image.aspect) && image.aspect > 0 ? image.aspect : 1.5;
            const panelHeight = Math.min(maxPanelHeight, 4.8 / aspect);
            const panelWidth = panelHeight * aspect;
            obstacles.push({
                x,
                z,
                halfWidth: panelWidth / 2,
                halfDepth: 0.2
            });

            const floatingPanel = document.createElement('a-entity');
            floatingPanel.setAttribute('position', `${x} ${y} ${z}`);
            floatingPanel.setAttribute('animation__float', `property: position; to: ${x} ${y + 0.12} ${z}; dir: alternate; dur: ${2600 + (index % 3) * 350}; easing: easeInOutSine; loop: true; delay: ${index * 120}`);

            const backing = document.createElement('a-plane');
            backing.setAttribute('position', '0 0 -0.04');
            backing.setAttribute('width', panelWidth + 0.14);
            backing.setAttribute('height', panelHeight + 0.14);
            backing.setAttribute('color', '#D9D8D1');
            floatingPanel.appendChild(backing);

            if (imageAvailable) {
                const plane = document.createElement('a-image');
                plane.setAttribute('src', image.url);
                plane.setAttribute('position', '0 0 0');
                plane.setAttribute('width', panelWidth);
                plane.setAttribute('height', panelHeight);
                floatingPanel.appendChild(plane);
            } else {
                const placeholder = document.createElement('a-plane');
                placeholder.setAttribute('position', '0 0 0');
                placeholder.setAttribute('width', panelWidth);
                placeholder.setAttribute('height', panelHeight);
                placeholder.setAttribute('color', '#E4E0D6');
                floatingPanel.appendChild(placeholder);

                const unavailable = document.createElement('a-text');
                unavailable.setAttribute('value', 'IMAGE UNAVAILABLE');
                unavailable.setAttribute('position', '0 0 0.02');
                unavailable.setAttribute('align', 'center');
                unavailable.setAttribute('width', `${panelWidth - 0.2}`);
                unavailable.setAttribute('color', '#66685F');
                floatingPanel.appendChild(unavailable);
            }

            const caption = document.createElement('a-text');
            const captionText = image.alt || `Image ${index + 1}`;
            caption.setAttribute('value', captionText.length > 42 ? `${captionText.slice(0, 39)}...` : captionText);
            caption.setAttribute('position', `0 ${-panelHeight / 2 - 0.2} 0.02`);
            caption.setAttribute('align', 'center');
            caption.setAttribute('width', `${panelWidth + 0.3}`);
            caption.setAttribute('color', '#30312E');
            floatingPanel.appendChild(caption);
            this.roomContainer.appendChild(floatingPanel);
        });

        this.readingRoomBounds = {
            width,
            depth,
            frontZ: corridorEnd,
            backZ: backWallZ,
            doorwayWidth,
            obstacles
        };
        return this.readingRoomBounds;
    }

    async waitForEntities(container) {
        const entities = Array.from(container.querySelectorAll('*'));
        await Promise.all(entities.map(entity => {
            if (entity.hasLoaded) return Promise.resolve();
            return new Promise(resolve => entity.addEventListener('loaded', resolve, { once: true }));
        }));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    refreshCanvasTexture() {
        const material = this.canvasPlane?.components?.material?.material;
        if (material?.map) material.map.needsUpdate = true;
    }

    clearLobby(container = this.lobbyContainer) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }

    clearReadingRoom() {
        while (this.roomContainer.firstChild) {
            this.roomContainer.removeChild(this.roomContainer.firstChild);
        }
        this.roomContainer.setAttribute('visible', 'false');
        this.canvasPlane = null;
        this.readingRoomBounds = null;
    }
}

export { RoomGenerator };