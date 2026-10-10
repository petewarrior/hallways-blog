AFRAME.registerComponent('post-scrollbar', {
    schema: {
        range: { type: 'number', default: 0.92 }
    },

    init: function() {
        this.thumb = this.el.querySelector('.post-scrollbar-thumb');
        this.track = this.el.querySelector('.post-scrollbar-track');
        this.dragRaycaster = null;
        this.dragging = false;
        this.lookControlsPaused = false;
        this.onMouseDown = event => {
            event.stopPropagation();
            this.beginDrag(event.detail?.cursorEl, true);
        };
        this.onMouseUp = () => this.endDrag();
        this.onTriggerDown = event => {
            const raycaster = event.currentTarget.components.raycaster;
            if (raycaster?.getIntersection(this.thumb) || raycaster?.getIntersection(this.track)) {
                this.beginDrag(raycaster);
            }
        };
        this.onTriggerUp = () => this.endDrag();

        this.thumb.addEventListener('mousedown', this.onMouseDown);
        this.thumb.addEventListener('mouseup', this.onMouseUp);
        this.track.addEventListener('mousedown', this.onMouseDown);
        this.track.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('mouseup', this.onMouseUp);
        this.controllers = Array.from(this.el.sceneEl.querySelectorAll('[laser-controls]'));
        this.controllers.forEach(controller => {
            controller.addEventListener('triggerdown', this.onTriggerDown);
            controller.addEventListener('triggerup', this.onTriggerUp);
        });
    },

    beginDrag: function(source, isMouse = false) {
        const cursor = source || this.el.sceneEl.querySelector('#camera [cursor]');
        this.dragRaycaster = cursor?.raycaster || cursor?.components?.raycaster || cursor;
        this.dragging = true;
        if (isMouse) this.pauseMouseLook();
        this.updateThumbFromRay();
    },

    pauseMouseLook: function() {
        const camera = this.el.sceneEl.camera?.el || this.el.sceneEl.querySelector('#camera');
        const controls = camera?.components['look-controls'];
        if (controls?.isPlaying) {
            controls.pause();
            this.lookControlsPaused = true;
        }
    },

    resumeMouseLook: function() {
        if (!this.lookControlsPaused) return;
        const camera = this.el.sceneEl.camera?.el || this.el.sceneEl.querySelector('#camera');
        camera?.components['look-controls']?.play();
        this.lookControlsPaused = false;
    },

    endDrag: function() {
        this.dragging = false;
        this.dragRaycaster = null;
        this.resumeMouseLook();
    },

    tick: function() {
        const postCanvas = window.blogApp?.postCanvas;
        if (!postCanvas) return;

        if (this.dragging) this.updateThumbFromRay();
        const ratio = postCanvas.maxScroll ? postCanvas.scrollY / postCanvas.maxScroll : 0;
        this.setThumbRatio(ratio);
    },

    updateThumbFromRay: function() {
        const raycaster = this.dragRaycaster?.raycaster || this.dragRaycaster;
        const ray = raycaster?.ray;
        if (!ray) return;

        const worldPosition = this.el.object3D.getWorldPosition(new THREE.Vector3());
        const normal = this.el.object3D.getWorldDirection(new THREE.Vector3());
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPosition);
        const intersection = ray.intersectPlane(plane, new THREE.Vector3());
        if (!intersection) return;

        const localPoint = this.el.object3D.worldToLocal(intersection);
        const ratio = THREE.MathUtils.clamp((this.data.range - localPoint.y) / (this.data.range * 2), 0, 1);
        window.blogApp?.postCanvas.scrollToRatio(ratio);
    },

    setThumbRatio: function(ratio) {
        const position = this.thumb.getAttribute('position');
        position.y = this.data.range * (1 - ratio * 2);
        this.thumb.setAttribute('position', position);
    },

    remove: function() {
        this.resumeMouseLook();
        this.thumb.removeEventListener('mousedown', this.onMouseDown);
        this.thumb.removeEventListener('mouseup', this.onMouseUp);
        this.track.removeEventListener('mousedown', this.onMouseDown);
        this.track.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.controllers.forEach(controller => {
            controller.removeEventListener('triggerdown', this.onTriggerDown);
            controller.removeEventListener('triggerup', this.onTriggerUp);
        });
    }
});
