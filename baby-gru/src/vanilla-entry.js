import React from 'react';
import { createRoot } from 'react-dom/client';
// CHANGE 1: Use the correct component path (usually in 'components' but likely named differently or inside a folder)
// If MoorhenContainer doesn't exist, try 'MoorhenApp' or check src/components/
import { MoorhenContainer } from './components/MoorhenContainer'; 

// CHANGE 2: Moorhen usually exports the store from 'store/MoorhenReduxStore' or just 'store'
import store from './store/MoorhenReduxStore';

import { Provider } from 'react-redux';

// This class will be available globally as "MoorhenWrapper"
export class MoorhenWrapper {
    constructor(urlPrefix) {
        this.urlPrefix = urlPrefix || '.';
        this.rootId = null;
        this.root = null;
    }

    setRootId(rootId) {
        this.rootId = rootId;
    }

    start() {
        if (!this.rootId) {
            console.error("MoorhenWrapper: rootId is not set.");
            return;
        }
        
        const container = document.getElementById(this.rootId);
        if (!container) {
            console.error(`MoorhenWrapper: Element with id ${this.rootId} not found.`);
            return;
        }

        this.root = createRoot(container);
        
        // Mount the React App
        this.root.render(
            <Provider store={store}>
                <MoorhenContainer 
                    urlPrefix={this.urlPrefix} 
                    // Pass other props here if your modified version needs them
                />
            </Provider>
        );
    }
}

// Expose it to the global window object
window.moorhen = {
    MoorhenWrapper: MoorhenWrapper
};