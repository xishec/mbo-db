import { contextBridge } from "electron";
contextBridge.exposeInMainWorld("electron", {
  // Add any Electron APIs you want to expose to the renderer process here
  platform: process.platform
});
