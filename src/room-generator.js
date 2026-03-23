import { parseMarkdownFile } from './content-parser.js';

class RoomGenerator {
    constructor(options) {
        this.scene = options.scene;
        this.navigation = options.navigation;
        this.roomContainer = document.getElementById('room-container');
        this.currentRoomData = null;
    }

    createLobby(options) {
        const { posts, categories, recentCount } = options;
        const recentPosts = posts.slice(0, recentCount);
        
        this.clearRoom();
        
        const room = {
            id: 'lobby',
            label: 'Lobby',
            type: 'lobby',
            entrancePosition: { x: 0, y: 0, z: 0 },
            elements: [],
            cleanup: () => this.clearRoom()
        };
        this.currentRoomData = room;

        const centerPlatform = document.createElement('a-cylinder');
        centerPlatform.setAttribute('position', '0 0.1 0');
        centerPlatform.setAttribute('radius', '2');
        centerPlatform.setAttribute('height', '0.2');
        centerPlatform.setAttribute('color', '#DDD');
        centerPlatform.setAttribute('segments-radial', '32');
        this.roomContainer.appendChild(centerPlatform);
        room.elements.push(centerPlatform);

        const floorLabel = document.createElement('a-text');
        floorLabel.setAttribute('value', 'LOBBY');
        floorLabel.setAttribute('rotation', '-90 0 0');
        floorLabel.setAttribute('position', '0 0.02 0');
        floorLabel.setAttribute('align', 'center');
        floorLabel.setAttribute('width', '10');
        floorLabel.setAttribute('color', '#888');
        this.roomContainer.appendChild(floorLabel);
        room.elements.push(floorLabel);

        const titleText = document.createElement('a-entity');
        titleText.setAttribute('position', '0 0.05 -1.5');
        titleText.setAttribute('text', {
            value: 'Welcome\nWalk to explore',
            align: 'center',
            width: '8',
            color: '#333'
        });
        this.roomContainer.appendChild(titleText);
        room.elements.push(titleText);

        let angle = 0;
        const categoryAngleStep = (Math.PI * 2) / (categories.size + 1);
        
        for (const [catId, category] of categories) {
            const catAngle = angle - Math.PI / 2;
            const distance = 6;
            const x = Math.cos(catAngle) * distance;
            const z = Math.sin(catAngle) * distance;
            
            const catRoom = this.createCategoryRoom({
                category: category,
                parentRoom: 'lobby'
            });
            this.navigation.registerRoom(catRoom.id, catRoom);

            const catPanel = this.createPanel({
                type: 'category',
                title: category.name,
                subtitle: `${category.postCount} posts`,
                position: { x, y: 1.6, z },
                rotation: { x: 0, y: (catAngle * 180 / Math.PI) + 180, z: 0 },
                targetRoom: catRoom.id,
                entrancePosition: { x: 0, y: 0, z: 0 }
            });
            this.roomContainer.appendChild(catPanel);
            room.elements.push(catPanel);
            
            angle += categoryAngleStep;
        }

        const postAngleOffset = angle;
        const totalItems = recentCount + categories.size;
        const postAngleStep = (Math.PI * 2) / (totalItems + 1);
        
        recentPosts.forEach((post, index) => {
            const postAngle = postAngleOffset + index * postAngleStep;
            const distance = 6;
            const x = Math.cos(postAngle) * distance;
            const z = Math.sin(postAngle) * distance;
            
            const postRoom = this.createPostRoom({
                post: post,
                parentRoom: 'lobby'
            });
            this.navigation.registerRoom(postRoom.id, postRoom);

            const postPanel = this.createPanel({
                type: 'post',
                title: post.title,
                subtitle: post.excerpt.substring(0, 60) + '...',
                position: { x, y: 1.6, z },
                rotation: { x: 0, y: (postAngle * 180 / Math.PI) + 180, z: 0 },
                targetRoom: postRoom.id,
                entrancePosition: { x: 0, y: 0, z: 3 }
            });
            this.roomContainer.appendChild(postPanel);
            room.elements.push(postPanel);
        });

        return room;
    }

    createCategoryRoom(options) {
        const { category, parentRoom } = options;
        const threshold = 20;
        const usePolygon = category.postCount <= threshold;
        
        const room = {
            id: `category-${category.slug}`,
            label: category.name,
            type: usePolygon ? 'polygon' : 'corridor',
            parentRoom: parentRoom,
            posts: category.posts,
            elements: [],
            cleanup: () => this.clearRoom()
        };

        return room;
    }

    createPostRoom(options) {
        const { post, parentRoom } = options;
        
        const room = {
            id: `post-${post.id}`,
            label: post.title,
            type: 'post',
            parentRoom: parentRoom,
            post: post,
            entrancePosition: { x: 0, y: 0, z: 3 },
            backPosition: { x: 0, y: 0, z: 3 },
            elements: [],
            cleanup: () => this.clearRoom()
        };

        return room;
    }

