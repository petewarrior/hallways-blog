import { parseContent } from './src/content-parser.js';
import { HallwayLoader } from './src/hallway-loader.js';
import { Navigation } from './src/navigation.js';
import { PostCanvas } from './src/post-canvas.js';
import { RoomGenerator } from './src/room-generator.js';

class BlogApp {
    constructor() {
        this.posts = [];
        this.currentPost = null;
        this.scene = document.getElementById('scene');
        this.rig = document.getElementById('rig');
        this.camera = document.getElementById('camera');
        this.lobbyContainer = document.getElementById('lobby-container');
        this.hallwayContainer = document.getElementById('hallway-container');
        this.roomContainer = document.getElementById('room-container');
        this.backButton = document.getElementById('back-button');
        this.roomLabel = document.getElementById('room-label');
    }

    async init() {
        await this.waitForScene();
        const result = await parseContent('content/posts');
        this.posts = result.posts;

        this.roomGenerator = new RoomGenerator({
            lobbyContainer: this.lobbyContainer,
            roomContainer: this.roomContainer
        });
        const doorways = this.roomGenerator.createLobby(this.posts);
        this.hallwayLoader = new HallwayLoader({
            rig: this.rig,
            container: this.hallwayContainer
        });
        this.postCanvas = new PostCanvas({
            canvas: document.getElementById('post-canvas'),
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
            onEnterPost: (post, doorway) => this.beginPost(post, doorway),
            onReturnToLobby: () => this.returnToLobby()
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
        const noun = this.posts.length === 1 ? 'post' : 'posts';
        return `Lobby - ${this.posts.length} ${noun}`;
    }

    async beginPost(post, doorway) {
        this.currentPost = post;
        this.roomLabel.textContent = post.title;
        this.backButton.classList.remove('hidden');
        this.roomGenerator.setLobbyVisible(false);
        this.hallwayLoader.start(doorway);

        try {
            await this.postCanvas.prepare(post);
        } catch (error) {
            if (this.currentPost !== post) return;
            console.error('Failed to prepare post canvas:', error);
            this.roomLabel.textContent = `${post.title} - image unavailable`;
        }

        if (this.currentPost !== post) return;
        const corridorEnd = this.hallwayLoader.completeLoading();
        this.navigation.setCorridorEnd(corridorEnd);
        this.roomGenerator.createReadingRoom(post, corridorEnd);
    }

    returnToLobby() {
        this.currentPost = null;
        this.hallwayLoader.stop();
        this.roomGenerator.clearReadingRoom();
        this.roomGenerator.setLobbyVisible(true);
        this.postCanvas.clear();
        this.backButton.classList.add('hidden');
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