// Global type declarations for browser environment

// D3 is loaded globally via CDN
import * as D3 from "d3";
declare global {
    const d3: typeof D3;
}

export {};
