import './src/post-scrollbar.js';
import { loadWordPressConfig, parseContent, parseWordPressContent } from './src/content-parser.js';
import { HallwayLoader } from './src/hallway-loader.js';
import { Navigation } from './src/navigation.js';
import { PostCanvas } from './src/post-canvas.js';
import { RoomGenerator } from './src/room-generator.js';

class BlogApp {
    constructor() {
        this.posts = [];
        this.categories = [];
        this.currentCategory = null;
        this.pendingCategory = null;
        this.mainLobbyData = null;
        this.categoryLobbyData = null;
        this.categoryLobbyPosition = null;
        this.categoryEntryDoorway = null;
        this.contentSource = 'markdown';
        this.wordpressConfig = null;
        this.currentPost = null;
        this.scene = document.getElementById('scene');
        this.rig = document.getElementById('rig');
        this.camera = document.getElementById('camera');
        this.lobbyContainer = document.getElementById('lobby-container');
        this.categoryLobbyContainer = document.getElementById('category-lobby-container');
        this.hallwayContainer = document.getElementById('hallway-container');
        this.roomContainer = document.getElementById('room-container');
        this.backButton = document.getElementById('back-button');
        this.roomLabel = document.getElementById('room-label');
    }

    async init() {
        await this.waitForScene();
        const configResponse = await fetch('content/config.json');
        if (!configResponse.ok) throw new Error(`Failed to load content config: ${configResponse.status}`);
        const config = await configResponse.json();
        this.contentSource = config.contentSource === 'wordpress' ? 'wordpress' : 'markdown';
        let result;
        if (this.contentSource === 'wordpress') {
            this.wordpressConfig = loadWordPressConfig();
            result = await parseWordPressContent(this.wordpressConfig);
        } else {
            result = await parseContent('content/posts');
        }
        this.posts = result.posts;
        this.categories = Array.from(result.categories.values());

        this.roomGenerator = new RoomGenerator({
            lobbyContainer: this.lobbyContainer,
            categoryLobbyContainer: this.categoryLobbyContainer,
            roomContainer: this.roomContainer
        });
        const doorways = this.roomGenerator.createLobby(
            this.contentSource === 'wordpress' ? this.categories : this.posts
        );
        this.mainLobbyData = { doorways, boundaries: this.roomGenerator.boundaries };
        this.hallwayLoader = new HallwayLoader({
            rig: this.rig,
            container: this.hallwayContainer
        });
        this.postCanvas = new PostCanvas({
            canvas: document.getElementById('post-canvas'),
            imageProxyUrl: this.wordpressConfig?.imageProxyUrl,
            onRender: () => this.roomGenerator.refreshCanvasTexture()
        });
        this.navigation = new Navigation({
            rig: this.rig,
            camera: this.camera,
            hallwayContainer: this.hallwayContainer,
            doorways,
            boundaries: this.roomGenerator.boundaries,
            onApproachPost: (_post, doorway) => this.hallwayLoader.preview(doorway),
            onCancelApproach: doorway => this.hallwayLoader.cancelPreview(doorway),
            onEnterPost: (destination, doorway) => {
                if (destination.type === 'category') {
                    this.enterCategory(destination, doorway).catch(error => {
                        console.error('Failed to prepare category lobby:', error);
                        this.navigation.setDestinationReady(true);
                        this.navigation.returnToLobby(true);
                    });
                }
                else if (destination.type === 'parent') {
                    const destinationDoorway = this.mainLobbyData.doorways.find(
                        item => item.post.id === this.categoryEntryDoorway.post.id
                    );
                    const destinationPosition = this.hallwayContainer.object3D.worldToLocal(
                        new THREE.Vector3(destinationDoorway.x, 0, destinationDoorway.z)
                    );
                    this.navigation.setCorridorEnd(this.hallwayLoader.completeLoading(destinationPosition.z));
                }
                else this.beginPost(destination, doorway);
            },
            onReachDestination: category => this.activateCategory(category),
            onReturnToLobby: direct => this.returnToLobby(direct)
        });
        this.backButton.addEventListener('click', () => this.navigation.returnToLobby(true));
        this.roomLabel.textContent = this.getLobbyLabel();
        document.body.classList.remove('is-preloading');
        document.getElementById('loading-screen').hidden = true;
    }

