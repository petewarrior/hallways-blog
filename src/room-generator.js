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
        this.roomContainer = options.roomContainer || document.getElementById('room-container');
        this.canvasPlane = null;
        this.doorways = [];
        this.boundaries = [];
    }

    createLobby(posts = []) {
        this.clearLobby();
        this.clearReadingRoom();
        this.lobbyContainer.setAttribute('visible', 'true');

        const sides = Math.max(3, posts.length);
        const radius = Math.max(8, 5.5 / (2 * Math.sin(Math.PI / sides)));
        const edgeLength = 2 * radius * Math.sin(Math.PI / sides);
        const apothem = radius * Math.cos(Math.PI / sides);
        const doorWidth = 2.2;

        const floor = document.createElement('a-cylinder');
        floor.setAttribute('position', '0 0 0');
        floor.setAttribute('radius', radius + 1);
        floor.setAttribute('height', '0.12');
        floor.setAttribute('color', '#C9C8C2');
        floor.setAttribute('segments-radial', '64');
        this.lobbyContainer.appendChild(floor);

        this.doorways = [];
        this.boundaries = [];
        if (!posts.length) {
            const emptyState = document.createElement('a-text');
            emptyState.setAttribute('value', 'NO POSTS YET');
            emptyState.setAttribute('position', '0 2.2 -3');
            emptyState.setAttribute('align', 'center');
            emptyState.setAttribute('width', '4');
            emptyState.setAttribute('color', '#555');
            this.lobbyContainer.appendChild(emptyState);
            return this.doorways;
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
            const post = posts[side];
            const openingWidth = post ? doorWidth : 0;
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

            for (const direction of (post ? [-1, 1] : [0])) {
                const width = post ? segmentWidth : edgeLength;
                const offset = post ? direction * (doorWidth / 2 + segmentWidth / 2) : 0;
                const wall = document.createElement('a-box');
                wall.setAttribute('position', `${centerX + tangentX * offset} 2 ${centerZ + tangentZ * offset}`);
                wall.setAttribute('rotation', `0 ${yaw * 180 / Math.PI} 0`);
                wall.setAttribute('width', width);
                wall.setAttribute('height', '4');
                wall.setAttribute('depth', '0.28');
                wall.setAttribute('color', '#85867F');
                this.lobbyContainer.appendChild(wall);
            }

            if (!post) continue;
            this.createDoorwayFrame(post, centerX, centerZ, normalX, normalZ, yaw, doorWidth);
            this.doorways.push({
                post,
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

    createDoorwayFrame(post, x, z, normalX, normalZ, yaw, width) {
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

        this.lobbyContainer.appendChild(frame);

        const title = document.createElement('a-text');
        title.setAttribute('value', post.title.length > 34 ? `${post.title.slice(0, 33)}...` : post.title);
        title.setAttribute('position', `${x - normalX * 0.2} 3.35 ${z - normalZ * 0.2}`);
        title.setAttribute('rotation', `0 ${yaw * 180 / Math.PI} 0`);
        title.setAttribute('align', 'center');
        title.setAttribute('width', '4.5');
        title.setAttribute('color', '#30312E');
        this.lobbyContainer.appendChild(title);

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

    createReadingRoom(post, corridorEnd) {
        this.clearReadingRoom();
        this.roomContainer.setAttribute('visible', 'true');
        const depth = 4;
        const centerZ = corridorEnd - depth / 2;
        const addBox = (position, dimensions, color) => {
            const box = document.createElement('a-box');
            box.setAttribute('position', position);
            box.setAttribute('width', dimensions[0]);
            box.setAttribute('height', dimensions[1]);
            box.setAttribute('depth', dimensions[2]);
            box.setAttribute('color', color);
            this.roomContainer.appendChild(box);
        };

        addBox(`0 0.05 ${centerZ}`, [4, 0.1, depth], '#D4D1C8');
        addBox(`0 3.95 ${centerZ}`, [4, 0.1, depth], '#D9D8D1');
        addBox(`-1.95 2 ${centerZ}`, [0.1, 4, depth], '#85867F');
        addBox(`1.95 2 ${centerZ}`, [0.1, 4, depth], '#85867F');
        addBox(`0 2 ${corridorEnd - depth}`, [4, 4, 0.12], '#85867F');
        addBox(`-1.45 2 ${corridorEnd}`, [1.1, 4, 0.12], '#85867F');
        addBox(`1.45 2 ${corridorEnd}`, [1.1, 4, 0.12], '#85867F');
        addBox(`0 3.2 ${corridorEnd}`, [1.8, 1.6, 0.12], '#85867F');

        this.canvasPlane = document.createElement('a-plane');
        this.canvasPlane.setAttribute('position', `0 2 ${corridorEnd - depth + 0.08}`);
        this.canvasPlane.setAttribute('width', '3.45');
        this.canvasPlane.setAttribute('height', '2.3');
        this.canvasPlane.setAttribute('material', 'shader: flat; src: #post-canvas; side: double');
        this.roomContainer.appendChild(this.canvasPlane);

        const scrollbar = document.createElement('a-entity');
        scrollbar.setAttribute('position', `1.81 2 ${corridorEnd - depth + 0.16}`);
        scrollbar.setAttribute('post-scrollbar', 'range: 0.92');

        const track = document.createElement('a-box');
        track.classList.add('post-scrollbar-track', 'scrollable');
        track.setAttribute('position', '0 0 0');
        track.setAttribute('width', '0.08');
        track.setAttribute('height', '2');
        track.setAttribute('depth', '0.04');
        track.setAttribute('color', '#77796F');
        scrollbar.appendChild(track);

        const thumb = document.createElement('a-box');
        thumb.classList.add('post-scrollbar-thumb', 'scrollable');
        thumb.setAttribute('position', '0 0.92 0.07');
        thumb.setAttribute('width', '0.26');
        thumb.setAttribute('height', '0.2');
        thumb.setAttribute('depth', '0.12');
        thumb.setAttribute('color', '#B35C3A');
        scrollbar.appendChild(thumb);
        this.roomContainer.appendChild(scrollbar);
    }

    refreshCanvasTexture() {
        const material = this.canvasPlane?.components?.material?.material;
        if (material?.map) material.map.needsUpdate = true;
    }

    clearLobby() {
        while (this.lobbyContainer.firstChild) {
            this.lobbyContainer.removeChild(this.lobbyContainer.firstChild);
        }
    }

    clearReadingRoom() {
        while (this.roomContainer.firstChild) {
            this.roomContainer.removeChild(this.roomContainer.firstChild);
        }
        this.roomContainer.setAttribute('visible', 'false');
        this.canvasPlane = null;
    }
}

export { RoomGenerator };