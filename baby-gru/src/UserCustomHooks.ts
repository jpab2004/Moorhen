import { useEffect, useRef } from 'react';
import { MoorhenMolecule } from './utils/MoorhenMolecule';
import { MoorhenMap } from './utils/MoorhenMap';
import store from './store/MoorhenReduxStore';
import { addMolecule } from './store/moleculesSlice';
import { addMap } from './store/mapsSlice';

interface CustomHookProps {
    commandCentre: React.RefObject<any>;
    glRef: React.RefObject<any>;
    monomerLibraryPath?: string;
}

// --- HELPERS ---

// Convert "data/*.pdb" -> Regex
const globToRegex = (glob: string) => {
    const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&'); 
    const pattern = escaped.replace(/\*/g, '.*');
    return new RegExp(`^${pattern}$`, 'i'); 
};

// Parse "C1" -> CID String "//C/1"
// Parse "A-10" -> CID String "//A/-10"
const parseCenterParamToCid = (param: string) => {
    // Regex matches Chain (letters) + Residue (digits, optionally negative)
    const match = param.match(/^([a-zA-Z]+)(-?\d+)$/);
    if (match) {
        const chainId = match[1];
        const resNum = match[2];
        return `//${chainId}/${resNum}`; // Construct standard CID
    }
    return null;
};

// Resolves wildcards (*.pdb) and comma lists into real URLs
const resolveFileUrls = async (param: string): Promise<string[]> => {
    if (!param) return [];
    
    let resolvedFiles: string[] = [];
    const initialList = param.split(',').map(s => s.trim());

    for (const item of initialList) {
        const [cleanPath, flag] = item.split('|'); 

        if (cleanPath.includes('*')) {
            try {
                const listResp = await fetch('/files.json');
                if (!listResp.ok) {
                    console.error(`[CustomHook] ❌ Failed to fetch /files.json`);
                    continue;
                }
                const allFiles: string[] = await listResp.json();
                const regex = globToRegex(cleanPath);
                
                const matches = allFiles.filter(file => regex.test(file));
                const matchesWithFlags = flag ? matches.map(m => `${m}|${flag}`) : matches;
                
                resolvedFiles = [...resolvedFiles, ...matchesWithFlags];
            } catch (err) {
                console.error("[CustomHook] Wildcard error:", err);
            }
        } else {
            resolvedFiles.push(item);
        }
    }
    return resolvedFiles;
};

// --- MAIN HOOK ---

