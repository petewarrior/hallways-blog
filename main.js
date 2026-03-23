import { parseContent } from './src/content-parser.js';

class BlogApp {
    constructor() {
        this.posts = [];
        this.categories = new Map();
        this.config = null;
        this.currentRoom = 'lobby';
    }

    async init() {
        await this.loadContent();
        this.createLobby();
        this.setupNavigation();
    }

    async loadContent() {
        try {
            const response = await fetch('content/config.json');
            this.config = await response.json();
            const result = await parseContent('content/posts');
            this.posts = result.posts;
            this.categories = result.categories;
        } catch (error) {
            console.error('Failed to load content:', error);
        }
    }

    setupNavigation() {
        document.getElementById('back-button').addEventListener('click', () => {
            this.goBack();
        });
    }

    createLobby() {
        const room = document.getElementById('lobby-room');
        room.innerHTML = '';
        
        const lobbyZ = -20;
        const radius = 10;
        
        const floor = document.createElement('a-cylinder');
        floor.setAttribute('position', `0 0.05 ${lobbyZ}`);
        floor.setAttribute('radius', radius);
        floor.setAttribute('height', '0.1');
        floor.setAttribute('color', '#BBB');
        floor.setAttribute('segments-radial', '32');
        room.appendChild(floor);
        
        const floorText = document.createElement('a-text');
        floorText.setAttribute('value', 'LOBBY');
        floorText.setAttribute('rotation', '-90 0 0');
        floorText.setAttribute('position', `0 0.08 ${lobbyZ}`);
        floorText.setAttribute('align', 'center');
        floorText.setAttribute('width', '25');
        floorText.setAttribute('color', '#888');
        room.appendChild(floorText);
        
        const numWalls = 6;
        for (let i = 0; i < numWalls; i++) {
            const angle = (i / numWalls) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = lobbyZ + Math.sin(angle) * radius;
            
            const wall = document.createElement('a-box');
            wall.setAttribute('position', `${x} 2.5 ${z}`);
            wall.setAttribute('rotation', `0 ${90 - (angle * 180 / Math.PI)} 0`);
            wall.setAttribute('width', '2');
            wall.setAttribute('height', '5');
            wall.setAttribute('depth', '0.3');
            wall.setAttribute('color', '#999');
            room.appendChild(wall);
        }
        
        const welcomeText = document.createElement('a-text');
        welcomeText.setAttribute('value', 'Welcome to the Blog\nUse WASD to walk, mouse to look');
        welcomeText.setAttribute('position', `0 2 ${lobbyZ}`);
        welcomeText.setAttribute('align', 'center');
        welcomeText.setAttribute('width', '12');
        welcomeText.setAttribute('color', '#555');
        room.appendChild(welcomeText);
        
        const recentPosts = this.posts.slice(0, this.config?.recentPostsCount || 5);
        const categories = Array.from(this.categories.values());
        
        const totalItems = recentPosts.length + categories.length;
        const angleStep = (Math.PI * 2) / Math.max(totalItems, 1);
        const panelDistance = radius - 2;
        
        let angle = 0;
        
        categories.forEach((cat) => {
            const x = Math.cos(angle) * panelDistance;
            const z = lobbyZ + Math.sin(angle) * panelDistance;
            
            const doorway = this.createDoorway({
                title: cat.name,
                subtitle: `${cat.postCount} posts`,
                position: { x, y: 0, z },
                angle: angle,
                type: 'category',
                id: cat.slug
            });
            room.appendChild(doorway);
            angle += angleStep;
        });
        
        recentPosts.forEach((post) => {
            const x = Math.cos(angle) * panelDistance;
            const z = lobbyZ + Math.sin(angle) * panelDistance;
            
            const doorway = this.createDoorway({
                title: post.title,
                subtitle: post.excerpt.substring(0, 40) + '...',
                position: { x, y: 0, z },
                angle: angle,
                type: 'post',
                id: post.id
            });
            room.appendChild(doorway);
            angle += angleStep;
        });
        
        document.getElementById('room-label').textContent = `Lobby - ${this.posts.length} posts`;
    }

