export class HallwayLoader {
    constructor(options) {
        this.scene = options.scene;
        this.rig = options.rig;
        this.container = options.hallwayContainer;
        this.container = options.container || this.container;
        this.hallwayLength = 10;
        this.fixedLength = 20;
        this.maxSegmentCount = this.fixedLength / this.hallwayLength;
        this.segmentCount = 0;
        this.isLoading = true;
        this.active = false;
        this.segments = [];
        this.preloadDistance = 15;
    }

    start(doorway) {
        this.preview(doorway);
        this.prewarmed = false;
    }

    preview(doorway) {
        if (this.active && this.activePostId === doorway.post.id) return;
        this.stop();
        this.active = true;
        this.isLoading = true;
        this.prewarmed = true;
        this.activePostId = doorway.post.id;
        this.container.setAttribute('position', `${doorway.x} 0 ${doorway.z}`);
        this.container.setAttribute('rotation', `0 ${doorway.rotationY} 0`);
        this.container.setAttribute('visible', 'true');
        this.appendSegment();
        this.appendSegment();
        this.positionTimer = setInterval(() => this.extendAhead(), 100);
    }

    cancelPreview(doorway) {
        if (this.prewarmed && this.activePostId === doorway.post.id) this.stop();
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
        if (!this.active || !this.isLoading || this.segmentCount >= this.maxSegmentCount) return;
        const worldPosition = this.rig.object3D.getWorldPosition(new THREE.Vector3());
        const localPosition = this.container.object3D.worldToLocal(worldPosition);
        const generatedEnd = -this.segmentCount * this.hallwayLength;
        if (localPosition.z <= generatedEnd + this.preloadDistance) this.appendSegment();
    }

    prepareEnd(targetZ = -this.fixedLength) {
        const length = Math.max(0, -targetZ);
        const fullSegments = Math.floor(length / this.hallwayLength);
        const remainder = length - fullSegments * this.hallwayLength;
        const requiredSegments = fullSegments + Number(remainder > 0.001);

        while (this.segmentCount > requiredSegments) {
            this.segments.pop().remove();
            this.segmentCount--;
        }
        while (this.segmentCount < requiredSegments) this.appendFinalSegment();

        if (remainder > 0.001) {
            const finalSegment = this.segments[this.segments.length - 1];
            finalSegment.setAttribute('position', {
                x: 0,
                y: 0,
                z: -(fullSegments * this.hallwayLength + remainder / 2)
            });
            finalSegment.setAttribute('scale', { x: 1, y: 1, z: remainder / this.hallwayLength });
        }
        return targetZ;
    }

    completeLoading(targetZ = -this.fixedLength) {
        this.endZ = this.prepareEnd(targetZ);
        this.isLoading = false;
        clearInterval(this.positionTimer);
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
        this.prewarmed = false;
        this.activePostId = null;
        this.segments.forEach(segment => segment.remove());
        this.segments = [];
        if (this.container) this.container.setAttribute('visible', 'false');
    }
}
