import React, { useRef } from 'react';
import { Provider } from 'react-redux';
import { MoorhenContainer } from './components/MoorhenContainer';
import store from './store/MoorhenReduxStore';
import { useUrlMoleculeLoader } from './UserCustomHooks';

function App() {
  const glRef = useRef(null);
  const commandCentreRef = useRef(null);
  const moleculesRef = useRef(null);
  
  // FIXED: Removed 'moleculesRef' from this object
  useUrlMoleculeLoader({
      commandCentre: commandCentreRef,
      glRef: glRef,
      monomerLibraryPath: "./baby-gru/monomers"
  });

  return (
    <div className="App">
      <Provider store={store}>
          <MoorhenContainer 
              glRef={glRef}
              commandCentre={commandCentreRef}
              moleculesRef={moleculesRef}
          />
      </Provider>
    </div>
  );
}

export default App;