    async waitForScene() {
        if (!this.scene.hasLoaded) {
            await new Promise(resolve => this.scene.addEventListener('loaded', resolve, { once: true }));
        }

        const preloader = document.getElementById('hallway-preloader');
        if (preloader.getObject3D('mesh')) return;
        await new Promise((resolve, reject) => {
            const cleanup = () => {
                preloader.removeEventListener('model-loaded', onLoaded);
                preloader.removeEventListener('model-error', onError);
            };
            const onLoaded = () => {
                cleanup();
                resolve();
            };
            const onError = event => {
                cleanup();
                reject(new Error(event.detail?.message || 'Hallway model failed to load'));
            };
            preloader.addEventListener('model-loaded', onLoaded, { once: true });
            preloader.addEventListener('model-error', onError, { once: true });
            if (preloader.getObject3D('mesh')) onLoaded();
        });
    }

    getLobbyLabel() {
        if (this.currentCategory) {
            const noun = this.currentCategory.posts.length === 1 ? 'post' : 'posts';
            return `${this.currentCategory.name} - ${this.currentCategory.posts.length} ${noun}`;
        }
        if (this.contentSource === 'wordpress') {
            const noun = this.categories.length === 1 ? 'category' : 'categories';
            return `Lobby - ${this.categories.length} ${noun}`;
        }
        const noun = this.posts.length === 1 ? 'post' : 'posts';
        return `Lobby - ${this.posts.length} ${noun}`;
    }

    async enterCategory(category, doorway) {
        this.pendingCategory = category;
        this.categoryEntryDoorway = doorway;
        this.lobbyContainer.setAttribute('visible', 'false');
        this.categoryLobbyContainer.setAttribute('visible', 'false');
        this.hallwayLoader.start(doorway);
        const corridorEnd = this.hallwayLoader.prepareEnd();
        this.navigation.setCorridorEnd(corridorEnd);

        const worldRotation = this.hallwayContainer.object3D.getWorldQuaternion(new THREE.Quaternion());
        const yaw = new THREE.Euler().setFromQuaternion(worldRotation, 'YXZ').y;
        this.categoryLobbyContainer.setAttribute('rotation', `0 ${yaw * 180 / Math.PI} 0`);

        const localDoorways = this.roomGenerator.createLobby(category.posts, this.categoryLobbyContainer, {
            entrance: true,
            entranceDestination: { id: 'parent', type: 'parent', title: 'Categories' }
        });
        const positionCategoryLobby = endZ => {
            const lobbyCenter = this.hallwayContainer.object3D.localToWorld(
                new THREE.Vector3(0, 0, endZ - this.roomGenerator.lobbyApothem)
            );
            this.categoryLobbyPosition = { x: lobbyCenter.x, y: 0, z: lobbyCenter.z };
            this.categoryLobbyContainer.setAttribute('position', this.categoryLobbyPosition);
        };
        positionCategoryLobby(corridorEnd);
        this.categoryLobbyData = this.roomGenerator.getWorldLobby(
            this.categoryLobbyContainer,
            localDoorways,
            this.roomGenerator.boundaries
        );
        this.categoryLobbyContainer.setAttribute('visible', 'false');
        this.roomLabel.textContent = `Heading to ${category.name}`;
        this.backButton.textContent = '← Lobby';
        this.backButton.setAttribute('aria-label', 'Return to lobby');
        this.backButton.classList.remove('hidden');

        await this.roomGenerator.waitForEntities(this.categoryLobbyContainer);
        const finalEnd = this.hallwayLoader.completeLoading();
        this.navigation.setCorridorEnd(finalEnd);
        if (Math.abs(finalEnd - corridorEnd) > 0.001) {
            positionCategoryLobby(finalEnd);
            this.categoryLobbyData = this.roomGenerator.getWorldLobby(
                this.categoryLobbyContainer,
                localDoorways,
                this.roomGenerator.boundaries
            );
        }
        this.navigation.setDestinationReady(true);
    }