export const useUrlMoleculeLoader = (props: CustomHookProps) => {
    const { commandCentre, glRef, monomerLibraryPath = "./baby-gru/monomers" } = props;
    const loadedRef = useRef(false);

    useEffect(() => {
        const loadContent = async () => {
            if (!commandCentre.current || !glRef.current || loadedRef.current) return;

            const urlParams = new URLSearchParams(window.location.search);
            const molParam = urlParams.get('molecule');
            const mapParam = urlParams.get('map');
            const centerParam = urlParams.get('center'); // e.g. "C1"

            if (molParam || mapParam) {
                loadedRef.current = true;
                
                const moleculeUrls = await resolveFileUrls(molParam || "");
                const mapUrls = await resolveFileUrls(mapParam || "");
                
                let lastLoadedMolecule: any = null;

                // 1. LOAD MOLECULES
                for (const url of moleculeUrls) {
                    try {
                        console.log(`[CustomHook] 🧬 Fetching PDB: ${url}`);
                        const response = await fetch(url);
                        if (!response.ok) continue;
                        
                        const pdbData = await response.text();
                        if (pdbData.trim().startsWith("<")) continue;

                        const newMolecule = new MoorhenMolecule(commandCentre, glRef, store, monomerLibraryPath);
                        await newMolecule.loadToCootFromString(pdbData, url);
                        await newMolecule.fetchIfDirtyAndDraw('CBs');
                        
                        store.dispatch(addMolecule(newMolecule));
                        lastLoadedMolecule = newMolecule; // Track the last one
                        console.log(`[CustomHook] ✅ Loaded PDB: ${url}`);
                    } catch (error) {
                        console.error(`[CustomHook] Error loading PDB ${url}:`, error);
                    }
                }

                // 2. LOAD MAPS
                for (const itemString of mapUrls) {
                    try {
                        const [url, flag] = itemString.split('|');
                        const isExplicitDiff = flag === 'diff';
                        const isImplicitDiff = url.toLowerCase().includes('diff') || url.toLowerCase().includes('fofc');
                        const isDifferenceMap = isExplicitDiff || isImplicitDiff;

                        const extension = url.split('.').pop()?.toLowerCase();
                        const response = await fetch(url);
                        if (!response.ok) continue;

                        const newMap = new MoorhenMap(commandCentre, glRef, store);

                        // --- MTZ HANDLING ---
                        if (extension === 'mtz') {
                            console.log(`[CustomHook] 📉 Processing MTZ: ${url} (Diff: ${isDifferenceMap})`);
                            const selectedColumns = isDifferenceMap 
                                ? { 
                                    F: "mFo-DFc_polder", Fobs: "mFo-DFc_polder", FreeR: "", 
                                    PHI: "PHImFo-DFc_polder", SigFobs: "", 
                                    Weight: "", 
                                    calcStructFact: false, isDifference: true, useWeight: false 
                                  }
                                : { 
                                    F: "mFo-DFc_polder", Fobs: "mFo-DFc_polder", FreeR: "", 
                                    PHI: "PHImFo-DFc_polder", SigFobs: "", 
                                    Weight: "", 
                                    calcStructFact: false, isDifference: false, useWeight: false 
                                  };

                            await newMap.loadToCootFromMtzURL(url, "URL-MTZ", selectedColumns);
                        } 
                        // --- STANDARD MAP HANDLING ---
                        else {
                            console.log(`[CustomHook] 🗺️ Processing Map: ${url}`);
                            await newMap.loadToCootFromMapURL(url, "URL-Map", isDifferenceMap);
                        }
                        
                        store.dispatch(addMap(newMap));
                    } catch (error) {
                        console.error(`[CustomHook] Error loading Map ${itemString}:`, error);
                    }
                }

                // 3. CENTERING LOGIC (Updated to use molecule.centreOn with CID)
                if (lastLoadedMolecule) {
                    setTimeout(async () => {
                        if (centerParam) {
                            // Convert "C1" -> "//C/1"
                            const cid = parseCenterParamToCid(centerParam);
                            
                            if (cid) {
                                console.log(`[CustomHook] 🎯 Centering on CID: ${cid}`);
                                // Verify validity first (optional but good practice, as seen in the snackbar code)
                                const isValid = await lastLoadedMolecule.isValidSelection(cid);
                                
                                if (isValid) {
                                    // The magic method from MoorhenGoToResidueSnackbar.tsx
                                    // centreOn(selectionString, animate, setOrigin)
                                    await lastLoadedMolecule.centreOn(cid, true, true);
                                } else {
                                    console.warn(`[CustomHook] ⚠️ Selection ${cid} is invalid for this molecule.`);
                                    // Fallback to center of molecule
                                    await lastLoadedMolecule.centreOn();
                                }
                            } else {
                                console.warn(`[CustomHook] ⚠️ Invalid center format '${centerParam}'. Expected 'C1'.`);
                                await lastLoadedMolecule.centreOn();
                            }
                        } else {
                            // Default: Center on the whole molecule
                            console.log(`[CustomHook] 🎯 Centering on last molecule.`);
                            await lastLoadedMolecule.centreOn();
                        }
                    }, 500);
                }
            }
        };

        const timer = setTimeout(loadContent, 2000);
        return () => clearTimeout(timer);

    }, [commandCentre, glRef, monomerLibraryPath]);
};