"use strict";
/**
 * Meowstik Desktop Agent
 *
 * This agent runs on the user's computer and provides:
 * 1. Screen capture - Captures desktop framebuffer and streams to relay
 * 2. Audio capture - Captures system audio and streams to relay
 * 3. Input injection - Receives mouse/keyboard events from relay and injects them
 * 4. WebSocket connection - Maintains persistent connection to Meowstik relay
 *
 * Data Flow:
 * - Desktop → Agent → Relay → [LLM Vision + User Browser]
 * - [LLM Commands + User Commands] → Relay → Agent → Desktop Input
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopAgent = void 0;
var ws_1 = require("ws");
var os = require("os");
var DesktopAgent = /** @class */ (function () {
    function DesktopAgent(config) {
        this.ws = null;
        this.captureInterval = null;
        this.reconnectTimeout = null;
        this.isConnected = false;
        this.frameCount = 0;
        this.config = config;
    }
    DesktopAgent.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('🐱 Meowstik Desktop Agent starting...');
                        console.log("\uD83D\uDCE1 Connecting to relay: ".concat(this.config.relayUrl));
                        return [4 /*yield*/, this.connect()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    DesktopAgent.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var headers;
            var _this = this;
            return __generator(this, function (_a) {
                try {
                    headers = {};
                    // Only add Authorization header if token is provided
                    if (this.config.token) {
                        headers['Authorization'] = "Bearer ".concat(this.config.token);
                    }
                    this.ws = new ws_1.default(this.config.relayUrl, {
                        headers: headers,
                    });
                    this.ws.on('open', function () { return _this.onConnected(); });
                    this.ws.on('message', function (data) { return _this.onMessage(data); });
                    this.ws.on('close', function () { return _this.onDisconnected(); });
                    this.ws.on('error', function (err) { return _this.onError(err); });
                }
                catch (error) {
                    console.error('Connection failed:', error);
                    this.scheduleReconnect();
                }
                return [2 /*return*/];
            });
        });
    };
    DesktopAgent.prototype.onConnected = function () {
        return __awaiter(this, void 0, void 0, function () {
            var systemInfo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.isConnected = true;
                        console.log('✅ Connected to relay');
                        return [4 /*yield*/, this.getSystemInfo()];
                    case 1:
                        systemInfo = _a.sent();
                        this.send({ type: 'register', data: systemInfo });
                        this.startScreenCapture();
                        return [2 /*return*/];
                }
            });
        });
    };
    DesktopAgent.prototype.onDisconnected = function () {
        this.isConnected = false;
        console.log('❌ Disconnected from relay');
        this.stopScreenCapture();
        this.scheduleReconnect();
    };
    DesktopAgent.prototype.onError = function (error) {
        console.error('WebSocket error:', error.message);
    };
    DesktopAgent.prototype.onMessage = function (data) {
        try {
            var message = JSON.parse(data.toString());
            switch (message.type) {
                case 'input':
                    this.handleInputEvent(message.data);
                    break;
                case 'ping':
                    this.send({ type: 'pong' });
                    break;
                case 'config':
                    this.updateConfig(message.data);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        }
        catch (error) {
            console.error('Failed to parse message:', error);
        }
    };
    DesktopAgent.prototype.handleInputEvent = function (event) {
        console.log("\uD83C\uDFAE Input event: ".concat(event.type, " - ").concat(event.action));
        // NOTE: robotjs integration would go here for actual input injection
        // This is a placeholder for the actual implementation
        switch (event.type) {
            case 'mouse':
                if (event.action === 'move' && event.x !== undefined && event.y !== undefined) {
                    // robot.moveMouse(event.x, event.y);
                    console.log("  Mouse move to (".concat(event.x, ", ").concat(event.y, ")"));
                }
                else if (event.action === 'click') {
                    // robot.mouseClick(event.button || 'left');
                    console.log("  Mouse click: ".concat(event.button || 'left'));
                }
                else if (event.action === 'scroll' && event.delta !== undefined) {
                    // robot.scrollMouse(0, event.delta);
                    console.log("  Mouse scroll: ".concat(event.delta));
                }
                break;
            case 'keyboard':
                if (event.action === 'type' && event.text) {
                    // robot.typeString(event.text);
                    console.log("  Type: \"".concat(event.text, "\""));
                }
                else if (event.action === 'keydown' && event.key) {
                    // robot.keyToggle(event.key, 'down');
                    console.log("  Key down: ".concat(event.key));
                }
                else if (event.action === 'keyup' && event.key) {
                    // robot.keyToggle(event.key, 'up');
                    console.log("  Key up: ".concat(event.key));
                }
                break;
        }
    };
    DesktopAgent.prototype.startScreenCapture = function () {
        var _this = this;
        console.log("\uD83D\uDCF8 Starting screen capture (interval: ".concat(this.config.captureInterval, "ms)"));
        this.captureInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var frame, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.captureScreen()];
                    case 1:
                        frame = _a.sent();
                        this.send({ type: 'frame', data: frame });
                        this.frameCount++;
                        if (this.frameCount % 30 === 0) {
                            console.log("\uD83D\uDCCA Frames sent: ".concat(this.frameCount));
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Screen capture failed:', error_1);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, this.config.captureInterval);
    };
    DesktopAgent.prototype.stopScreenCapture = function () {
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
    };
    DesktopAgent.prototype.captureScreen = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // NOTE: screenshot-desktop integration would go here
                // This is a placeholder that returns mock data
                return [2 /*return*/, {
                        timestamp: Date.now(),
                        width: 1920,
                        height: 1080,
                        data: '', // Base64 encoded JPEG/PNG would go here
                    }];
            });
        });
    };
    DesktopAgent.prototype.getSystemInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, {
                        hostname: os.hostname(),
                        platform: os.platform(),
                        arch: os.arch(),
                        cpus: os.cpus().length,
                        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
                        screens: [{ width: 1920, height: 1080 }], // Would use systeminformation here
                    }];
            });
        });
    };
    DesktopAgent.prototype.updateConfig = function (newConfig) {
        if (newConfig.captureInterval && newConfig.captureInterval !== this.config.captureInterval) {
            this.config.captureInterval = newConfig.captureInterval;
            this.stopScreenCapture();
            this.startScreenCapture();
        }
        if (newConfig.quality) {
            this.config.quality = newConfig.quality;
        }
        console.log('⚙️ Config updated:', newConfig);
    };
    DesktopAgent.prototype.scheduleReconnect = function () {
        var _this = this;
        if (this.reconnectTimeout)
            return;
        console.log('🔄 Scheduling reconnect in 5 seconds...');
        this.reconnectTimeout = setTimeout(function () {
            _this.reconnectTimeout = null;
            _this.connect();
        }, 5000);
    };
    DesktopAgent.prototype.send = function (message) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify(message));
        }
    };
    DesktopAgent.prototype.stop = function () {
        console.log('🛑 Stopping agent...');
        this.stopScreenCapture();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        if (this.ws) {
            this.ws.close();
        }
    };
    return DesktopAgent;
}());
exports.DesktopAgent = DesktopAgent;
// CLI Entry Point
if (require.main === module) {
    var args = process.argv.slice(2);
    var tokenIndex = args.indexOf('--token');
    var urlIndex = args.indexOf('--relay');
    var token = tokenIndex !== -1 ? args[tokenIndex + 1] : process.env.MEOWSTIK_TOKEN || '';
    var relayUrl = urlIndex !== -1 ? args[urlIndex + 1] : process.env.MEOWSTIK_RELAY || 'wss://your-meowstik-instance.replit.app/ws/desktop';
    // Check if connecting to localhost
    var isLocalhost = relayUrl.includes('localhost') || relayUrl.includes('127.0.0.1');
    if (!token && !isLocalhost) {
        console.error('❌ Error: --token is required for non-localhost connections');
        console.error('Usage: meowstik-agent --token YOUR_TOKEN [--relay wss://...]');
        console.error('');
        console.error('For local development, you can omit --token when connecting to localhost:');
        console.error('  meowstik-agent --relay ws://localhost:5000/ws/desktop');
        process.exit(1);
    }
    if (!token && isLocalhost) {
        console.log('🔓 Development Mode: Connecting to localhost without token');
    }
    var agent_1 = new DesktopAgent({
        relayUrl: relayUrl,
        token: token || undefined,
        captureInterval: 100, // 10 FPS
        quality: 80,
    });
    process.on('SIGINT', function () {
        agent_1.stop();
        process.exit(0);
    });
    process.on('SIGTERM', function () {
        agent_1.stop();
        process.exit(0);
    });
    agent_1.start().catch(function (error) {
        console.error('Failed to start agent:', error);
        process.exit(1);
    });
}