    createDoorway(options) {
        const { title, subtitle, position, angle, type, id } = options;
        
        const doorway = document.createElement('a-entity');
        doorway.setAttribute('position', `${position.x} ${position.y} ${position.z}`);
        doorway.setAttribute('rotation', `0 ${90 + (angle * 180 / Math.PI)} 0`);
        doorway.setAttribute('class', 'clickable');
        doorway.dataset.type = type;
        doorway.dataset.id = id;
        
        const frame = document.createElement('a-box');
        frame.setAttribute('width', '2');
        frame.setAttribute('height', '3');
        frame.setAttribute('depth', '0.4');
        frame.setAttribute('color', '#8B7355');
        frame.setAttribute('class', 'clickable');
        doorway.appendChild(frame);
        
        const opening = document.createElement('a-box');
        opening.setAttribute('width', '1.4');
        opening.setAttribute('height', '2.4');
        opening.setAttribute('depth', '0.5');
        opening.setAttribute('position', '0 -0.1 0');
        opening.setAttribute('color', '#222');
        doorway.appendChild(opening);
        
        const titleText = document.createElement('a-text');
        titleText.setAttribute('value', title.length > 20 ? title.substring(0, 20) + '...' : title);
        titleText.setAttribute('position', '0 1.9 0.3');
        titleText.setAttribute('align', 'center');
        titleText.setAttribute('width', '3');
        titleText.setAttribute('color', '#333');
        doorway.appendChild(titleText);
        
        doorway.addEventListener('click', () => {
            if (type === 'category') {
                this.enterCategory(id);
            } else {
                this.enterPost(id);
            }
        });
        
        return doorway;
    }

    enterCategory(categoryId) {
        const category = this.categories.get(categoryId);
        if (!category) return;
        
        this.currentRoom = 'category';
        document.getElementById('lobby-room').setAttribute('visible', 'false');
        document.getElementById('back-button').classList.remove('hidden');
        document.getElementById('room-label').textContent = category.name;
        
        this.createCategoryRoom(category);
    }

    createCategoryRoom(category) {
        const room = document.getElementById('category-room');
        room.innerHTML = '';
        room.setAttribute('visible', 'true');
        
        const isPolygon = category.postCount <= 20;
        
        if (isPolygon) {
            this.createPolygonRoom(room, category);
        } else {
            this.createCorridorRoom(room, category);
        }
    }

    createPolygonRoom(room, category) {
        const sides = category.postCount;
        const radius = Math.max(5, sides * 1.2);
        
        const floor = document.createElement('a-cylinder');
        floor.setAttribute('position', '0 0.05 0');
        floor.setAttribute('radius', radius);
        floor.setAttribute('height', '0.1');
        floor.setAttribute('color', '#CCC');
        floor.setAttribute('segments-radial', '32');
        room.appendChild(floor);
        
        const floorText = document.createElement('a-text');
        floorText.setAttribute('value', category.name);
        floorText.setAttribute('rotation', '-90 0 0');
        floorText.setAttribute('position', '0 0.08 0');
        floorText.setAttribute('align', 'center');
        floorText.setAttribute('width', '20');
        floorText.setAttribute('color', '#888');
        room.appendChild(floorText);
        
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const nextAngle = ((i + 1) / sides) * Math.PI * 2;
            
            const wallLength = 2 * radius * Math.sin(Math.PI / sides);
            const wallAngle = (angle + nextAngle) / 2;
            
            const wall = document.createElement('a-box');
            wall.setAttribute('position', `${Math.cos(wallAngle) * (radius - 0.2)} 2.5 ${Math.sin(wallAngle) * (radius - 0.2)}`);
            wall.setAttribute('rotation', `0 ${90 - (wallAngle * 180 / Math.PI)} 0`);
            wall.setAttribute('width', wallLength);
            wall.setAttribute('height', '5');
            wall.setAttribute('depth', '0.3');
            wall.setAttribute('color', '#AAA');
            room.appendChild(wall);
        }
        
