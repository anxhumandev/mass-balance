/**
 * Hybrid Detection Module
 * Handles composite RRF, UV-silent degradant detection, and volatile loss estimation
 * Implements Upgrade #3: Hybrid Detection Integration
 */

/**
 * Calculate Composite Response Factor (RRF) from multiple detectors
 */
function calculateCompositeRRF(detectionData) {
    const {
        uv_rrf = 1.0,
        elsd_rrf = null,
        ms_intensity = null,
        gc_ms_detected = false
    } = detectionData;

    // If only UV is used
    if (!elsd_rrf && !ms_intensity && !gc_ms_detected) {
        return {
            composite_rrf: uv_rrf || 1.0,
            detection_coverage_pct: 100,
            detection_sources: 'UV Only',
            method_completeness: assessMethodCompleteness({ uv: true })
        };
    }

    // Calculate weighted composite RRF
    // Weighting logic: ELSD is better for non-chromophoric (weight 2x if present)
    // UV is standard (weight 1x)
    let totalWeight = 1;
    let weightedSum = (uv_rrf || 1.0);
    let sources = ['UV'];
    let detectors = { uv: true };

    if (elsd_rrf) {
        totalWeight += 2;
        weightedSum += (elsd_rrf * 2);
        sources.push('ELSD');
        detectors.elsd = true;
    }

    if (ms_intensity) {
        // MS is used for ID, less for quant due to ionization variability
        const msFactor = Math.min(2.0, Math.max(0.5, ms_intensity / 1e6));
        totalWeight += 0.5;
        weightedSum += (msFactor * 0.5);
        sources.push('MS');
        detectors.ms = true;
    }

    if (gc_ms_detected) {
        // GC-MS captures volatile degradants missed by LC methods
        // Use a fixed contribution factor of 1.0 (assumes similar response to UV baseline)
        totalWeight += 0.5;
        weightedSum += 0.5;
        sources.push('GC_MS');
        detectors.gc_ms = true;
    }

    const composite_rrf = parseFloat((weightedSum / totalWeight).toFixed(2));

    return {
        composite_rrf,
        detection_coverage_pct: (100 + (elsd_rrf ? 20 : 0) + (ms_intensity ? 15 : 0) + (gc_ms_detected ? 15 : 0)),
        detection_sources: sources.join(' + '),
        method_completeness: assessMethodCompleteness(detectors)
    };
}


/**
 * Detect UV-Silent Degradants
 */
function detectUVSilentDegradants(degradantData) {
    const {
        stressed_degradants_uv = 0,
        stressed_degradants_elsd = 0,
        stressed_degradants_total = 0
    } = degradantData;

    // Difference between universal detector (ELSD) and UV
    const uvSilentGap = Math.max(0, stressed_degradants_elsd - stressed_degradants_uv);
    const uvSilentPct = stressed_degradants_total > 0
        ? (uvSilentGap / stressed_degradants_total * 100).toFixed(1)
        : 0;

    return {
        uv_silent_detected: uvSilentGap > 0.5, // Threshold 0.5%
        uv_silent_degradants_pct: parseFloat(uvSilentPct),
        impact_on_mb: uvSilentGap > 2.0 ? 'SIGNIFICANT' : (uvSilentGap > 0.5 ? 'MODERATE' : 'NEGLIGIBLE'),
        recommendation: uvSilentGap > 0.5 ? 'Use ELSD/CAD for accurate quantification' : 'UV detection sufficient'
    };
}

/**
 * Estimate Volatile Loss
 */
function estimateVolatileLoss(massBalanceData) {
    const {
        initial_api,
        stressed_api,
        stressed_degradants,
        gc_ms_volatiles = 0,
        amb
    } = massBalanceData;

    const theoretical_mb = initial_api;
    const actual_mb = stressed_api + stressed_degradants + gc_ms_volatiles;
    const loss = Math.max(0, theoretical_mb - actual_mb);
    const lossPct = (loss / initial_api * 100).toFixed(1);

    return {
        volatile_loss_detected: loss > 2.0 || gc_ms_volatiles > 0,
        volatile_loss_pct: parseFloat(lossPct),
        gc_ms_confirmation: gc_ms_volatiles > 0,
        severity: loss > 5.0 ? 'HIGH' : (loss > 2.0 ? 'MODERATE' : 'LOW'),
        recommendation: loss > 2.0 ? 'Perform GC-MS headspace analysis' : 'No significant volatile loss'
    };
}

/**
 * Assess Method Completeness
 */
function assessMethodCompleteness(detectors) {
    const {
        uv = true,
        elsd = false,
        ms = false,
        gc_ms = false
    } = detectors;

    let score = 0;
    let recommendations = [];

    // 1. Chromophore Coverage
    if (uv) score += 25;
    else recommendations.push({ priority: 'HIGH', message: 'Add UV detection', benefit: 'Base quantification' });

    // 2. Non-UV Active Coverage
    if (elsd) score += 25;
    else recommendations.push({ priority: 'MODERATE', message: 'Add ELSD/CAD', benefit: 'Detects UV-silent degradants' });

    // 3. Structural Confirmation
    if (ms) score += 25;
    else recommendations.push({ priority: 'INFO', message: 'Add LC-MS', benefit: 'Peak identification and purity' });

    // 4. Volatile Coverage
    if (gc_ms) score += 25;
    else recommendations.push({ priority: 'MODERATE', message: 'Add GC-MS', benefit: 'Detects volatile degradants' });

    return {
        completeness_score: score,
        completeness_pct: score, // score is already out of 100
        chromophore_coverage: uv,
        non_uv_coverage: elsd,
        structural_confirmation: ms,
        volatile_coverage: gc_ms,
        recommendations
    };
}

module.exports = {
    calculateCompositeRRF,
    detectUVSilentDegradants,
    estimateVolatileLoss,
    assessMethodCompleteness
};
