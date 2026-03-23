class Navigation {
    constructor(options) {
        this.rig = options.rig;
        this.camera = options.camera;
        this.scene = options.scene;
        this.onEnterRoom = options.onEnterRoom || null;
        this.onReachEnd = options.onReachEnd || null;
        
        this.currentRoom = 'loading';
        this.roomHistory = ['loading'];
        this.registeredRooms = new Map();
        this.transitionCallbacks = [];
        
        this.thresholdZ = 0;
        this.hasTriggered = false;
        
        this.setupControls();
        this.startPositionCheck();
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.goBack();
            }
        });
    }

    startPositionCheck() {
        setInterval(() => {
            const pos = this.rig.getAttribute('position');
            
            if (this.currentRoom === 'loading' && pos.z <= this.thresholdZ && !this.hasTriggered) {
                this.hasTriggered = true;
                if (this.onReachEnd) {
                    this.onReachEnd();
                }
            }
        }, 50);
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
        if (this.roomHistory.length > 1) {
            this.roomHistory.pop();
            const previousRoom = this.roomHistory[this.roomHistory.length - 1];
            
            const room = this.registeredRooms.get(previousRoom);
            const position = { x: 0, y: 0, z: 2 };
            
            if (room && room.parentRoom) {
                const parentRoom = this.registeredRooms.get(room.parentRoom);
                if (parentRoom) {
                    this.currentRoom = previousRoom;
                    this.triggerTransition(this.currentRoom, previousRoom, position);
                    
                    if (this.onEnterRoom) {
                        this.onEnterRoom(previousRoom, room);
                    }
                    return;
                }
            }
            
            this.currentRoom = previousRoom;
            this.rig.setAttribute('position', position);
            
            if (this.onEnterRoom && room) {
                this.onEnterRoom(previousRoom, room);
            }
        }
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