        category.posts.forEach((post, index) => {
            const angle = (index / sides) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const doorway = this.createDoorway({
                title: post.title,
                subtitle: post.date,
                position: { x, y: 0, z },
                angle: angle,
                type: 'post',
                id: post.id
            });
            room.appendChild(doorway);
        });
    }

    createCorridorRoom(room, category) {
        const posts = category.posts;
        const corridorLength = Math.max(10, posts.length * 2);
        
        const floor = document.createElement('a-box');
        floor.setAttribute('position', `0 0.05 -${corridorLength / 2}`);
        floor.setAttribute('width', '4');
        floor.setAttribute('height', '0.1');
        floor.setAttribute('depth', corridorLength);
        floor.setAttribute('color', '#CCC');
        room.appendChild(floor);
        
        const floorText = document.createElement('a-text');
        floorText.setAttribute('value', category.name);
        floorText.setAttribute('rotation', '-90 0 0');
        floorText.setAttribute('position', `0 0.08 -${corridorLength / 2 + 1}`);
        floorText.setAttribute('align', 'center');
        floorText.setAttribute('width', '20');
        floorText.setAttribute('color', '#888');
        room.appendChild(floorText);
        
        const leftWall = document.createElement('a-box');
        leftWall.setAttribute('position', `-2 2.5 -${corridorLength / 2}`);
        leftWall.setAttribute('width', '0.3');
        leftWall.setAttribute('height', '5');
        leftWall.setAttribute('depth', corridorLength);
        leftWall.setAttribute('color', '#AAA');
        room.appendChild(leftWall);
        
        const rightWall = document.createElement('a-box');
        rightWall.setAttribute('position', `2 2.5 -${corridorLength / 2}`);
        rightWall.setAttribute('width', '0.3');
        rightWall.setAttribute('height', '5');
        rightWall.setAttribute('depth', corridorLength);
        rightWall.setAttribute('color', '#AAA');
        room.appendChild(rightWall);
        
        posts.forEach((post, index) => {
            const isLeft = index % 2 === 0;
            const rowIndex = Math.floor(index / 2);
            const z = -2 - (rowIndex * 4);
            const x = isLeft ? -2.5 : 2.5;
            
            const doorway = this.createDoorway({
                title: post.title,
                subtitle: post.date,
                position: { x, y: 0, z },
                angle: isLeft ? 90 : -90,
                type: 'post',
                id: post.id
            });
            room.appendChild(doorway);
        });
    }

    enterPost(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;
        
        this.currentRoom = 'post';
        document.getElementById('lobby-room').setAttribute('visible', 'false');
        document.getElementById('category-room').setAttribute('visible', 'false');
        document.getElementById('room-label').textContent = post.title;
        
        const room = document.getElementById('category-room');
        room.innerHTML = '';
        room.setAttribute('visible', 'true');
        
        const floor = document.createElement('a-box');
        floor.setAttribute('position', '0 0.05 0');
        floor.setAttribute('width', '6');
        floor.setAttribute('height', '0.1');
        floor.setAttribute('depth', '8');
        floor.setAttribute('color', '#CCC');
        room.appendChild(floor);
        
        const floorText = document.createElement('a-text');
        floorText.setAttribute('value', post.title);
        floorText.setAttribute('rotation', '-90 0 0');
        floorText.setAttribute('position', '0 0.08 0');
        floorText.setAttribute('align', 'center');
        floorText.setAttribute('width', '20');
        floorText.setAttribute('color', '#888');
        room.appendChild(floorText);
        
        const titleText = document.createElement('a-text');
        titleText.setAttribute('value', post.title);
        titleText.setAttribute('position', '0 2.5 -3');
        titleText.setAttribute('align', 'center');
        titleText.setAttribute('width', '8');
        titleText.setAttribute('color', '#333');
        room.appendChild(titleText);
        
        const dateText = document.createElement('a-text');
        dateText.setAttribute('value', post.date);
        dateText.setAttribute('position', '0 2 -3');
        dateText.setAttribute('align', 'center');
        dateText.setAttribute('width', '4');
        dateText.setAttribute('color', '#888');
        room.appendChild(dateText);
        
        const excerptText = document.createElement('a-text');
        excerptText.setAttribute('value', post.excerpt);
        excerptText.setAttribute('position', '0 1.5 -3');
        excerptText.setAttribute('align', 'center');
        excerptText.setAttribute('width', '6');
        excerptText.setAttribute('color', '#555');
        excerptText.setAttribute('wrap-count', '50');
        room.appendChild(excerptText);
        
        if (post.image) {
            const img = document.createElement('a-image');
            img.setAttribute('src', post.image);
            img.setAttribute('position', '0 1 -5');
            img.setAttribute('width', '4');
            img.setAttribute('height', '2');
            room.appendChild(img);
        }
    }

    goBack() {
        if (this.currentRoom === 'post') {
            document.getElementById('category-room').setAttribute('visible', 'false');
            document.getElementById('category-room').innerHTML = '';
            document.getElementById('lobby-room').setAttribute('visible', 'true');
            this.currentRoom = 'category';
            
            const catName = document.getElementById('room-label').textContent;
            document.getElementById('room-label').textContent = catName;
        } else if (this.currentRoom === 'category') {
            document.getElementById('category-room').setAttribute('visible', 'false');
            document.getElementById('category-room').innerHTML = '';
            document.getElementById('lobby-room').setAttribute('visible', 'true');
            this.currentRoom = 'lobby';
            document.getElementById('back-button').classList.add('hidden');
            document.getElementById('room-label').textContent = `Lobby - ${this.posts.length} posts`;
        }
    }
}

const app = new BlogApp();
document.addEventListener('DOMContentLoaded', () => app.init());