    activateCategory(category) {
        if (this.pendingCategory !== category) return;
        this.currentCategory = category;
        this.pendingCategory = null;
        this.hallwayLoader.stop();
        this.categoryLobbyContainer.setAttribute('visible', 'true');
        this.navigation.setLobby(
            this.categoryLobbyData.doorways,
            this.categoryLobbyData.boundaries,
            true
        );
        this.roomLabel.textContent = this.getLobbyLabel();
        this.backButton.textContent = '← Categories';
        this.backButton.setAttribute('aria-label', 'Return to categories');
        this.backButton.classList.remove('hidden');
    }
    async beginPost(post, doorway) {
        this.currentPost = post;
        this.roomLabel.textContent = post.title;
        this.backButton.classList.remove('hidden');
        this.backButton.textContent = this.currentCategory ? '← Category' : '← Lobby';
        this.backButton.setAttribute('aria-label', this.currentCategory ? 'Return to category' : 'Return to lobby');
        this.roomGenerator.setLobbyVisible(false);
        this.categoryLobbyContainer.setAttribute('visible', 'false');
        this.hallwayLoader.start(doorway);
        const corridorEnd = this.hallwayLoader.prepareEnd();
        this.navigation.setCorridorEnd(corridorEnd);

        try {
            await this.postCanvas.prepare(post);
        } catch (error) {
            if (this.currentPost !== post) return;
            console.error('Failed to prepare post canvas:', error);
            this.roomLabel.textContent = `${post.title} - image unavailable`;
        }

        if (this.currentPost !== post) return;
        const roomBounds = this.roomGenerator.createReadingRoom(post, corridorEnd, this.postCanvas.getImagePanels());
        this.navigation.setReadingRoom(roomBounds);
        await this.roomGenerator.waitForEntities(this.roomContainer);
    this.hallwayLoader.completeLoading(corridorEnd);
        this.navigation.setCorridorEnd(corridorEnd);
        this.navigation.setDestinationReady(true);
    }

    returnToLobby(direct = false) {
        const returnToCategory = Boolean(this.currentPost && this.currentCategory);
        this.currentPost = null;
        this.pendingCategory = null;
        this.roomGenerator.clearReadingRoom();
        this.postCanvas.clear();

        if (returnToCategory) {
            this.hallwayLoader.stop();
            this.lobbyContainer.setAttribute('visible', 'false');
            this.hallwayContainer.setAttribute('visible', 'false');
            this.categoryLobbyContainer.setAttribute('visible', 'true');
            if (direct) this.rig.setAttribute('position', this.categoryLobbyPosition);
            if (this.categoryEntryDoorway) {
                this.hallwayLoader.start(this.categoryEntryDoorway);
                this.hallwayLoader.completeLoading();
            }
            this.navigation.setLobby(
                this.categoryLobbyData.doorways,
                this.categoryLobbyData.boundaries,
                true
            );
            this.backButton.textContent = '← Categories';
            this.backButton.setAttribute('aria-label', 'Return to categories');
        } else {
            this.hallwayLoader.stop();
            this.currentCategory = null;
            this.categoryLobbyContainer.setAttribute('visible', 'false');
            this.roomGenerator.setLobbyVisible(true);
            this.navigation.setLobby(this.mainLobbyData.doorways, this.mainLobbyData.boundaries);
            if (direct) this.rig.setAttribute('position', '0 0 0');
            this.backButton.classList.add('hidden');
        }
        this.roomLabel.textContent = this.getLobbyLabel();
    }
}

const app = new BlogApp();
window.blogApp = app;
document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(error => {
        console.error('Failed to start the 3D blog:', error);
        document.getElementById('loading-status').textContent = 'Unable to load the 3D hallway';
    });
});