export class HallwayLoader {
    constructor(options) {
        this.scene = options.scene;
        this.rig = options.rig;
        this.container = options.hallwayContainer;
        this.container = options.container || this.container;
        this.hallwayLength = 10;
        this.segmentCount = 0;
        this.isLoading = true;
        this.active = false;
        this.segments = [];
        this.preloadDistance = 15;
    }

    start(doorway) {
        this.stop();
        this.active = true;
        this.isLoading = true;
        this.container.setAttribute('position', `${doorway.x} 0 ${doorway.z}`);
        this.container.setAttribute('rotation', `0 ${doorway.rotationY} 0`);
        this.container.setAttribute('visible', 'true');
        this.appendSegment();
        this.appendSegment();
        this.positionTimer = setInterval(() => this.extendAhead(), 100);
    }

    extendHallway() {
        if (!this.active || !this.isLoading) return;
        
        const segment = document.createElement('a-entity');
        segment.setAttribute('gltf-model', '#hallway-model');
        segment.setAttribute('position', {
            x: 0,
            y: 0,
            z: -(this.segmentCount * this.hallwayLength + this.hallwayLength / 2)
        });
        segment.classList.add('hallway-segment');
        this.container.appendChild(segment);
        this.segments.push(segment);
        this.segmentCount++;
    }

    appendSegment() {
        this.extendHallway();
    }

    extendAhead() {
        if (!this.active || !this.isLoading) return;
        const worldPosition = this.rig.object3D.getWorldPosition(new THREE.Vector3());
        const localPosition = this.container.object3D.worldToLocal(worldPosition);
        const generatedEnd = -this.segmentCount * this.hallwayLength;
        if (localPosition.z <= generatedEnd + this.preloadDistance) this.appendSegment();
    }

    completeLoading() {
        this.isLoading = false;
        clearInterval(this.positionTimer);
        const worldPosition = this.rig.object3D.getWorldPosition(new THREE.Vector3());
        const localPosition = this.container.object3D.worldToLocal(worldPosition);
        while (localPosition.z <= -this.segmentCount * this.hallwayLength + 10) {
            this.appendFinalSegment();
        }
        this.endZ = -this.segmentCount * this.hallwayLength;
        return this.endZ;
    }

    appendFinalSegment() {
        const wasLoading = this.isLoading;
        this.isLoading = true;
        this.extendHallway();
        this.isLoading = wasLoading;
    }

    isFullyLoaded() {
        return !this.isLoading;
    }

    stop() {
        clearInterval(this.positionTimer);
        this.active = false;
        this.isLoading = false;
        this.segmentCount = 0;
        this.segments.forEach(segment => segment.remove());
        this.segments = [];
        if (this.container) this.container.setAttribute('visible', 'false');
    }
}
