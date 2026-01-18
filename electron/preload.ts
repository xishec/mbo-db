import { contextBridge } from "electron";

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  // Add any Electron APIs you want to expose to the renderer process here
  platform: process.platform,
});

export {};
