AFRAME.registerComponent('post-panel', {
    schema: {
        postId: { type: 'string', default: '' },
        title: { type: 'string', default: '' },
        excerpt: { type: 'string', default: '' },
        image: { type: 'string', default: '' },
        category: { type: 'string', default: '' },
        date: { type: 'string', default: '' }
    },

    init: function() {
        this.createPanel();
        this.addEventListeners();
    },

    createPanel: function() {
        const data = this.data;
        
        this.panel = document.createElement('a-entity');
        this.panel.setAttribute('class', 'clickable post-panel-entity');
        
        const background = document.createElement('a-plane');
        background.setAttribute('width', '2');
        background.setAttribute('height', '1.5');
        background.setAttribute('color', '#FFF');
        background.setAttribute('material', 'shader: flat');
        this.panel.appendChild(background);

        if (data.image) {
            const image = document.createElement('a-image');
            image.setAttribute('src', data.image);
            image.setAttribute('position', '0 0.3 0.01');
            image.setAttribute('width', '1.8');
            image.setAttribute('height', '0.8');
            this.panel.appendChild(image);
        }

        const title = document.createElement('a-text');
        title.setAttribute('value', data.title);
        title.setAttribute('position', '0 0.6 0.02');
        title.setAttribute('align', 'center');
        title.setAttribute('width', '4');
        title.setAttribute('color', '#333');
        title.setAttribute('wrap-count', '25');
        this.panel.appendChild(title);

        const excerpt = document.createElement('a-text');
        excerpt.setAttribute('value', data.excerpt.substring(0, 80) + (data.excerpt.length > 80 ? '...' : ''));
        excerpt.setAttribute('position', '0 -0.5 0.02');
        excerpt.setAttribute('align', 'center');
        excerpt.setAttribute('width', '3');
        excerpt.setAttribute('color', '#666');
        excerpt.setAttribute('wrap-count', '30');
        this.panel.appendChild(excerpt);

        this.el.appendChild(this.panel);
    },

    addEventListeners: function() {
        this.el.addEventListener('click', () => {
            this.onClick();
        });

        this.el.addEventListener('mouseenter', () => {
            this.onHover(true);
        });

        this.el.addEventListener('mouseleave', () => {
            this.onHover(false);
        });
    },

    onClick: function() {
        const event = new CustomEvent('post-selected', {
            detail: {
                postId: this.data.postId,
                title: this.data.title
            }
        });
        window.dispatchEvent(event);
    },

    onHover: function(isHovering) {
        if (isHovering) {
            this.panel.setAttribute('scale', '1.05 1.05 1.05');
        } else {
            this.panel.setAttribute('scale', '1 1 1');
        }
    },

    update: function(oldData) {
        if (oldData.postId !== this.data.postId) {
            this.panel.remove();
            this.createPanel();
        }
    },

    remove: function() {
        if (this.panel) {
            this.panel.remove();
        }
    }
});

AFRAME.registerComponent('category-panel', {
    schema: {
        categoryId: { type: 'string', default: '' },
        name: { type: 'string', default: '' },
        postCount: { type: 'int', default: 0 }
    },

    init: function() {
        this.createPanel();
        this.addEventListeners();
    },

    createPanel: function() {
        const data = this.data;
        
        this.panel = document.createElement('a-entity');
        this.panel.setAttribute('class', 'clickable category-panel-entity');
        
        const background = document.createElement('a-plane');
        background.setAttribute('width', '2');
        background.setAttribute('height', '1.2');
        background.setAttribute('color', '#4A90D9');
        this.panel.appendChild(background);

        const name = document.createElement('a-text');
        name.setAttribute('value', data.name);
        name.setAttribute('position', '0 0.2 0.02');
        name.setAttribute('align', 'center');
        name.setAttribute('width', '5');
        name.setAttribute('color', '#FFF');
        this.panel.appendChild(name);

        const count = document.createElement('a-text');
        count.setAttribute('value', `${data.postCount} posts`);
        count.setAttribute('position', '0 -0.2 0.02');
        count.setAttribute('align', 'center');
        count.setAttribute('width', '4');
        count.setAttribute('color', '#DDD');
        this.panel.appendChild(count);

        this.el.appendChild(this.panel);
    },

    addEventListeners: function() {
        this.el.addEventListener('click', () => {
            const event = new CustomEvent('category-selected', {
                detail: {
                    categoryId: this.data.categoryId,
                    name: this.data.name
                }
            });
            window.dispatchEvent(event);
        });
    }
});

AFRAME.registerComponent('hover-image', {
    schema: {
        imageSrc: { type: 'string', default: '' },
        orbitRadius: { type: 'number', default: 3 },
        orbitSpeed: { type: 'number', default: 0.5 },
        heightOffset: { type: 'number', default: 1.6 },
        scale: { type: 'number', default: 1 }
    },

    init: function() {
        this.angle = Math.random() * Math.PI * 2;
        this.image = document.createElement('a-image');
        this.image.setAttribute('src', this.data.imageSrc);
        this.image.setAttribute('width', 1.5 * this.data.scale);
        this.image.setAttribute('height', 1 * this.data.scale);
        this.el.appendChild(this.image);
    },

    tick: function(time, deltaTime) {
        this.angle += (this.data.orbitSpeed * deltaTime) / 1000;
        
        const x = Math.cos(this.angle) * this.data.orbitRadius;
        const z = Math.sin(this.angle) * this.data.orbitRadius;
        const y = this.data.heightOffset + Math.sin(this.angle * 0.5) * 0.3;
        
        this.el.setAttribute('position', { x, y, z });
    }
});

AFRAME.registerComponent('floor-label', {
    schema: {
        text: { type: 'string', default: '' },
        color: { type: 'color', default: '#666' }
    },

    init: function() {
        const text = document.createElement('a-text');
        text.setAttribute('value', this.data.text);
        text.setAttribute('rotation', '-90 0 0');
        text.setAttribute('align', 'center');
        text.setAttribute('width', '15');
        text.setAttribute('color', this.data.color);
        this.el.appendChild(text);
    }
});