    enterRoom(roomId, roomData) {
        if (roomData.type === 'post') {
            this.loadPostRoomContent(roomData);
        } else if (roomData.type === 'polygon' || roomData.type === 'corridor') {
            this.clearRoom();
            if (roomData.type === 'polygon') {
                this.createPolygonCategoryRoom(roomData);
            } else {
                this.createCorridorCategoryRoom(roomData);
            }
        }
    }

    createPolygonCategoryRoom(room) {
        const sides = room.posts.length;
        const radius = Math.max(4, sides * 0.8);
        
        const floor = document.createElement('a-cylinder');
        floor.setAttribute('position', `0 0.01 0`);
        floor.setAttribute('radius', radius);
        floor.setAttribute('height', '0.02');
        floor.setAttribute('color', '#CCC');
        this.roomContainer.appendChild(floor);
        room.elements.push(floor);

        const floorLabel = document.createElement('a-text');
        floorLabel.setAttribute('value', room.label);
        floorLabel.setAttribute('rotation', '-90 0 0');
        floorLabel.setAttribute('position', `0 0.03 0`);
        floorLabel.setAttribute('align', 'center');
        floorLabel.setAttribute('width', '12');
        floorLabel.setAttribute('color', '#888');
        this.roomContainer.appendChild(floorLabel);
        room.elements.push(floorLabel);

        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const nextAngle = ((i + 1) / sides) * Math.PI * 2;
            
            const wallLength = 2 * radius * Math.sin(Math.PI / sides);
            const wallAngle = (angle + nextAngle) / 2;
            const wallDistance = radius - 0.1;
            
            const wall = document.createElement('a-box');
            wall.setAttribute('position', {
                x: Math.cos(wallAngle) * wallDistance,
                y: 2,
                z: Math.sin(wallAngle) * wallDistance
            });
            wall.setAttribute('rotation', `0 ${90 - (wallAngle * 180 / Math.PI)} 0`);
            wall.setAttribute('width', wallLength);
            wall.setAttribute('height', '4');
            wall.setAttribute('depth', '0.2');
            wall.setAttribute('color', '#AAA');
            this.roomContainer.appendChild(wall);
            room.elements.push(wall);
        }

