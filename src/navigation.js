class Navigation {
    constructor(options) {
        this.rig = options.rig;
        this.camera = options.camera;
        this.scene = options.scene;
        this.onEnterRoom = options.onEnterRoom || null;
        this.onReachEnd = options.onReachEnd || null;
        this.hallwayContainer = options.hallwayContainer;
        this.doorways = options.doorways || [];
        this.boundaries = options.boundaries || [];
        this.onEnterPost = options.onEnterPost || (() => {});
        this.onApproachPost = options.onApproachPost || (() => {});
        this.onCancelApproach = options.onCancelApproach || (() => {});
        this.onReturnToLobby = options.onReturnToLobby || (() => {});
        
        this.currentRoom = 'lobby';
        this.roomHistory = ['lobby'];
        this.registeredRooms = new Map();
        this.transitionCallbacks = [];
        this.keys = new Set();
        this.previousDistances = new Map();
        this.prewarmedDoorway = null;
        this.corridorEnd = null;
        this.previousCorridorZ = null;
        this.lastFrame = performance.now();
        
        this.setupControls();
        this.startPositionCheck();
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.returnToLobby(true);
                return;
            }
            this.keys.add(e.key.toLowerCase());
        });
        document.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
        window.addEventListener('blur', () => this.keys.clear());
    }

    startPositionCheck() {
        this.positionTimer = setInterval(() => this.tick(), 16);
    }

    tick() {
        const now = performance.now();
        const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
        this.lastFrame = now;
        this.moveRig(delta);

        if (this.currentRoom === 'lobby') {
            this.checkDoorwayCrossing();
        } else {
            this.checkCorridorReturn();
        }
    }

    moveRig(delta) {
        const forward = Number(this.keys.has('w') || this.keys.has('arrowup')) - Number(this.keys.has('s') || this.keys.has('arrowdown'));
        const strafe = Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft'));
        if (!forward && !strafe) return;

        const yaw = this.camera.object3D.rotation.y;
        const length = Math.hypot(forward, strafe);
        const forwardAmount = forward / length;
        const strafeAmount = strafe / length;
        const speed = this.keys.has('shift') ? 7 : 4;
        const position = this.rig.object3D.position;
        const previousX = position.x;
        const previousZ = position.z;
        position.x += (-Math.sin(yaw) * forwardAmount + Math.cos(yaw) * strafeAmount) * speed * delta;
        position.z += (-Math.cos(yaw) * forwardAmount - Math.sin(yaw) * strafeAmount) * speed * delta;
        this.rig.object3D.updateMatrixWorld(true);
        if (this.currentRoom === 'lobby') {
            for (const boundary of this.boundaries) {
                const offsetX = position.x - boundary.x;
                const offsetZ = position.z - boundary.z;
                const distance = offsetX * boundary.normalX + offsetZ * boundary.normalZ;
                const tangentDistance = offsetX * boundary.tangentX + offsetZ * boundary.tangentZ;
                const inOpening = boundary.width && Math.abs(tangentDistance) < boundary.width / 2 - 0.2;
                if (distance > -0.34 && !inOpening) {
                    position.x = previousX;
                    position.z = previousZ;
                    this.rig.object3D.updateMatrixWorld(true);
                    break;
                }
            }
        } else if (this.hallwayContainer?.object3D) {
            const worldPosition = this.rig.object3D.getWorldPosition(new THREE.Vector3());
            const localPosition = this.hallwayContainer.object3D.worldToLocal(worldPosition);
            localPosition.x = Math.max(-1.7, Math.min(1.7, localPosition.x));
            if (this.corridorEnd !== null) {
                localPosition.z = Math.max(this.corridorEnd - 3.6, localPosition.z);
            }
            const constrainedWorld = this.hallwayContainer.object3D.localToWorld(localPosition);
            position.x = constrainedWorld.x;
            position.z = constrainedWorld.z;
            this.rig.object3D.updateMatrixWorld(true);
        }
    }

    checkDoorwayCrossing() {
        const position = this.rig.object3D.getWorldPosition(new THREE.Vector3());
        for (let index = 0; index < this.doorways.length; index++) {
            const doorway = this.doorways[index];
            const offsetX = position.x - doorway.x;
            const offsetZ = position.z - doorway.z;
            const distance = offsetX * doorway.normalX + offsetZ * doorway.normalZ;
            const tangentDistance = offsetX * doorway.tangentX + offsetZ * doorway.tangentZ;
            const alignedWithDoor = Math.abs(tangentDistance) <= doorway.width / 2 - 0.2;
            const previous = this.previousDistances.get(index) ?? distance;
            this.previousDistances.set(index, distance);

            if (this.prewarmedDoorway === doorway && (distance < -3.5 || !alignedWithDoor)) {
                this.prewarmedDoorway = null;
                this.onCancelApproach(doorway);
            }
            if (!this.prewarmedDoorway && alignedWithDoor && distance >= -2.5 && distance < 0.75) {
                this.prewarmedDoorway = doorway;
                this.onApproachPost(doorway.post, doorway);
            }
            if (previous < 0.75 && distance >= 0.75 && alignedWithDoor) {
                this.enterDoorway(doorway);
                return;
            }
        }
    }

    enterDoorway(doorway) {
        if (this.currentRoom !== 'lobby') return;
        this.currentRoom = 'hallway';
        this.roomHistory = ['lobby', doorway.post.id];
        this.activeDoorway = doorway;
        this.prewarmedDoorway = null;
        this.previousDistances.clear();
        this.onEnterPost(doorway.post, doorway);
        const worldPosition = this.rig.object3D.getWorldPosition(new THREE.Vector3());
        this.previousCorridorZ = this.hallwayContainer.object3D.worldToLocal(worldPosition).z;
    }

    checkCorridorReturn() {
        if (!this.hallwayContainer?.object3D) return;
        const position = this.rig.object3D.getWorldPosition(new THREE.Vector3());
        const localPosition = this.hallwayContainer.object3D.worldToLocal(position);
        if (this.previousCorridorZ !== null && this.previousCorridorZ <= 0.6 && localPosition.z > 0.6) {
            this.returnToLobby(false);
            return;
        }
        this.previousCorridorZ = localPosition.z;
    }

    returnToLobby(direct = false) {
        if (this.currentRoom === 'lobby') return;
        this.currentRoom = 'lobby';
        this.roomHistory = ['lobby'];
        this.activeDoorway = null;
        this.corridorEnd = null;
        this.previousCorridorZ = null;
        this.previousDistances.clear();
        if (direct) this.rig.setAttribute('position', '0 0 0');
        this.onReturnToLobby();
    }

    setCorridorEnd(endZ) {
        this.corridorEnd = endZ;
    }

    destroy() {
        clearInterval(this.positionTimer);
        this.keys.clear();
    }

    onRoomTransition(callback) {
        this.transitionCallbacks.push(callback);
    }

    triggerTransition(fromRoom, toRoom, position) {
        this.transitionCallbacks.forEach(cb => cb(fromRoom, toRoom, position));
    }

    setRoom(roomId) {
        if (this.currentRoom !== roomId) {
            this.currentRoom = roomId;
            this.roomHistory.push(roomId);
        }
    }

    registerRoom(roomId, roomData) {
        this.registeredRooms.set(roomId, roomData);
    }

    navigateTo(roomId, entrancePosition) {
        const room = this.registeredRooms.get(roomId);
        if (room) {
            const fromRoom = this.currentRoom;
            this.setRoom(roomId);
            this.triggerTransition(fromRoom, roomId, entrancePosition);
            
            if (this.onEnterRoom) {
                this.onEnterRoom(roomId, room);
            }
        }
    }

    goBack() {
        this.returnToLobby(true);
    }

    canGoBack() {
        return this.roomHistory.length > 1;
    }

    getCurrentRoom() {
        return this.currentRoom;
    }

    getPosition() {
        return this.rig.getAttribute('position');
    }

    setPosition(position) {
        this.rig.setAttribute('position', position);
    }
    
    getBackPosition(roomId) {
        const room = this.registeredRooms.get(roomId);
        if (!room) return { x: 0, y: 0, z: 2 };
        
        if (room.type === 'post') {
            return { x: 0, y: 0, z: 4 };
        }
        return { x: 0, y: 0, z: 2 };
    }
}

export { Navigation };
