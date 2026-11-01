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
        this.onReachDestination = options.onReachDestination || (() => {});
        
        this.currentRoom = 'lobby';
        this.roomHistory = ['lobby'];
        this.registeredRooms = new Map();
        this.transitionCallbacks = [];
        this.keys = new Set();
        this.previousDistances = new Map();
        this.prewarmedDoorway = null;
        this.corridorEnd = null;
        this.readingRoomBounds = null;
        this.destinationReady = true;
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

        if (this.isLobby()) {
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
        const previousWorldPosition = this.rig.object3D.getWorldPosition(new THREE.Vector3());
        position.x += (-Math.sin(yaw) * forwardAmount + Math.cos(yaw) * strafeAmount) * speed * delta;
        position.z += (-Math.cos(yaw) * forwardAmount - Math.sin(yaw) * strafeAmount) * speed * delta;
        this.rig.object3D.updateMatrixWorld(true);
        if (this.isLobby()) {
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
            if (this.readingRoomBounds) {
                const bounds = this.readingRoomBounds;
                const previousLocalPosition = this.hallwayContainer.object3D.worldToLocal(previousWorldPosition);
                const radius = 0.28;
                const doorwayHalfWidth = bounds.doorwayWidth / 2 - radius;
                const crossedIntoRoom = previousLocalPosition.z > bounds.frontZ && localPosition.z <= bounds.frontZ;
                const crossedIntoHallway = previousLocalPosition.z <= bounds.frontZ && localPosition.z > bounds.frontZ;

                if (localPosition.z <= bounds.frontZ && !this.destinationReady) {
                    localPosition.z = bounds.frontZ + radius;
                } else if (crossedIntoRoom && Math.abs(localPosition.x) > doorwayHalfWidth) {
                    localPosition.z = bounds.frontZ + radius;
                } else if (crossedIntoHallway && Math.abs(localPosition.x) > doorwayHalfWidth) {
                    localPosition.z = bounds.frontZ - radius;
                }

                if (localPosition.z <= bounds.frontZ) {
                    localPosition.x = Math.max(-bounds.width / 2 + radius, Math.min(bounds.width / 2 - radius, localPosition.x));
                    localPosition.z = Math.max(bounds.backZ + radius, localPosition.z);
                } else {
                    localPosition.x = Math.max(-1.7, Math.min(1.7, localPosition.x));
                }

                const collidesWithPanel = (x, z) => bounds.obstacles.some(obstacle =>
                    Math.abs(x - obstacle.x) < obstacle.halfWidth + radius &&
                    Math.abs(z - obstacle.z) < obstacle.halfDepth + radius
                );
                if (localPosition.z <= bounds.frontZ && collidesWithPanel(localPosition.x, localPosition.z)) {
                    const canSlideX = !collidesWithPanel(localPosition.x, previousLocalPosition.z);
                    const canSlideZ = !collidesWithPanel(previousLocalPosition.x, localPosition.z);
                    if (canSlideX) localPosition.z = previousLocalPosition.z;
                    else if (canSlideZ) localPosition.x = previousLocalPosition.x;
                    else {
                        localPosition.x = previousLocalPosition.x;
                        localPosition.z = previousLocalPosition.z;
                    }
                }
            } else {
                localPosition.x = Math.max(-1.7, Math.min(1.7, localPosition.x));
                if (this.corridorEnd !== null) {
                    const destinationLimit = this.destinationReady
                        ? this.corridorEnd - 3.6
                        : this.corridorEnd + 0.4;
                    localPosition.z = Math.max(destinationLimit, localPosition.z);
                }
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
        if (!this.isLobby()) return;
        if (doorway.post?.type === 'parent') {
            this.currentRoom = 'hallway';
            this.activeDoorway = doorway;
            this.previousDistances.clear();
            const worldPosition = this.rig.object3D.getWorldPosition(new THREE.Vector3());
            this.previousCorridorZ = this.hallwayContainer.object3D.worldToLocal(worldPosition).z;
            this.onEnterPost(doorway.post, doorway);
            return;
        }
        this.currentRoom = 'hallway';
        this.roomHistory = ['lobby', doorway.post.id];
        this.activeDoorway = doorway;
        this.readingRoomBounds = null;
        this.destinationReady = false;
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
        if (this.activeDoorway?.post?.type === 'category' && this.destinationReady && this.corridorEnd !== null && localPosition.z <= this.corridorEnd - 0.6) {
            this.onReachDestination(this.activeDoorway.post, this.activeDoorway);
            return;
        }
        if (this.activeDoorway?.post?.type === 'parent' && this.corridorEnd !== null && localPosition.z <= this.corridorEnd - 0.6) {
            this.returnToLobby(false);
            return;
        }
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
        this.readingRoomBounds = null;
        this.destinationReady = true;
        this.previousCorridorZ = null;
        this.previousDistances.clear();
        if (direct) this.rig.setAttribute('position', '0 0 0');
        this.onReturnToLobby(direct);
    }

    setCorridorEnd(endZ) {
        this.corridorEnd = endZ;
    }

    setReadingRoom(bounds) {
        this.readingRoomBounds = bounds;
    }

    setDestinationReady(ready) {
        this.destinationReady = ready;
    }

    setLobby(doorways, boundaries, nested = false) {
        this.currentRoom = nested ? 'category-lobby' : 'lobby';
        this.roomHistory = [this.currentRoom];
        this.activeDoorway = null;
        this.prewarmedDoorway = null;
        this.corridorEnd = null;
        this.readingRoomBounds = null;
        this.destinationReady = true;
        this.previousCorridorZ = null;
        this.doorways = doorways;
        this.boundaries = boundaries;
        this.previousDistances.clear();
    }

    isLobby() {
        return this.currentRoom === 'lobby' || this.currentRoom === 'category-lobby';
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
