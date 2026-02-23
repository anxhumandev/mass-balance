import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Beaker, FileText, Settings, AlertTriangle } from 'lucide-react';

function HybridDetection({ onConfigChange }) {
    const [detectors, setDetectors] = useState({
        UV: true,     // UV-PDA is always base
        ELSD: true,   // Active by default
        MS: true,     // Active by default
        GC_MS: true   // Active by default
    });

    const [detectionConfig, setDetectionConfig] = useState({
        detection_method: 'UV + ELSD + MS + GC_MS',
        uv_rrf: 1.0,
        elsd_rrf: 1.0,
        ms_intensity: 1000000,
        gc_ms_detected: true,
        gc_ms_volatiles: 0
    });

    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        // Notify parent of config changes
        onConfigChange(detectionConfig);
    }, [detectionConfig, onConfigChange]);

    const toggleDetector = (detector) => {
        if (detector === 'UV') return; // Cannot disable UV

        const newDetectors = { ...detectors, [detector]: !detectors[detector] };
        setDetectors(newDetectors);

        // Update config based on active detectors
        const methodStr = Object.keys(newDetectors).filter(k => newDetectors[k])
            .map(k => k === 'MS' ? 'LC-MS' : k === 'GC_MS' ? 'GC-MS' : k)
            .join(' + ');

        setDetectionConfig(prev => ({
            ...prev,
            detection_method: methodStr,
            elsd_rrf: newDetectors.ELSD ? prev.elsd_rrf || 1.0 : null,
            ms_intensity: newDetectors.MS ? prev.ms_intensity || 1000000 : null,
            gc_ms_detected: newDetectors.GC_MS ? prev.gc_ms_detected : false
        }));
    };

    const handleChange = (field, value) => {
        setDetectionConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const isDetectorActive = (type) => detectors[type];

    return (
        <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Zap className="text-orange-400" size={20} />
                    Hybrid Detection Configuration
                </h3>
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300"
                >
                    <Settings size={14} />
                    {showAdvanced ? 'Hide Advanced' : 'Advanced Parameters'}
                </button>
            </div>

            {/* Detector Toggles */}
            <div className="flex flex-wrap gap-3 mb-6">
                {[
                    { id: 'UV', label: 'UV-PDA', activeClass: 'bg-blue-500/20 border-blue-500/50 text-blue-400' },
                    { id: 'ELSD', label: 'ELSD/CAD', activeClass: 'bg-green-500/20 border-green-500/50 text-green-400' },
                    { id: 'MS', label: 'LC-MS', activeClass: 'bg-violet-500/20 border-violet-500/50 text-violet-400' },
                    { id: 'GC_MS', label: 'GC-MS', activeClass: 'bg-orange-500/20 border-orange-500/50 text-orange-400' }
                ].map(detector => (
                    <button
                        key={detector.id}
                        onClick={() => toggleDetector(detector.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border ${detectors[detector.id]
                            ? detector.activeClass
                            : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:bg-slate-800'
                            }`}
                    >
                        {detector.id === 'UV' ? <Beaker size={16} /> : <Zap size={16} />}
                        {detector.label}
                    </button>
                ))}
            </div>

            {/* Advanced Parameters Input */}
            {showAdvanced && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800"
                >
                    {/* UV RRF */}
                    <div>
                        <label className="block mb-2">
                            <span className="text-sm font-medium text-slate-300 normal-case tracking-normal">UV Response Factor</span>
                            <input
                                type="number"
                                value={detectionConfig.uv_rrf}
                                onChange={(e) => handleChange('uv_rrf', parseFloat(e.target.value) || 1.0)}
                                step="0.1"
                                min="0.1"
                                max="5.0"
                                className="w-full mt-2 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                        </label>
                    </div>

                    {/* ELSD RRF */}
                    {isDetectorActive('ELSD') && (
                        <div>
                            <label className="block mb-2">
                                <span className="text-sm font-medium text-slate-300 normal-case tracking-normal">ELSD Response Factor</span>
                                <input
                                    type="number"
                                    value={detectionConfig.elsd_rrf || ''}
                                    onChange={(e) => handleChange('elsd_rrf', parseFloat(e.target.value) || null)}
                                    placeholder="e.g., 1.2"
                                    step="0.1"
                                    min="0.1"
                                    max="10.0"
                                    className="w-full mt-2 px-4 py-3 bg-slate-800/50 border border-green-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                />
                            </label>
                            <p className="text-xs text-slate-500 mt-1">Typically 1.0-2.0 for non-UV compounds</p>
                        </div>
                    )}

                    {/* MS Intensity */}
                    {isDetectorActive('MS') && (
                        <div>
                            <label className="block mb-2">
                                <span className="text-sm font-medium text-slate-300 normal-case tracking-normal">LC-MS Intensity (counts)</span>
                                <input
                                    type="number"
                                    value={detectionConfig.ms_intensity || ''}
                                    onChange={(e) => handleChange('ms_intensity', parseFloat(e.target.value) || null)}
                                    placeholder="e.g., 1.5e6"
                                    step="100000"
                                    min="0"
                                    className="w-full mt-2 px-4 py-3 bg-slate-800/50 border border-violet-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                />
                            </label>
                            <p className="text-xs text-slate-500 mt-1">Total ion count for degradants</p>
                        </div>
                    )}

                    {/* GC-MS Volatiles */}
                    {isDetectorActive('GC_MS') && (
                        <div>
                            <label className="block mb-2">
                                <span className="text-sm font-medium text-slate-300 normal-case tracking-normal">Volatile Loss (%)</span>
                                <input
                                    type="number"
                                    value={detectionConfig.gc_ms_volatiles}
                                    onChange={(e) => handleChange('gc_ms_volatiles', parseFloat(e.target.value) || 0)}
                                    step="0.1"
                                    min="0"
                                    max="20"
                                    className="w-full mt-2 px-4 py-3 bg-slate-800/50 border border-orange-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                />
                            </label>
                            <p className="text-xs text-slate-500 mt-1">Percentage of API converted to volatile products</p>
                        </div>
                    )}

                    {/* Method Guidance */}
                    <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-violet-400 flex-shrink-0 mt-0.5" size={18} />
                            <div className="text-sm text-slate-300">
                                <p className="font-semibold text-violet-400 mb-2">Detection Strategy Guidance:</p>
                                <ul className="space-y-1 text-xs">
                                    <li>• UV-PDA: Essential for compounds with chromophores</li>
                                    <li>• ELSD/CAD: Add if degradants lack UV absorbance</li>
                                    <li>• LC-MS: Use for structural confirmation and MW verification</li>
                                    <li>• GC-MS: Required if volatile loss suspected (AMB {'<'} 95%)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

export default HybridDetection;