        room.posts.forEach((post, index) => {
            const angle = (index / sides) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            const postRoom = this.createPostRoom({
                post: post,
                parentRoom: room.id
            });
            this.navigation.registerRoom(postRoom.id, postRoom);

            const doorway = this.createDoorway({
                title: post.title,
                position: { x, y: 0, z },
                rotation: { x: 0, y: (angle * 180 / Math.PI) + 180, z: 0 },
                targetRoom: postRoom.id,
                entrancePosition: { x: 0, y: 0, z: 3 }
            });
            this.roomContainer.appendChild(doorway);
            room.elements.push(doorway);
        });
    }

    createCorridorCategoryRoom(room) {
        const posts = room.posts;
        const corridorLength = Math.max(10, posts.length * 2);
        
        const floor = document.createElement('a-box');
        floor.setAttribute('position', `0 0.01 -${corridorLength / 2}`);
        floor.setAttribute('width', '4');
        floor.setAttribute('height', '0.02');
        floor.setAttribute('depth', corridorLength);
        floor.setAttribute('color', '#CCC');
        this.roomContainer.appendChild(floor);
        room.elements.push(floor);

        const floorLabel = document.createElement('a-text');
        floorLabel.setAttribute('value', room.label);
        floorLabel.setAttribute('rotation', '-90 0 0');
        floorLabel.setAttribute('position', `0 0.03 -${corridorLength / 2 + 1}`);
        floorLabel.setAttribute('align', 'center');
        floorLabel.setAttribute('width', '12');
        floorLabel.setAttribute('color', '#888');
        this.roomContainer.appendChild(floorLabel);
        room.elements.push(floorLabel);

        const leftWall = document.createElement('a-box');
        leftWall.setAttribute('position', `-2 2 -${corridorLength / 2}`);
        leftWall.setAttribute('width', '0.2');
        leftWall.setAttribute('height', '4');
        leftWall.setAttribute('depth', corridorLength);
        leftWall.setAttribute('color', '#888');
        this.roomContainer.appendChild(leftWall);
        room.elements.push(leftWall);

        const rightWall = document.createElement('a-box');
        rightWall.setAttribute('position', `2 2 -${corridorLength / 2}`);
        rightWall.setAttribute('width', '0.2');
        rightWall.setAttribute('height', '4');
        rightWall.setAttribute('depth', corridorLength);
        rightWall.setAttribute('color', '#888');
        this.roomContainer.appendChild(rightWall);
        room.elements.push(rightWall);

        posts.forEach((post, index) => {
            const isLeft = index % 2 === 0;
            const rowIndex = Math.floor(index / 2);
            const z = -3 - (rowIndex * 4);
            const x = isLeft ? -2.5 : 2.5;
            
            const postRoom = this.createPostRoom({
                post: post,
                parentRoom: room.id
            });
            this.navigation.registerRoom(postRoom.id, postRoom);

            const doorway = this.createDoorway({
                title: post.title,
                position: { x, y: 0, z },
                rotation: { x: 0, y: isLeft ? 90 : -90, z: 0 },
                targetRoom: postRoom.id,
                entrancePosition: { x: 0, y: 0, z: 3 }
            });
            this.roomContainer.appendChild(doorway);
            room.elements.push(doorway);
        });
    }

    loadPostRoomContent(room) {
        this.clearRoom();
        const post = room.post;
        
        const floor = document.createElement('a-box');
        floor.setAttribute('position', '0 0.01 -3');
        floor.setAttribute('width', '6');
        floor.setAttribute('height', '0.02');
        floor.setAttribute('depth', '10');
        floor.setAttribute('color', '#CCC');
        this.roomContainer.appendChild(floor);
        room.elements.push(floor);

        const floorLabel = document.createElement('a-text');
        floorLabel.setAttribute('value', post.title);
        floorLabel.setAttribute('rotation', '-90 0 0');
        floorLabel.setAttribute('position', '0 0.03 0');
        floorLabel.setAttribute('align', 'center');
        floorLabel.setAttribute('width', '15');
        floorLabel.setAttribute('color', '#888');
        this.roomContainer.appendChild(floorLabel);
        room.elements.push(floorLabel);

        const corridor = document.createElement('a-box');
        corridor.setAttribute('position', '0 1.5 1.5');
        corridor.setAttribute('width', '2');
        corridor.setAttribute('height', '3');
        corridor.setAttribute('depth', '3');
        corridor.setAttribute('color', '#888');
        this.roomContainer.appendChild(corridor);
        room.elements.push(corridor);

        const backWall = document.createElement('a-plane');
        backWall.setAttribute('position', '0 1.6 -4');
        backWall.setAttribute('rotation', '0 0 0');
        backWall.setAttribute('width', '5');
        backWall.setAttribute('height', '3');
        backWall.setAttribute('color', '#FFF');
        this.roomContainer.appendChild(backWall);
        room.elements.push(backWall);

        const titleText = document.createElement('a-text');
        titleText.setAttribute('value', post.title);
        titleText.setAttribute('position', '0 2.8 -3.95');
        titleText.setAttribute('align', 'center');
        titleText.setAttribute('width', '8');
        titleText.setAttribute('color', '#333');
        this.roomContainer.appendChild(titleText);
        room.elements.push(titleText);

        const dateText = document.createElement('a-text');
        dateText.setAttribute('value', post.date);
        dateText.setAttribute('position', '0 2.4 -3.95');
        dateText.setAttribute('align', 'center');
        dateText.setAttribute('width', '4');
        dateText.setAttribute('color', '#888');
        this.roomContainer.appendChild(dateText);
        room.elements.push(dateText);

        const excerptText = document.createElement('a-text');
        excerptText.setAttribute('value', post.excerpt);
        excerptText.setAttribute('position', '0 1.8 -3.95');
        excerptText.setAttribute('align', 'center');
        excerptText.setAttribute('width', '6');
        excerptText.setAttribute('color', '#555');
        excerptText.setAttribute('wrap-count', '40');
        this.roomContainer.appendChild(excerptText);
        room.elements.push(excerptText);

        if (post.image) {
            const imageEntity = document.createElement('a-image');
            imageEntity.setAttribute('src', post.image);
            imageEntity.setAttribute('position', '0 1 -5.5');
            imageEntity.setAttribute('width', '4');
            imageEntity.setAttribute('height', '2');
            imageEntity.setAttribute('opacity', '0');
            imageEntity.addEventListener('loaded', () => {
                imageEntity.setAttribute('animation', {
                    property: 'opacity',
                    to: '1',
                    dur: '500'
                });
            });
            this.roomContainer.appendChild(imageEntity);
            room.elements.push(imageEntity);

            const hoverImage1 = document.createElement('a-image');
            hoverImage1.setAttribute('src', post.image);
            hoverImage1.setAttribute('position', '-3 2 -2');
            hoverImage1.setAttribute('rotation', '0 45 0');
            hoverImage1.setAttribute('width', '1.5');
            hoverImage1.setAttribute('height', '1');
            hoverImage1.setAttribute('opacity', '0');
            hoverImage1.addEventListener('loaded', () => {
                hoverImage1.setAttribute('animation', {
                    property: 'opacity',
                    to: '0.8',
                    dur: '800'
                });
            });
            this.roomContainer.appendChild(hoverImage1);
            room.elements.push(hoverImage1);

            const hoverImage2 = document.createElement('a-image');
            hoverImage2.setAttribute('src', post.image);
            hoverImage2.setAttribute('position', '3 1.5 -3');
            hoverImage2.setAttribute('rotation', '0 -30 10');
            hoverImage2.setAttribute('width', '1.2');
            hoverImage2.setAttribute('height', '0.8');
            hoverImage2.setAttribute('opacity', '0');
            hoverImage2.addEventListener('loaded', () => {
                hoverImage2.setAttribute('animation', {
                    property: 'opacity',
                    to: '0.7',
                    dur: '1000'
                });
            });
            this.roomContainer.appendChild(hoverImage2);
            room.elements.push(hoverImage2);
        }

        const sideWall1 = document.createElement('a-plane');
        sideWall1.setAttribute('position', '-3 1.6 -3');
        sideWall1.setAttribute('rotation', '0 90 0');
        sideWall1.setAttribute('width', '6');
        sideWall1.setAttribute('height', '3');
        sideWall1.setAttribute('color', '#DDD');
        this.roomContainer.appendChild(sideWall1);
        room.elements.push(sideWall1);

        const sideWall2 = document.createElement('a-plane');
        sideWall2.setAttribute('position', '3 1.6 -3');
        sideWall2.setAttribute('rotation', '0 -90 0');
        sideWall2.setAttribute('width', '6');
        sideWall2.setAttribute('height', '3');
        sideWall2.setAttribute('color', '#DDD');
        this.roomContainer.appendChild(sideWall2);
        room.elements.push(sideWall2);
    }

    createPanel(options) {
        const { type, title, subtitle, position, rotation, targetRoom, entrancePosition } = options;
        
        const panel = document.createElement('a-entity');
        panel.setAttribute('class', 'clickable');
        panel.setAttribute('position', position);
        panel.setAttribute('rotation', rotation);
        
        const plane = document.createElement('a-plane');
        plane.setAttribute('width', '2');
        plane.setAttribute('height', '1.2');
        plane.setAttribute('color', type === 'category' ? '#4A90D9' : '#FFF');
        plane.setAttribute('class', 'clickable');
        panel.appendChild(plane);
        
        const titleEntity = document.createElement('a-text');
        titleEntity.setAttribute('value', title);
        titleEntity.setAttribute('position', '0 0.3 0.01');
        titleEntity.setAttribute('align', 'center');
        titleEntity.setAttribute('width', '4');
        titleEntity.setAttribute('color', type === 'category' ? '#FFF' : '#333');
        panel.appendChild(titleEntity);
        
        const subtitleEntity = document.createElement('a-text');
        subtitleEntity.setAttribute('value', subtitle);
        subtitleEntity.setAttribute('position', '0 0 0.01');
        subtitleEntity.setAttribute('align', 'center');
        subtitleEntity.setAttribute('width', '3');
        subtitleEntity.setAttribute('color', type === 'category' ? '#DDD' : '#666');
        panel.appendChild(subtitleEntity);

        panel.addEventListener('click', () => {
            this.navigation.navigateTo(targetRoom, entrancePosition);
        });

        return panel;
    }

    createDoorway(options) {
        const { title, position, rotation, targetRoom, entrancePosition } = options;
        
        const doorway = document.createElement('a-entity');
        doorway.setAttribute('class', 'clickable');
        doorway.setAttribute('position', position);
        doorway.setAttribute('rotation', rotation);
        
        const frame = document.createElement('a-box');
        frame.setAttribute('width', '2');
        frame.setAttribute('height', '3');
        frame.setAttribute('depth', '0.3');
        frame.setAttribute('color', '#8B7355');
        doorway.appendChild(frame);
        
        const opening = document.createElement('a-box');
        opening.setAttribute('width', '1.4');
        opening.setAttribute('height', '2.4');
        opening.setAttribute('depth', '0.35');
        opening.setAttribute('color', '#222');
        opening.setAttribute('position', '0 -0.1 0');
        doorway.appendChild(opening);
        
        const titleEntity = document.createElement('a-text');
        titleEntity.setAttribute('value', title.length > 25 ? title.substring(0, 25) + '...' : title);
        titleEntity.setAttribute('position', '0 1.8 0.2');
        titleEntity.setAttribute('align', 'center');
        titleEntity.setAttribute('width', '3');
        titleEntity.setAttribute('color', '#333');
        doorway.appendChild(titleEntity);

        doorway.addEventListener('click', () => {
            this.navigation.navigateTo(targetRoom, entrancePosition);
        });

        return doorway;
    }

    clearRoom() {
        while (this.roomContainer.firstChild) {
            this.roomContainer.removeChild(this.roomContainer.firstChild);
        }
    }
}

export { RoomGenerator };
