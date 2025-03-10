/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/main/app.ts":
/*!*************************!*\
  !*** ./src/main/app.ts ***!
  \*************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nexports.Application = void 0;\nconst game_events_service_1 = __webpack_require__(/*! ./services/game-events.service */ \"./src/main/services/game-events.service.ts\");\nclass Application {\n    constructor(gepService, mainWindowController) {\n        this.gepService = gepService;\n        this.mainWindowController = mainWindowController;\n        gepService = new game_events_service_1.GameEventsService();\n    }\n    run() {\n        this.initialize();\n    }\n    initialize() {\n        this.mainWindowController.createWindow();\n    }\n}\nexports.Application = Application;\n\n\n//# sourceURL=webpack://overwolf-api/./src/main/app.ts?");

/***/ }),

/***/ "./src/main/controllers/main-window.controller.ts":
/*!********************************************************!*\
  !*** ./src/main/controllers/main-window.controller.ts ***!
  \********************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

eval("\nvar __importDefault = (this && this.__importDefault) || function (mod) {\n    return (mod && mod.__esModule) ? mod : { \"default\": mod };\n};\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nconst electron_1 = __webpack_require__(/*! electron */ \"electron\");\nconst node_path_1 = __importDefault(__webpack_require__(/*! node:path */ \"node:path\"));\nconst owElectronApp = electron_1.app;\nclass MainWindowController {\n    constructor() {\n    }\n    createWindow() {\n        this.mainWindow = new electron_1.BrowserWindow({\n            width: 800,\n            height: 800,\n            webPreferences: {\n                preload: node_path_1.default.join(__dirname, '../renderer/preload.js')\n            }\n        });\n        //this.mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY)\n        this.mainWindow.loadFile(node_path_1.default.join(__dirname, '../renderer/index.html')).then(() => {\n            this.printLogMessage(\"main-window.controller created mainWindow.\");\n        });\n    }\n    printLogMessage(message, ...args) {\n        var _a;\n        if ((_a = this.mainWindow.isDestroyed()) !== null && _a !== void 0 ? _a : true) {\n            return;\n        }\n        this.mainWindow.webContents.send('console-message', message, ...args);\n    }\n}\nexports[\"default\"] = MainWindowController;\n\n\n//# sourceURL=webpack://overwolf-api/./src/main/controllers/main-window.controller.ts?");

/***/ }),

/***/ "./src/main/index.ts":
/*!***************************!*\
  !*** ./src/main/index.ts ***!
  \***************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

eval("\nvar __importDefault = (this && this.__importDefault) || function (mod) {\n    return (mod && mod.__esModule) ? mod : { \"default\": mod };\n};\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nconst electron_1 = __webpack_require__(/*! electron */ \"electron\");\nconst app_1 = __webpack_require__(/*! ./app */ \"./src/main/app.ts\");\nconst main_window_controller_1 = __importDefault(__webpack_require__(/*! ./controllers/main-window.controller */ \"./src/main/controllers/main-window.controller.ts\"));\nconst game_events_service_1 = __webpack_require__(/*! ./services/game-events.service */ \"./src/main/services/game-events.service.ts\");\nconst bootstrap = () => {\n    const mainWindowController = new main_window_controller_1.default();\n    const gepService = new game_events_service_1.GameEventsService();\n    gepService.on('log', mainWindowController.printLogMessage.bind(mainWindowController));\n    electron_1.app.disableHardwareAcceleration();\n    return new app_1.Application(gepService, mainWindowController);\n};\nconst app = bootstrap();\nelectron_1.app.whenReady().then(() => {\n    app.run();\n});\nelectron_1.app.on('window-all-closed', () => {\n    if (process.platform !== 'darwin') {\n        electron_1.app.quit();\n    }\n});\n\n\n//# sourceURL=webpack://overwolf-api/./src/main/index.ts?");

/***/ }),

/***/ "./src/main/services/game-events.service.ts":
/*!**************************************************!*\
  !*** ./src/main/services/game-events.service.ts ***!
  \**************************************************/
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

eval("\nvar __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {\n    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }\n    return new (P || (P = Promise))(function (resolve, reject) {\n        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }\n        function rejected(value) { try { step(generator[\"throw\"](value)); } catch (e) { reject(e); } }\n        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }\n        step((generator = generator.apply(thisArg, _arguments || [])).next());\n    });\n};\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nexports.GameEventsService = void 0;\nconst events_1 = __webpack_require__(/*! events */ \"events\");\nconst electron_1 = __webpack_require__(/*! electron */ \"electron\");\nconst app = electron_1.app;\nclass GameEventsService extends events_1.EventEmitter {\n    constructor() {\n        super();\n        this.gepGamesID = [];\n        this.activeGame = 0;\n        this.registerOverwolfPackageManager();\n    }\n    registerGames(gepGamesId) {\n        this.emit('log', `register game events for ${gepGamesId}`);\n        this.gepGamesID = gepGamesId;\n    }\n    setRequiredFeaturesForAllSuportedGames() {\n        return __awaiter(this, void 0, void 0, function* () {\n            yield Promise.all(this.gepGamesID.map((gameId) => __awaiter(this, void 0, void 0, function* () {\n                this.emit('log', `set-required-feature for: ${gameId}`);\n                yield this.gepAPI.setRequiredFeatures(gameId, undefined);\n            })));\n        });\n    }\n    registerOverwolfPackageManager() {\n        app.overwolf.packages.on('ready', (e, packageName, version) => {\n            if (packageName !== 'gep')\n                return;\n            this.emit('log', `gep ${version} package is ready `);\n            this.onGameEventsPackageReady();\n            this.emit('ready');\n        });\n    }\n    onGameEventsPackageReady() {\n        return __awaiter(this, void 0, void 0, function* () {\n            this.gepAPI = app.overwolf.packages.gep;\n            this.gepAPI.removeAllListeners();\n            this.gepAPI.on('game-detected', (e, gameId, name, gameInfo) => {\n                if (!this.gepGamesID.includes(gameId)) {\n                    this.emit('log', `gep: game ${name} is not registered.`);\n                    return;\n                }\n                this.emit('log', 'gep: register game-detected', gameId, name, gameInfo);\n                e.enable();\n                this.activeGame = gameId;\n            });\n            this.gepAPI.on('new-game-event', (e, gameId, ...args) => {\n                this.emit('log', 'new-event', gameId, ...args);\n            });\n            this.gepAPI.on('new-info-update', (e, gameId, ...args) => {\n                this.emit('log', 'info-update', gameId, ...args);\n            });\n            this.gepAPI.on('error', (e, gameId, error, ...args) => {\n                this.emit('log', 'gep-error', gameId, error, ...args);\n                this.activeGame = 0;\n            });\n        });\n    }\n}\nexports.GameEventsService = GameEventsService;\n\n\n//# sourceURL=webpack://overwolf-api/./src/main/services/game-events.service.ts?");

/***/ }),

/***/ "electron":
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
/***/ ((module) => {

module.exports = require("electron");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ "node:path":
/*!****************************!*\
  !*** external "node:path" ***!
  \****************************/
/***/ ((module) => {

module.exports = require("node:path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main/index.ts");
/******/ 	
/******/ })()
;