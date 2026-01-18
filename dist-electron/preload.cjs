var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
const { contextBridge  } = require("electron");
var require_preload = __commonJS({
  "preload.cjs"() {
    contextBridge.exposeInMainWorld("electron", {
      // Add any Electron APIs you want to expose to the renderer process here
      platform: process.platform
    });
  }
});
require_preload();
