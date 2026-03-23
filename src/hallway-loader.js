export class HallwayLoader {
    constructor(options) {
        this.scene = options.scene;
        this.rig = options.rig;
        this.container = options.hallwayContainer;
        this.hallwayLength = 10;
        this.segmentCount = 0;
        this.maxSegments = 5;
        this.isLoading = true;
        this.segments = [];
    }

    extendHallway() {
        if (this.segmentCount >= this.maxSegments) return;
        
        const segment = document.createElement('a-entity');
        segment.setAttribute('gltf-model', '#hallway-model');
        segment.setAttribute('position', {
            x: 0,
            y: 0,
            z: -(this.segmentCount + 1) * this.hallwayLength
        });
        segment.classList.add('hallway-segment');
        this.container.appendChild(segment);
        this.segments.push(segment);
        
        this.segmentCount++;
    }

    completeLoading() {
        this.isLoading = false;
    }

    isFullyLoaded() {
        return !this.isLoading;
    }
}
