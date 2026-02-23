const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Load ROC-optimized config
let ROC_CONFIG = null;
try {
    const configPath = path.join(__dirname, 'ml_data', 'optimized_ci_config.json');
    ROC_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`✓ ROC-optimized CI threshold loaded: ${ROC_CONFIG.optimal_ci_threshold}`);
} catch (error) {
    console.log('⚠ ROC config not found, using default thresholds');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Set default LIMS_URL for demo if not provided
process.env.LIMS_URL = process.env.LIMS_URL || `http://localhost:${PORT}/api/mock-lims`;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        process.env.CORS_ORIGIN || 'http://localhost:5173'
    ],
    credentials: true
}));

app.use(bodyParser.json());

// Excel Generator Module
const excelGenerator = require('./excelGenerator');

// Regulatory Compliance Module
const {
    getComplianceReport,
    getFullComplianceMatrix,
    getCalculationCompliance
} = require('./regulatoryMatrix');

// Hybrid Detection Module
const {
    calculateCompositeRRF,
    detectUVSilentDegradants,
    estimateVolatileLoss
} = require('./hybridDetection');
const limsManager = require('./lims/limsManager');

// ML Anomaly Detection Helper
function detectAnomaly(data) {
    return new Promise((resolve, reject) => {
        console.log('🔮 Running ML Anomaly Detection...');
        const pythonProcess = spawn('python', [path.join(__dirname, 'ml/mlService.py')]);

        let output = '';
        let error = '';

        // Send data to stdin
        pythonProcess.stdin.write(JSON.stringify(data));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (chunk) => {
            output += chunk.toString();
        });

        pythonProcess.stderr.on('data', (chunk) => {
            error += chunk.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.warn(`ML Service Warning (code ${code}): ${error}`);
                resolve(null);
            } else {
                try {
                    if (!output || output.trim() === '') {
                        console.error('ML Service returned empty output');
                        resolve(null);
                        return;
                    }
                    const result = JSON.parse(output);
                    if (result.error) {
                        console.error("ML Error from script:", result.error);
                        resolve(null);
                    } else {
                        resolve(result);
                    }
                } catch (e) {
                    console.error('Failed to parse ML output:', e);
                    console.error('Raw output:', output);
                    resolve(null);
                }
            }
        });
    });
}

// GNN-based Molecular Analysis Helper
function predictGNN(smiles) {
    return new Promise((resolve, reject) => {
        console.log('⬡ Running GNN Molecular Analysis...');
        const pythonProcess = spawn('python', [path.join(__dirname, 'ml/gnnPredictor.py'), smiles]);

        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (chunk) => { output += chunk.toString(); });
        pythonProcess.stderr.on('data', (chunk) => { error += chunk.toString(); });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.warn(`GNN Service Warning (code ${code}): ${error}`);
                resolve({ success: false, error: 'GNN Analysis failed' });
            } else {
                try {
                    resolve(JSON.parse(output));
                } catch (e) {
                    console.error('Failed to parse GNN output:', e);
                    resolve({ success: false, error: 'Invalid GNN output' });
                }
            }
        });
    });
}

// Bayesian Analysis Helpers
function getPriors(method) {
    return new Promise((resolve, reject) => {
        db.get('SELECT prior_mean, prior_std, n_samples FROM method_priors WHERE method_name = ?', [method], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function runBayesianAnalysis(prior, data) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [path.join(__dirname, 'bayesian/bayesianUpdater.py')]);

        let output = '';
        let error = '';

        const payload = {
            prior_mean: prior.prior_mean,
            prior_std: prior.prior_std,
            data_mean: data.mean,
            data_std: data.std,
            n: data.n || 3
        };

        pythonProcess.stdin.write(JSON.stringify(payload));
        pythonProcess.stdin.end();

        pythonProcess.stdout.on('data', (chunk) => { output += chunk.toString(); });
        pythonProcess.stderr.on('data', (chunk) => { error += chunk.toString(); });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.warn(`Bayesian Service Warning: ${error}`);
                resolve(null);
            } else {
                try {
                    resolve(JSON.parse(output));
                } catch (e) {
                    console.error('Failed to parse Bayesian output:', e);
                    resolve(null);
                }
            }
        });
    });
}

// Database setup
const db = new sqlite3.Database('./mass_balance.db', (err) => {
    if (err) {
        console.error('❌ Database error:', err);
    } else {
        console.log('✓ Connected to SQLite database');
    }
});

// Create tables with CIMB and LK-IMB statistical fields
db.run(`
  CREATE TABLE IF NOT EXISTS calculations (
    id TEXT PRIMARY KEY,
    timestamp TEXT,
    sample_id TEXT,
    analyst_name TEXT,
    stress_type TEXT,
    initial_api REAL,
    stressed_api REAL,
    initial_degradants REAL,
    stressed_degradants REAL,
    degradant_mw REAL,
    parent_mw REAL,
    rrf REAL,
    smb REAL,
    amb REAL,
    rmb REAL,
    lk_imb REAL,
    lk_imb_lower_ci REAL,
    lk_imb_upper_ci REAL,
    lk_imb_risk_level TEXT,
    cimb REAL,
    cimb_lower_ci REAL,
    cimb_upper_ci REAL,
    cimb_risk_level TEXT,
    lambda REAL,
    omega REAL,
    stoichiometric_factor REAL,
    recommended_method TEXT,
    recommended_value REAL,
    confidence_index REAL,
    degradation_level REAL,
    status TEXT,
    diagnostic_message TEXT,
    rationale TEXT,
    lims_submitted INTEGER DEFAULT 0,
    lims_id TEXT,
    lims_submission_date TEXT,
    lims_system TEXT
  )
`, (err) => {
    if (err) {
        console.error('❌ Error creating table:', err);
    } else {
        console.log('✓ Database table ready');
    }
});

// ============================================
// QBD Framework Tables
// ============================================

// Critical Quality Attributes (CQAs)
db.run(`
  CREATE TABLE IF NOT EXISTS cqas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    target_value REAL,
    lower_limit REAL,
    upper_limit REAL,
    criticality TEXT CHECK(criticality IN ('HIGH', 'MEDIUM', 'LOW')),
    justification TEXT,
    measurement_method TEXT,
    acceptance_criteria TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
    if (err) {
        console.error('❌ Error creating cqas table:', err);
    } else {
        console.log('✓ CQAs table ready');
        // Seed default CQAs
        db.run(`INSERT OR IGNORE INTO cqas (id, name, description, target_value, lower_limit, upper_limit, criticality, justification, measurement_method, acceptance_criteria) VALUES
            ('cqa_001', 'Mass Balance (CIMB)', 'Corrected mass balance accounting for RRF and stoichiometry', 100.0, 95.0, 105.0, 'HIGH', 'Critical for ensuring complete degradation pathway understanding and product stability', 'HPLC with multi-wavelength detection', 'CIMB within 95-105% indicates acceptable mass closure'),
            ('cqa_002', 'Degradation Level', 'Percentage of API degraded under stress conditions', NULL, 5.0, 25.0, 'MEDIUM', 'Demonstrates forced degradation effectiveness without excessive product loss', 'HPLC peak area comparison', 'Degradation between 5-25% provides meaningful stability information'),
            ('cqa_003', 'Unknown Degradants', 'Number of unidentified degradation products', 0, 0, 2, 'HIGH', 'Unknown degradants require identification and qualification per ICH Q3B', 'Peak counting in chromatogram', 'Maximum 2 unknown peaks above reporting threshold'),
            ('cqa_004', 'Confidence Index', 'Statistical confidence in mass balance calculation', 85.0, 70.0, 100.0, 'MEDIUM', 'Quantifies analytical uncertainty and data quality', 'Bayesian statistical model', 'CI > 70% indicates acceptable analytical precision')
        `);
    }
});

// Process Parameters (Critical Process Parameters - CPPs)
db.run(`
  CREATE TABLE IF NOT EXISTS process_parameters (
    id TEXT PRIMARY KEY,
    parameter_name TEXT NOT NULL,
    description TEXT,
    normal_operating_range_min REAL,
    normal_operating_range_max REAL,
    proven_acceptable_range_min REAL,
    proven_acceptable_range_max REAL,
    unit TEXT,
    criticality TEXT CHECK(criticality IN ('HIGH', 'MEDIUM', 'LOW')),
    impact_on_cqa TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
    if (err) {
        console.error('❌ Error creating process_parameters table:', err);
    } else {
        console.log('✓ Process Parameters table ready');
        // Seed default CPPs
        db.run(`INSERT OR IGNORE INTO process_parameters (id, parameter_name, description, normal_operating_range_min, normal_operating_range_max, proven_acceptable_range_min, proven_acceptable_range_max, unit, criticality, impact_on_cqa) VALUES
            ('cpp_001', 'Stress Temperature', 'Temperature during forced degradation', 40.0, 60.0, 25.0, 80.0, '°C', 'HIGH', 'Directly affects degradation rate and product formation'),
            ('cpp_002', 'Stress Duration', 'Time under stress conditions', 24.0, 168.0, 1.0, 336.0, 'hours', 'MEDIUM', 'Longer duration increases degradation level'),
            ('cpp_003', 'pH (Acid/Base Stress)', 'Solution pH for hydrolytic stress', 2.0, 12.0, 1.0, 14.0, 'pH units', 'HIGH', 'pH drives hydrolysis mechanisms and product profiles'),
            ('cpp_004', 'H2O2 Concentration', 'Peroxide concentration for oxidative stress', 1.0, 5.0, 0.1, 10.0, '% w/v', 'MEDIUM', 'Controls oxidative degradation extent')
        `);
    }
});

// Design Space Experiments
db.run(`
  CREATE TABLE IF NOT EXISTS design_space_experiments (
    id TEXT PRIMARY KEY,
    experiment_name TEXT NOT NULL,
    experiment_type TEXT CHECK(experiment_type IN ('DOE', 'EDGE_OF_FAILURE', 'ROBUSTNESS', 'VALIDATION')),
    temperature REAL,
    duration REAL,
    ph REAL,
    oxidizer_conc REAL,
    stress_type TEXT,
    measured_cimb REAL,
    measured_degradation REAL,
    measured_unknowns INTEGER,
    measured_ci REAL,
    meets_cqa BOOLEAN,
    notes TEXT,
    performed_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
    if (err) {
        console.error('❌ Error creating design_space_experiments table:', err);
    } else {
        console.log('✓ Design Space Experiments table ready');
    }
});

// Control Strategy
db.run(`
  CREATE TABLE IF NOT EXISTS control_strategy (
    id TEXT PRIMARY KEY,
    control_type TEXT CHECK(control_type IN ('MATERIAL', 'PROCESS', 'IN_PROCESS', 'RELEASE')),
    parameter_controlled TEXT NOT NULL,
    control_method TEXT,
    acceptance_criteria TEXT,
    monitoring_frequency TEXT,
    escalation_procedure TEXT,
    responsible_role TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
    if (err) {
        console.error('❌ Error creating control_strategy table:', err);
    } else {
        console.log('✓ Control Strategy table ready');
        // Seed default control strategy
        db.run(`INSERT OR IGNORE INTO control_strategy VALUES
            ('cs_001', 'PROCESS', 'Stress Temperature', 'Calibrated water bath with continuous monitoring', '±2°C of target', 'Continuous', 'Stop test if deviation >3°C', 'QC Analyst', CURRENT_TIMESTAMP),
            ('cs_002', 'IN_PROCESS', 'Degradation Level', 'HPLC assay at time zero and end', '5-25% degradation', 'Each stress condition', 'Extend or reduce stress time', 'Analytical Chemist', CURRENT_TIMESTAMP),
            ('cs_003', 'RELEASE', 'Mass Balance (CIMB)', 'Full CIMB calculation with CI', '95-105%', 'Each sample', 'Investigate OOS if outside range', 'QC Manager', CURRENT_TIMESTAMP)
        `);
    }
});

// QBD indexes
db.run(`CREATE INDEX IF NOT EXISTS idx_design_exp_type ON design_space_experiments(experiment_type)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_cqa_criticality ON cqas(criticality)`);

// ============================================
// Stability Monitoring Tables
// ============================================

db.run(`
  CREATE TABLE IF NOT EXISTS stability_studies (
    id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    storage_conditions TEXT NOT NULL,
    start_date TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    notes TEXT
  )
`, (err) => {
    if (err) console.error('❌ Error creating stability_studies table:', err);
    else console.log('✓ Stability Studies table ready');
});

db.run(`
  CREATE TABLE IF NOT EXISTS stability_timepoints (
    id TEXT PRIMARY KEY,
    study_id TEXT NOT NULL,
    planned_interval_months INTEGER NOT NULL,
    planned_date TEXT NOT NULL,
    actual_date TEXT,
    status TEXT DEFAULT 'PLANNED',
    FOREIGN KEY (study_id) REFERENCES stability_studies(id)
  )
`, (err) => {
    if (err) console.error('❌ Error creating stability_timepoints table:', err);
    else console.log('✓ Stability Timepoints table ready');
});

db.run(`
  CREATE TABLE IF NOT EXISTS stability_results (
    id TEXT PRIMARY KEY,
    timepoint_id TEXT NOT NULL,
    parameter_name TEXT NOT NULL,
    measured_value REAL,
    unit TEXT,
    limit_min REAL,
    limit_max REAL,
    compliance_status TEXT,
    analyst TEXT,
    performed_date TEXT,
    notes TEXT,
    FOREIGN KEY (timepoint_id) REFERENCES stability_timepoints(id)
  )
`, (err) => {
    if (err) console.error('❌ Error creating stability_results table:', err);
    else console.log('✓ Stability Results table ready');
});


// Statistical helper functions for CIMB
function calculateStandardDeviation(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

function getTDistributionValue(degreesOfFreedom, alpha = 0.05) {
    // Simplified t-distribution critical values for 95% CI (two-tailed)
    const tTable = {
        1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
        6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
        15: 2.131, 20: 2.086, 30: 2.042, 60: 2.000, 120: 1.980
    };

    if (degreesOfFreedom in tTable) {
        return tTable[degreesOfFreedom];
    } else if (degreesOfFreedom > 120) {
        return 1.96; // Z-value for large samples
    } else {
        // Interpolate
        const keys = Object.keys(tTable).map(Number).sort((a, b) => a - b);
        for (let i = 0; i < keys.length - 1; i++) {
            if (degreesOfFreedom >= keys[i] && degreesOfFreedom <= keys[i + 1]) {
                return tTable[keys[i]]; // Conservative estimate
            }
        }
        return 2.0; // Default conservative value
    }
}

// Calculation Engine
// Calculation Engine
async function calculateMassBalance(data, hybrid_results) {
    const {
        stress_type = 'Unknown'
    } = data;

    // Parse all numeric inputs to ensure they are numbers (not strings from form data)
    const initial_api = parseFloat(data.initial_api) || 0;
    const stressed_api = parseFloat(data.stressed_api) || 0;
    const initial_degradants = parseFloat(data.initial_degradants) || 0;
    const stressed_degradants = parseFloat(data.stressed_degradants) || 0;
    const degradant_mw = parseFloat(data.degradant_mw) || 0;
    const parent_mw = parseFloat(data.parent_mw) || 0;
    const rrf = parseFloat(data.rrf) || 0;

    // Basic calculations
    const delta_api = initial_api - stressed_api;
    const delta_degradants = stressed_degradants - initial_degradants;
    const degradation_level = initial_api > 0 ? (delta_api / initial_api) * 100 : 0;

    // SMB - Simple Mass Balance
    const smb = stressed_api + stressed_degradants;

    // AMB - Absolute Mass Balance
    const amb_denom = initial_api + initial_degradants;
    const amb = amb_denom > 0 ? ((stressed_api + stressed_degradants) / amb_denom) * 100 : 0;

    // Hybrid Detection Integration
    const hybrid_detection = calculateCompositeRRF(data);
    const composite_rrf = hybrid_detection.composite_rrf || (data.rrf ? 1.0 / data.rrf : 1.0);
    const lambda = composite_rrf ? 1 / composite_rrf : 1.0;

    // Detect UV-silent degradants
    const uv_silent_analysis = detectUVSilentDegradants({
        stressed_degradants_uv: data.stressed_degradants || 0,
        stressed_degradants_elsd: data.stressed_degradants_elsd || data.stressed_degradants || 0,
        stressed_degradants_total: data.stressed_degradants || 0
    });

    // Estimate volatile loss
    const volatile_analysis = estimateVolatileLoss({
        initial_api: data.initial_api,
        stressed_api: data.stressed_api,
        stressed_degradants: data.stressed_degradants,
        gc_ms_volatiles: data.gc_ms_volatiles || 0,
        amb: amb
    });

    // --------------------------------------------
    // Core Calculation Logic
    // --------------------------------------------
    // λ (Lambda) = 1 / RRF
    // Corrected Degradant = Measured Degradant * λ
    const corrected_degradant = stressed_degradants * lambda;
    // RMB - Relative Mass Balance
    const rmb = delta_api === 0 ? null : (delta_degradants / delta_api) * 100;

    // Correction factors
    const omega = (degradant_mw && parent_mw) ? parent_mw / degradant_mw : 1.0;

    // Stoichiometric pathway factor based on stress type
    let stoichiometric_factor = 1.0;
    if (degradant_mw && parent_mw) {
        switch (stress_type.toLowerCase()) {
            case 'acid':
            case 'base':
                // Hydrolysis: typically adds H2O (18 g/mol)
                stoichiometric_factor = (parent_mw + 18) / degradant_mw;
                break;
            case 'oxidative':
                // Oxidation: typically adds O (16 g/mol)
                stoichiometric_factor = (parent_mw + 16) / degradant_mw;
                break;
            case 'photolytic':
            case 'thermal':
                // Fragmentation: use omega as is
                stoichiometric_factor = omega;
                break;
            default:
                stoichiometric_factor = omega;
        }
    }

    // LK-IMB - Lukulay-Körner Integrated Mass Balance with Confidence Intervals
    const corrected_degradants_lk = stressed_degradants * lambda * omega;
    const lk_imb_point = initial_api > 0 ? ((stressed_api + corrected_degradants_lk) / initial_api) * 100 : 0;

    // Calculate uncertainty and confidence intervals for LK-IMB
    // Assuming typical analytical uncertainty of ±2.5% for HPLC methods
    const analytical_uncertainty = 2.5; // % RSD

    // Propagate uncertainty through the calculation for LK-IMB
    const api_variance = Math.pow(stressed_api * analytical_uncertainty / 100, 2);
    const deg_variance = Math.pow(stressed_degradants * analytical_uncertainty / 100, 2);
    const lk_combined_variance = api_variance + deg_variance * Math.pow(lambda * omega, 2);
    const lk_combined_std = initial_api > 0 ? Math.sqrt(lk_combined_variance) / initial_api * 100 : 0;

    // 95% confidence interval using t-distribution (n=3 replicates typical)
    const df = 2; // degrees of freedom (n-1 for n=3)
    const t_critical = getTDistributionValue(df);
    const lk_margin_of_error = t_critical * lk_combined_std;

    const lk_imb_lower_ci = lk_imb_point - lk_margin_of_error;
    const lk_imb_upper_ci = lk_imb_point + lk_margin_of_error;

    // Risk-based threshold assessment for LK-IMB
    let lk_imb_risk_level;
    if (lk_imb_point >= 98 && lk_imb_point <= 102) {
        lk_imb_risk_level = 'LOW';
    } else if ((lk_imb_point >= 95 && lk_imb_point < 98) || (lk_imb_point > 102 && lk_imb_point <= 105)) {
        lk_imb_risk_level = 'MODERATE';
    } else {
        lk_imb_risk_level = 'HIGH';
    }

    // CIMB - Corrected Integrated Mass Balance with Confidence Intervals
    const corrected_degradants_cimb = stressed_degradants * lambda * stoichiometric_factor;
    const cimb_point = initial_api > 0 ? ((stressed_api + corrected_degradants_cimb) / initial_api) * 100 : 0;

    // Propagate uncertainty through the calculation for CIMB
    const cimb_combined_variance = api_variance + deg_variance * Math.pow(lambda * stoichiometric_factor, 2);
    const cimb_combined_std = initial_api > 0 ? Math.sqrt(cimb_combined_variance) / initial_api * 100 : 0;

    const cimb_margin_of_error = t_critical * cimb_combined_std;

    const cimb_lower_ci = cimb_point - cimb_margin_of_error;
    const cimb_upper_ci = cimb_point + cimb_margin_of_error;

    // Risk-based threshold assessment for CIMB
    let cimb_risk_level;
    if (cimb_point >= 98 && cimb_point <= 102) {
        cimb_risk_level = 'LOW';
    } else if ((cimb_point >= 95 && cimb_point < 98) || (cimb_point > 102 && cimb_point <= 105)) {
        cimb_risk_level = 'MODERATE';
    } else {
        cimb_risk_level = 'HIGH';
    }

    // Determine recommended method
    let recommended_method;
    if (delta_api < 2) {
        recommended_method = 'AMB';
    } else if (delta_api >= 5 && delta_api <= 20) {
        recommended_method = 'RMB';
    } else if (degradation_level > 20 || cimb_risk_level === 'HIGH') {
        recommended_method = 'CIMB'; // Use CIMB for high degradation or high risk
    } else {
        recommended_method = 'LK-IMB';
    }

    // Get recommended value
    const recommended_value =
        recommended_method === 'AMB' ? amb :
            recommended_method === 'RMB' ? rmb :
                recommended_method === 'LK-IMB' ? lk_imb_point :
                    recommended_method === 'CIMB' ? cimb_point :
                        smb;

    // Calculate confidence index using trained LogisticRegression model
    let confidence_index;
    let ci_risk_level;

    if (ROC_CONFIG && ROC_CONFIG.model_coefficients) {
        // Runtime inference using saved model coefficients
        // Logistic regression: P(fail) = sigmoid(intercept + coeff · x_scaled)
        const mc = ROC_CONFIG.model_coefficients;
        const features = [degradation_level, lk_imb_point, cimb_point];

        // Apply StandardScaler transform: x_scaled = (x - mean) / scale
        let logit = mc.intercept;
        for (let i = 0; i < features.length; i++) {
            const x_scaled = (features[i] - mc.scaler_mean[i]) / mc.scaler_scale[i];
            logit += mc.coefficients[i] * x_scaled;
        }

        // Sigmoid → probability of failure
        const p_fail = 1 / (1 + Math.exp(-logit));

        // CI = (1 - P(failure)) × 100
        confidence_index = Math.min(99.9, Math.max(0.1, (1 - p_fail) * 100));
        confidence_index = parseFloat(confidence_index.toFixed(1));

        // Classify using ROC-optimized threshold
        if (confidence_index >= ROC_CONFIG.optimal_ci_threshold) {
            ci_risk_level = 'LOW';
        } else if (confidence_index >= ROC_CONFIG.optimal_ci_threshold - 15) {
            ci_risk_level = 'MODERATE';
        } else {
            ci_risk_level = 'HIGH';
        }
    } else {
        // Dynamic fallback when no trained model is available
        // Uses the empirical relationship: CI correlates with how close MB is to 100%
        const mb_deviation = Math.abs(100 - lk_imb_point);
        const variance_penalty = lk_combined_std * 3;
        confidence_index = Math.min(99.9, Math.max(0.1,
            100 - (mb_deviation * 4) - variance_penalty
        ));
        confidence_index = parseFloat(confidence_index.toFixed(1));

        ci_risk_level = confidence_index >= 80 ? 'LOW' :
            confidence_index >= 60 ? 'MODERATE' : 'HIGH';
    }

    // ML Anomaly Detection
    let mlPrediction = null;
    try {
        // Placeholder values for ML input not directly available from current data
        const recovery_observed = lk_imb_point; // Using LK-IMB as a proxy for recovery
        const purity_check_passed = true; // Assume passed for now, or derive from other data if available

        const mlInput = {
            mass_balance: lk_imb_point, // Using LK-IMB as primary mass balance metric
            degradation: degradation_level,
            recovery: recovery_observed,
            purity: purity_check_passed ? 99.5 : 95.0, // Simplified purity proxy for now
        };
        mlPrediction = await detectAnomaly(mlInput);
    } catch (e) {
        console.error("ML Detection failed:", e);
    }

    // Determine status
    let status;
    let diagnostic_message;

    if (recommended_value >= 98 && recommended_value <= 102) {
        status = 'PASS';
    } else if (recommended_value >= 95 && recommended_value <= 105) {
        status = 'ALERT';
    } else {
        status = 'OOS';
    }

    // Incorporate ML prediction into status and diagnostic message
    if (mlPrediction && mlPrediction.is_anomaly) {
        status = 'OOS'; // Override to OOS if ML detects an anomaly
        diagnostic_message = `ML Anomaly Detected (Score: ${mlPrediction.anomaly_score.toFixed(2)}). Mass balance results are anomalous. Investigate potential issues beyond standard thresholds.`;
    } else if (recommended_value < 95) {
        diagnostic_message = 'Mass balance is below acceptable limits. Investigate for undetected degradation products or analytical method deficiencies.';
    } else if (recommended_value > 105) {
        diagnostic_message = 'Mass balance exceeds 105%. Check for analytical interference, impurity peaks being misidentified as API, or calibration issues.';
    } else if (recommended_value >= 95 && recommended_value < 98) {
        diagnostic_message = 'Mass balance is at lower borderline. Monitor closely and consider method validation.';
    } else if (recommended_value > 102 && recommended_value <= 105) {
        diagnostic_message = 'Mass balance is at upper borderline. Verify peak purity and check for co-elution.';
    } else {
        diagnostic_message = 'Mass balance is within acceptable limits (98-102%). Method demonstrates good recovery.';
    }

    // Rationale
    const rationale = `The ${recommended_method} method was selected based on ${degradation_level.toFixed(1)}% degradation level. This method accounts for ${recommended_method === 'CIMB' ? 'detector response (RRF), molecular weight changes, and degradation pathway stoichiometry' : recommended_method === 'LK-IMB' ? 'detector response (RRF) and molecular weight changes' : 'the specific characteristics of this degradation study'}.`;

    return {
        calculation_id: uuidv4(),
        timestamp: new Date().toISOString(),
        results: {
            smb: parseFloat(smb.toFixed(2)),
            amb: parseFloat(amb.toFixed(2)),
            rmb: rmb !== null ? parseFloat(rmb.toFixed(2)) : null,
            lk_imb: parseFloat(lk_imb_point.toFixed(2)),
            lk_imb_lower_ci: parseFloat(lk_imb_lower_ci.toFixed(2)),
            lk_imb_upper_ci: parseFloat(lk_imb_upper_ci.toFixed(2)),
            lk_imb_risk_level,
            cimb: parseFloat(cimb_point.toFixed(2)),
            cimb_lower_ci: parseFloat(cimb_lower_ci.toFixed(2)),
            cimb_upper_ci: parseFloat(cimb_upper_ci.toFixed(2)),
            cimb_risk_level,
            // Internal std devs for Bayesian analysis
            lk_combined_std: parseFloat(lk_combined_std.toFixed(4)),
            cimb_combined_std: parseFloat(cimb_combined_std.toFixed(4))
        },
        correction_factors: {
            lambda: parseFloat(lambda.toFixed(2)),
            omega: parseFloat(omega.toFixed(2)),
            stoichiometric_factor: parseFloat(stoichiometric_factor.toFixed(2))
        },
        recommended_method,
        recommended_value: parseFloat(recommended_value.toFixed(2)),
        confidence_index: parseFloat(confidence_index.toFixed(1)),
        ci_risk_level,
        ci_method: ROC_CONFIG ? 'ROC-optimized' : 'legacy',
        ml_prediction: mlPrediction,
        hybrid_method: hybrid_detection ? hybrid_detection.method : 'Standard', // Assuming hybrid_detection has a 'method' field

        // Hybrid Detection Results
        hybrid_detection: {
            detection_method: data.detection_method || 'UV',
            composite_rrf: hybrid_detection.composite_rrf,
            detection_coverage_pct: hybrid_detection.detection_coverage_pct,
            detection_sources: hybrid_detection.detection_sources,
            method_completeness: hybrid_detection.method_completeness,
            uv_silent_analysis,
            volatile_analysis
        },

        degradation_level: parseFloat(degradation_level.toFixed(1)),
        status,
        diagnostic_message,
        rationale
    };
}

// ============================================
// API Endpoints
// ============================================

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: 'Mass Balance Calculator API - Enhanced with CIMB & Excel Reports',
        version: '2.1.0',
        methods: ['SMB', 'AMB', 'RMB', 'LK-IMB', 'CIMB'],
        features: ['Statistical Validation', 'Excel Report Generation']
    });
});

// POST /api/calculate
app.post('/api/calculate', async (req, res) => {
    try {
        console.log('📊 Calculating mass balance with CIMB...');
        // Calculate Mass Balance
        // ----------------------
        console.log('🚀 Processing calculation request...');
        const hybrid_results = null; // Placeholder, as hybrid_detection is calculated inside calculateMassBalance
        const calculation = await calculateMassBalance(req.body, hybrid_results);

        // Run Bayesian Analysis for supported methods
        const methodsToCheck = [
            { name: 'LK-IMB', value: calculation.results.lk_imb, std: calculation.results.lk_combined_std },
            { name: 'CIMB', value: calculation.results.cimb, std: calculation.results.cimb_combined_std }
        ];

        for (const m of methodsToCheck) {
            try {
                const prior = await getPriors(m.name);
                if (prior && m.value !== null) {
                    const bayesianResult = await runBayesianAnalysis(prior, {
                        mean: m.value,
                        std: m.std || 2.5, // Default to 2.5% if std not available
                        n: 3
                    });

                    if (bayesianResult) {
                        calculation.results[`${m.name.toLowerCase().replace('-', '_')}_bayesian`] = bayesianResult;
                    }
                }
            } catch (e) {
                console.error(`Failed to run Bayesian analysis for ${m.name}:`, e);
            }
        }

        console.log('✓ Calculation complete:', calculation.recommended_method, calculation.recommended_value + '%');
        console.log('  CIMB:', calculation.results.cimb + '%', 'Risk:', calculation.results.cimb_risk_level);
        res.json(calculation);
    } catch (error) {
        console.error('❌ Calculation error:', error);
        res.status(400).json({ error: error.message });
    }
});

// POST /api/save
app.post('/api/save', (req, res) => {
    const { inputs, results } = req.body;

    const stmt = db.prepare(`
    INSERT INTO calculations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
        results.calculation_id,
        results.timestamp,
        inputs.sample_id || '',
        inputs.analyst_name || '',
        inputs.stress_type || '',
        inputs.initial_api,
        inputs.stressed_api,
        inputs.initial_degradants,
        inputs.stressed_degradants,
        inputs.degradant_mw || null,
        inputs.parent_mw || null,
        inputs.rrf || null,
        results.results.smb,
        results.results.amb,
        results.results.rmb,
        results.results.lk_imb,
        results.results.lk_imb_lower_ci,
        results.results.lk_imb_upper_ci,
        results.results.lk_imb_risk_level,
        results.results.cimb,
        results.results.cimb_lower_ci,
        results.results.cimb_upper_ci,
        results.results.cimb_risk_level,
        results.correction_factors.lambda,
        results.correction_factors.omega,
        results.correction_factors.stoichiometric_factor,
        results.recommended_method,
        results.recommended_value,
        results.confidence_index,
        results.degradation_level,
        results.status,
        results.diagnostic_message,
        results.rationale,
        0, // lims_submitted (default to 0)
        null, // lims_id (default to null)
        null, // lims_submission_date (default to null)
        null, // lims_system (default to null)
        (err) => {
            if (err) {
                console.error('❌ Save error:', err);
                res.status(500).json({ error: err.message });
            } else {
                console.log('✓ Calculation saved:', results.calculation_id);
                res.json({ success: true, calculation_id: results.calculation_id });
            }
        }
    );

    stmt.finalize();
});

// GET /api/history
app.get('/api/history', (req, res) => {
    const { page = 1, limit = 20, analyst, stress_type } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM calculations WHERE 1=1';
    const params = [];

    if (analyst) {
        query += ' AND analyst_name LIKE ?';
        params.push(`%${analyst}%`);
    }

    if (stress_type) {
        query += ' AND stress_type = ?';
        params.push(stress_type);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('❌ History fetch error:', err);
            res.status(500).json({ error: err.message });
        } else {
            db.get('SELECT COUNT(*) as total FROM calculations', (err, count) => {
                if (err) {
                    console.error('❌ Count error:', err);
                    res.status(500).json({ error: err.message });
                } else {
                    console.log('✓ History retrieved:', rows.length, 'records');
                    res.json({
                        total: count.total,
                        page: parseInt(page),
                        calculations: rows
                    });
                }
            });
        }
    });
});

// GET /api/calculation/:id
app.get('/api/calculation/:id', (req, res) => {
    db.get('SELECT * FROM calculations WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            console.error('❌ Fetch error:', err);
            res.status(500).json({ error: err.message });
        } else if (!row) {
            res.status(404).json({ error: 'Calculation not found' });
        } else {
            console.log('✓ Calculation retrieved:', req.params.id);
            res.json(row);
        }
    });
});

// This block seems to be misplaced and syntactically incorrect in this context.
// Assuming it was intended for a function that spawns a Python process and handles its output.
// For the sake of syntactic correctness and faithful application of the change,
// it's placed here as a standalone block, though its functional context is missing.
// If this block is part of a larger function, it should be integrated there.
// As per instructions, it's inserted where indicated, ensuring the surrounding code remains valid.
// The original `db.get` call was truncated in the instruction, which has been corrected.
// The inserted code block itself is syntactically valid JavaScript.
// The `error` and `output` variables would need to be defined in the scope where this listener is used.
// The `resolve` function would also need to be defined, likely from a Promise.
// This is a direct interpretation of the provided snippet and its placement.
/*
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.warn(`ML Service Warning (code ${code}): ${error}`);
        resolve(null);
      } else {
        try {
          if (!output || output.trim() === '') {
             console.error('ML Service returned empty output');
             resolve(null);
             return;
          }
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          console.error('Failed to parse ML output:', e);
          console.error('Raw output:', output);
          resolve(null);
        }
      }
    });
*/

// DELETE /api/calculation/:id
app.delete('/api/calculation/:id', (req, res) => {
    db.run('DELETE FROM calculations WHERE id = ?', [req.params.id], function (err) {
        if (err) {
            console.error('❌ Delete error:', err);
            res.status(500).json({ error: err.message });
        } else {
            console.log('✓ Calculation deleted:', req.params.id);
            res.json({ success: true, deleted: this.changes });
        }
    });
});

// ============================================
// EXCEL REPORT GENERATION ENDPOINTS
// ============================================

// GET /api/excel/template
// Download a blank Excel template
app.get('/api/excel/template', async (req, res) => {
    try {
        console.log('📥 Generating Excel template...');
        const result = await excelGenerator.generateExcelReport({
            outputPath: 'Mass_Balance_Template.xlsx'
        });

        console.log('✓ Template generated:', result.filePath);
        res.download(result.filePath, 'Mass_Balance_Template.xlsx', (err) => {
            if (err) {
                console.error('❌ Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download template' });
                }
            }
        });
    } catch (error) {
        console.error('❌ Template generation error:', error);
        res.status(500).json({
            error: 'Failed to generate template',
            details: error.message
        });
    }
});

// POST /api/excel/generate
// Generate Excel report from provided calculation data
app.post('/api/excel/generate', async (req, res) => {
    try {
        console.log('📊 Generating Excel report from data...');
        const data = req.body;
        const filename = `${data.sample_id || 'Report'}_${Date.now()}.xlsx`;

        const result = await excelGenerator.generateExcelReport({
            data,
            outputPath: filename
        });

        console.log('✓ Excel report generated:', result.filePath);
        res.download(result.filePath, filename, (err) => {
            if (err) {
                console.error('❌ Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download report' });
                }
            }
        });
    } catch (error) {
        console.error('❌ Report generation error details:', JSON.stringify(error, null, 2));
        res.status(500).json({
            error: 'Failed to generate report',
            details: error.error || error.message
        });
    }
});

// GET /api/excel/calculation/:id
// Generate Excel report for a specific saved calculation
app.get('/api/excel/calculation/:id', async (req, res) => {
    try {
        console.log('📊 Generating Excel report for calculation:', req.params.id);

        const result = await excelGenerator.generateReportFromCalculation(db, req.params.id);

        console.log('✓ Report generated:', result.filePath);
        res.download(result.filePath, path.basename(result.filePath), (err) => {
            if (err) {
                console.error('❌ Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download report' });
                }
            }
        });
    } catch (error) {
        console.error('❌ Report generation error:', error);
        res.status(500).json({
            error: 'Failed to generate report',
            details: error.message
        });
    }
});

// GET /api/excel/history
// Generate Excel report with calculation history
app.get('/api/excel/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        console.log(`📊 Generating history report (${limit} records)...`);

        const result = await excelGenerator.generateHistoryReport(db, limit);

        console.log('✓ History report generated:', result.filePath);
        res.download(result.filePath, 'Calculation_History.xlsx', (err) => {
            if (err) {
                console.error('❌ Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download history report' });
                }
            }
        });
    } catch (error) {
        console.error('❌ History report error details:', JSON.stringify(error, null, 2));
        res.status(500).json({
            error: 'Failed to generate history report',
            details: error.error || error.message
        });
    }
});

// GET /api/excel/database
// Generate complete database report with all calculations
app.get('/api/excel/database', async (req, res) => {
    try {
        console.log('📊 Generating complete database report...');

        const result = await excelGenerator.generateExcelReport({
            dbPath: './mass_balance.db',
            outputPath: `Database_Report_${Date.now()}.xlsx`
        });

        console.log('✓ Database report generated:', result.filePath);
        res.download(result.filePath, 'Database_Report.xlsx', (err) => {
            if (err) {
                console.error('❌ Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download database report' });
                }
            }
        });
    } catch (error) {
        console.error('❌ Database report error:', error);
        res.status(500).json({
            error: 'Failed to generate database report',
            details: error.message
        });
    }
});

// ============================================
// REGULATORY COMPLIANCE ENDPOINTS
// ============================================

// GET /api/regulatory/matrix - Full compliance matrix
app.get('/api/regulatory/matrix', (req, res) => {
    console.log('📋 Generating full regulatory compliance matrix...');
    try {
        const matrix = getFullComplianceMatrix();
        console.log(`✓ Matrix generated: ${matrix.summary.total_requirements} requirements across ${matrix.summary.total_guidelines} guidelines`);
        res.json(matrix);
    } catch (error) {
        console.error('❌ Matrix generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/regulatory/guideline/:code - Specific guideline report
app.get('/api/regulatory/guideline/:code', (req, res) => {
    const { code } = req.params;
    console.log(`📋 Fetching compliance report for ${code}...`);

    try {
        const report = getComplianceReport(code);

        if (report.error) {
            console.log(`❌ Guideline ${code} not found`);
            return res.status(404).json(report);
        }

        console.log(`✓ ${code}: ${report.compliance_score}% compliant`);
        res.json(report);
    } catch (error) {
        console.error('❌ Report generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/regulatory/calculation-compliance - Check calculation compliance
app.post('/api/regulatory/calculation-compliance', (req, res) => {
    console.log('📋 Checking calculation compliance...');

    try {
        const calculationData = req.body;
        const compliance = getCalculationCompliance(calculationData);

        console.log(`✓ Calculation ${compliance.calculation_id}: ${compliance.compliance_status}`);
        console.log(`  Applicable requirements: ${compliance.applicable_requirements.length}`);

        res.json(compliance);
    } catch (error) {
        console.error('❌ Compliance check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/regulatory/download/:format - Download compliance documentation
app.get('/api/regulatory/download/:format', async (req, res) => {
    const { format } = req.params;
    console.log(`📥 Generating ${format.toUpperCase()} compliance export...`);

    try {
        const matrix = getFullComplianceMatrix();

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=regulatory_compliance.json');
            res.json(matrix);
        } else if (format === 'csv') {
            // Convert to CSV
            let csv = 'Guideline,Requirement ID,Requirement,Implementation,Status,SOP,Evidence\n';

            Object.values(matrix.guidelines).forEach(guideline => {
                guideline.requirements.forEach(req => {
                    csv += `"${guideline.guideline}","${req.id}","${req.requirement}","${req.implementation}","${req.status}","${req.sop_reference}","${req.evidence}"\n`;
                });
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=regulatory_compliance.csv');
            res.send(csv);
        } else {
            res.status(400).json({ error: 'Unsupported format. Use json or csv.' });
        }

        console.log(`✓ ${format.toUpperCase()} export complete`);
    } catch (error) {
        console.error('❌ Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ROC ANALYSIS ENDPOINTS
// ============================================

// GET /api/roc/config - Get ROC-optimized configuration
app.get('/api/roc/config', (req, res) => {
    if (!ROC_CONFIG) {
        return res.status(404).json({
            error: 'ROC configuration not found',
            message: 'Run: python backend/roc_optimizer.py to generate'
        });
    }

    console.log('📊 Returning ROC configuration');
    res.json(ROC_CONFIG);
});

// GET /api/roc/curve - Get ROC curve image
app.get('/api/roc/curve', (req, res) => {
    const imagePath = path.join(__dirname, 'ml_data', 'roc_curve.png');

    if (!fs.existsSync(imagePath)) {
        return res.status(404).json({
            error: 'ROC curve not found',
            message: 'Run: python backend/roc_optimizer.py to generate'
        });
    }

    console.log('📊 Serving ROC curve image');
    res.sendFile(imagePath);
});

// POST /api/roc/retrain - Trigger ROC retraining
app.post('/api/roc/retrain', async (req, res) => {
    console.log('🔄 Triggering ROC model retraining...');

    const python = spawn('python', [path.join(__dirname, 'roc_optimizer.py')], {
        cwd: __dirname,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let output = '';
    let error = '';

    python.stdout.on('data', (data) => output += data.toString());
    python.stderr.on('data', (data) => error += data.toString());

    python.on('close', (code) => {
        if (code === 0) {
            // Reload config
            try {
                const configPath = path.join(__dirname, 'ml_data', 'optimized_ci_config.json');
                ROC_CONFIG = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                console.log('✓ ROC model retrained successfully');
                res.json({
                    success: true,
                    message: 'ROC model retrained',
                    new_threshold: ROC_CONFIG.optimal_ci_threshold,
                    output: output
                });
            } catch (e) {
                res.status(500).json({ error: 'Failed to reload config', details: e.message });
            }
        } else {
            console.error(`❌ ROC retraining failed with code ${code}`);
            console.error(`Stdout: ${output}`);
            console.error(`Stderr: ${error}`);
            res.status(500).json({ error: 'Retraining failed', stdout: output, stderr: error, code });
        }
    });
});

// ============================================
// LIMS INTEGRATION ENDPOINTS
// ============================================

// GET /api/lims/systems
app.get('/api/lims/systems', (req, res) => {
    console.log('📋 Listing LIMS systems...');

    try {
        const systems = limsManager.listAvailableSystems();
        console.log(`✓ Found ${systems.length} LIMS systems`);
        res.json({ success: true, systems });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/lims/initialize
app.post('/api/lims/initialize', async (req, res) => {
    const { system_name, config } = req.body;

    console.log(`🔌 Initializing LIMS: ${system_name}`);

    try {
        const connector = limsManager.initialize(system_name, config);
        const testResult = await connector.testConnection();

        if (testResult.success) {
            console.log(`✓ LIMS initialized: ${system_name}`);
            res.json({
                success: true,
                message: 'LIMS connector initialized',
                system: system_name,
                test_result: testResult
            });
        } else {
            console.error(`❌ Connection test failed`);
            res.status(400).json({
                success: false,
                error: 'Connection test failed',
                details: testResult
            });
        }
    } catch (error) {
        console.error('❌ Initialization error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/lims/test-connection
app.post('/api/lims/test-connection', async (req, res) => {
    const { system_name, config } = req.body;

    console.log(`🔍 Testing LIMS: ${system_name}`);

    try {
        const result = await limsManager.testConnection(system_name, config);
        res.json(result);
    } catch (error) {
        console.error('❌ Test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/lims/fetch
app.post('/api/lims/fetch', async (req, res) => {
    const { system_name = 'thermo_watson', query = {} } = req.body;

    console.log(`🔍 Ingesting data from LIMS: ${system_name}`);

    try {
        // Initialize if not already done (using basic mock config)
        const systems = limsManager.listAvailableSystems();
        const systemInfo = systems.find(s => s.id === system_name);

        if (!systemInfo) {
            return res.status(404).json({ success: false, error: `System ${system_name} not found` });
        }

        // For demo, we ensure it's initialized with mock credentials if needed
        const status = limsManager.getStatus();
        if (!status.initialized_systems.includes(system_name)) {
            limsManager.initialize(system_name, {
                api_key: 'DEMO-KEY-123',
                username: 'admin',
                password: 'password',
                base_url: process.env.LIMS_URL
            });
        }

        const result = await limsManager.fetchSamples(query, system_name);

        if (result.success && result.samples && result.samples.length > 0) {
            console.log(`✓ successfully fetched ${result.samples.length} samples from ${system_name}`);
            // Return the first sample for auto-population
            res.json({
                success: true,
                sample: result.samples[0],
                all_samples: result.samples
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'No samples found in LIMS',
                result
            });
        }
    } catch (error) {
        console.error('❌ LIMS fetch error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/lims/submit
app.post('/api/lims/submit', async (req, res) => {
    const { calculation_id, system_name } = req.body;

    console.log(`📤 Submitting to LIMS: ${calculation_id}`);

    try {
        db.get('SELECT * FROM calculations WHERE id = ?', [calculation_id], async (err, calculation) => {
            if (err) {
                return res.status(500).json({ success: false, error: err.message });
            }

            if (!calculation) {
                return res.status(404).json({ success: false, error: 'Calculation not found' });
            }

            try {
                const result = await limsManager.submitResult(calculation, system_name);

                db.run(
                    'UPDATE calculations SET lims_submitted = 1, lims_id = ?, lims_submission_date = ?, lims_system = ? WHERE id = ?',
                    [result.lims_id, new Date().toISOString(), system_name, calculation_id],
                    (updateErr) => {
                        if (updateErr) {
                            console.error('❌ Error updating LIMS submission status in DB:', updateErr);
                            // Still return success for LIMS submission, but log DB error
                        }
                    }
                );

                console.log(`✓ Submitted to LIMS: ${calculation_id}`);
                res.json(result);

            } catch (submitError) {
                console.error('❌ Submission error:', submitError);
                res.status(500).json(submitError);
            }
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/lims/status
app.get('/api/lims/status', (req, res) => {
    console.log('📊 Getting LIMS status...');

    try {
        const status = limsManager.getStatus();
        res.json({ success: true, status });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// MOCK LIMS ENDPOINTS FOR DEMO
// ============================================

// Mock Thermo Watson
app.get('/api/mock-lims/api/v2/samples/query', (req, res) => {
    res.json({
        samples: [
            { SampleName: 'WATSON-DOE-101', StressTemperature: 45, StressDuration: 24, CIMB_Result: 99.1, StressType: 'thermal' },
            { SampleName: 'WATSON-DOE-102', StressTemperature: 50, StressDuration: 48, CIMB_Result: 97.4, StressType: 'thermal' }
        ]
    });
});

// Mock LabWare
app.get('/api/mock-lims/LabwareLIMS/GetSamples.asmx', (req, res) => {
    // Basic mock response - in reality this would be XML
    res.json({
        samples: [
            { SAMPLE_NUMBER: 'LW-EXP-201', TEMP: 40, HOURS: 72, MASS_BALANCE_PCT: 98.8 },
            { SAMPLE_NUMBER: 'LW-EXP-202', TEMP: 60, HOURS: 12, MASS_BALANCE_PCT: 101.2 }
        ]
    });
});

// Mock STARLIMS
app.get('/api/mock-lims/api/rest/v1/samples', (req, res) => {
    res.json({
        samples: [
            { sampleId: 'SL-QBD-301', description: 'Photo Stability Test', mb_result: 96.5 },
            { sampleId: 'SL-QBD-302', description: 'Oxidative Stress 1%', mb_result: 98.9 }
        ]
    });
});

/**
 * Call Python prediction service
 */
async function predictDegradation(smiles, stressType, action = 'predict_products', degradationPercent = 10) {
    return new Promise((resolve, reject) => {
        const request = {
            action,
            smiles,
            stress_type: stressType,
            degradation_percent: degradationPercent
        };

        const python = spawn('python', [
            path.join(__dirname, 'ml', 'predictionService.py')
        ]);

        let stdout = '';
        let stderr = '';

        python.stdin.write(JSON.stringify(request));
        python.stdin.end();

        python.stdout.on('data', (data) => stdout += data.toString());
        python.stderr.on('data', (data) => stderr += data.toString());

        python.on('close', (code) => {
            if (code !== 0) {
                console.error('❌ Prediction service error:', stderr);
                reject({ error: 'Prediction failed', stderr });
                return;
            }

            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            } catch (e) {
                console.error('Failed output:', stdout);
                reject({ error: 'Failed to parse prediction response' });
            }
        });
    });
}

// ============================================
// DEGRADATION PREDICTION ENDPOINTS
// ============================================

// POST /api/predict/products - Predict degradation products
app.post('/api/predict/products', async (req, res) => {
    const { smiles, stress_type } = req.body;

    console.log(`🔮 Predicting degradation products...`);
    console.log(`  SMILES: ${smiles}`);
    console.log(`  Stress: ${stress_type}`);

    try {
        const prediction = await predictDegradation(smiles, stress_type, 'predict_products');

        if (prediction.success) {
            console.log(`✓ Predicted ${prediction.result.num_products} product(s)`);
            res.json(prediction);
        } else {
            console.error(`❌ Prediction failed: ${prediction.error}`);
            res.status(400).json(prediction);
        }
    } catch (error) {
        console.error('❌ Prediction error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/predict/mass-balance - Predict expected mass balance
app.post('/api/predict/mass-balance', async (req, res) => {
    const { smiles, stress_type, degradation_percent } = req.body;

    console.log(`🔮 Predicting mass balance...`);
    console.log(`  SMILES: ${smiles}`);
    console.log(`  Degradation: ${degradation_percent}%`);

    try {
        const prediction = await predictDegradation(
            smiles,
            stress_type,
            'predict_mb',
            degradation_percent
        );

        if (prediction.success) {
            console.log(`✓ Predicted LK-IMB: ${prediction.result.predicted_lk_imb}%`);
            res.json(prediction);
        } else {
            res.status(400).json(prediction);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/predict/analyze - Analyze molecular structure
app.post('/api/predict/analyze', async (req, res) => {
    const { smiles, stress_type } = req.body;

    console.log(`🔬 Analyzing molecular structure...`);

    try {
        const analysis = await predictDegradation(smiles, stress_type, 'analyze_structure');

        if (analysis.success) {
            console.log(`✓ Analysis complete`);
            res.json(analysis);
        } else {
            res.status(400).json(analysis);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/ml/gnn-predict - Advanced GNN-based analysis
app.post('/api/ml/gnn-predict', async (req, res) => {
    const { smiles } = req.body;

    console.log(`⬡ Requesting GNN analysis for: ${smiles}`);

    try {
        const result = await predictGNN(smiles);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('❌ GNN API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/predict/example-molecules - Get example SMILES
app.get('/api/predict/example-molecules', (req, res) => {
    const examples = [
        {
            name: 'Aspirin',
            smiles: 'CC(=O)Oc1ccccc1C(=O)O',
            category: 'NSAID'
        },
        {
            name: 'Ibuprofen',
            smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
            category: 'NSAID'
        },
        {
            name: 'Paracetamol',
            smiles: 'CC(=O)Nc1ccc(O)cc1',
            category: 'Analgesic'
        },
        {
            name: 'Caffeine',
            smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C',
            category: 'Stimulant'
        },
        {
            name: 'Atenolol',
            smiles: 'CC(C)NCC(O)COc1ccc(CC(N)=O)cc1',
            category: 'Beta-blocker'
        }
    ];

    res.json({
        success: true,
        examples
    });
});

// ============================================
// QBD FRAMEWORK ENDPOINTS
// ============================================

// GET /api/qbd/cqas - Get Critical Quality Attributes
app.get('/api/qbd/cqas', (req, res) => {
    db.all('SELECT * FROM cqas ORDER BY id', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, cqas: rows });
    });
});

// GET /api/qbd/process-parameters - Get Process Parameters
app.get('/api/qbd/process-parameters', (req, res) => {
    db.all('SELECT * FROM process_parameters ORDER BY id', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, parameters: rows });
    });
});

// GET /api/qbd/design-space - Get Design Space Experiments
app.get('/api/qbd/design-space', (req, res) => {
    db.all('SELECT * FROM design_space_experiments ORDER BY performed_date DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, experiments: rows });
    });
});

// POST /api/qbd/design-space - Add Experiment
app.post('/api/qbd/design-space', (req, res) => {
    const {
        experiment_name, experiment_type, temperature, duration, ph,
        oxidizer_conc, stress_type, measured_cimb, measured_degradation,
        measured_unknowns, measured_ci, meets_cqa, notes
    } = req.body;

    const id = uuidv4();
    const performed_date = new Date().toISOString();

    const sql = `INSERT INTO design_space_experiments 
        (id, experiment_name, experiment_type, temperature, duration, ph, 
        oxidizer_conc, stress_type, measured_cimb, measured_degradation,
        measured_unknowns, measured_ci, meets_cqa, notes, performed_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        id, experiment_name, experiment_type, temperature, duration, ph,
        oxidizer_conc, stress_type, measured_cimb, measured_degradation,
        measured_unknowns, measured_ci, meets_cqa, notes, performed_date
    ], function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, id, performed_date });
    });
});

// GET /api/qbd/control-strategy - Get Control Strategy
app.get('/api/qbd/control-strategy', (req, res) => {
    db.all('SELECT * FROM control_strategy ORDER BY id', [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, strategy: rows });
    });
});

// POST /api/qbd/assess-sample - Assess sample against QbD limits
app.post('/api/qbd/assess-sample', (req, res) => {
    const { cimb, degradation, unknowns, ci } = req.body;

    // Fetch limits from CQAs
    db.all('SELECT * FROM cqas', [], (err, cqas) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        const assessment = {
            passes: true,
            issues: []
        };

        cqas.forEach(cqa => {
            if (cqa.name.includes('Mass Balance') && cimb !== undefined) {
                if (cimb < cqa.lower_limit || cimb > cqa.upper_limit) {
                    assessment.passes = false;
                    assessment.issues.push(`CIMB ${cimb}% outside limit ${cqa.lower_limit}-${cqa.upper_limit}%`);
                }
            }
            if (cqa.name.includes('Degradation') && degradation !== undefined) {
                if (degradation > cqa.upper_limit) {
                    assessment.passes = false;
                    assessment.issues.push(`Degradation ${degradation}% exceeds limit ${cqa.upper_limit}%`);
                }
            }
            if (cqa.name.includes('Unknown') && unknowns !== undefined) {
                if (unknowns > cqa.upper_limit) {
                    assessment.passes = false;
                    assessment.issues.push(`${unknowns} unknown degradants exceeds limit ${cqa.upper_limit}`);
                }
            }
            if (cqa.name.includes('Confidence') && ci !== undefined) {
                if (ci < cqa.lower_limit) {
                    assessment.passes = false;
                    assessment.issues.push(`Confidence ${ci}% below limit ${cqa.lower_limit}%`);
                }
            }
        });

        res.json({ success: true, assessment });
    });
});

// GET /api/qbd/lims-sync - Sync samples from LIMS to Design Space
app.post('/api/qbd/lims-sync', async (req, res) => {
    const { system_name, query } = req.body;

    console.log(`🔄 Syncing QbD data from LIMS: ${system_name || 'Active System'}`);

    try {
        const result = await limsManager.fetchSamples(query, system_name);

        if (!result.success) {
            return res.status(400).json(result);
        }

        if (result.samples && result.samples.length > 0) {
            // Store sync'd data for visualization (using design_space_experiments table)
            const stmt = db.prepare(`INSERT INTO design_space_experiments 
                (id, experiment_name, experiment_type, temperature, duration, ph, 
                oxidizer_conc, stress_type, measured_cimb, measured_degradation,
                meets_cqa, performed_date, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

            let savedCount = 0;
            for (const sample of result.samples) {
                stmt.run(
                    uuidv4(),
                    sample.experiment_name || `LIMS-${Date.now()}-${savedCount}`,
                    'VALIDATION', // Using VALIDATION type for LIMS data
                    sample.temperature || 40,
                    sample.duration || 24,
                    sample.ph || 7.0,
                    sample.oxidizer_conc || 0,
                    sample.stress_type || 'N/A',
                    sample.measured_cimb || 100,
                    sample.measured_degradation || 0,
                    sample.measured_cimb >= 95 && sample.measured_cimb <= 105, // Auto-assessment
                    new Date().toISOString(),
                    'Synchronized from LIMS'
                );
                savedCount++;
            }
            stmt.finalize();

            console.log(`✓ Synchronized ${savedCount} samples from LIMS`);
            res.json({
                success: true,
                message: `Successfully synchronized ${savedCount} samples from LIMS`,
                samples: result.samples
            });
        } else {
            res.json({ success: true, samples: [], message: 'No samples found to synchronize' });
        }

    } catch (error) {
        console.error('❌ LIMS Sync Error:', error);

        // Handle both Error objects and plain objects thrown by connectors
        const message = error.message || error.error || 'LIMS synchronization failed';
        const details = error.lims_system ? `System: ${error.lims_system}` : '';

        res.status(500).json({
            success: false,
            error: message,
            details: details
        });
    }
});

// ============================================
// STABILITY MONITORING ENDPOINTS
// ============================================

// POST /api/stability/studies - Create study
app.post('/api/stability/studies', (req, res) => {
    const { product_name, batch_number, storage_conditions, start_date, notes } = req.body;
    const id = uuidv4();

    db.run(`INSERT INTO stability_studies (id, product_name, batch_number, storage_conditions, start_date, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
        [id, product_name, batch_number, storage_conditions, start_date, notes], function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });

            // Auto-create standard timepoints (0, 3, 6, 12, 24, 36 months)
            const intervals = [0, 3, 6, 12, 24, 36];
            const stmt = db.prepare(`INSERT INTO stability_timepoints (id, study_id, planned_interval_months, planned_date) VALUES (?, ?, ?, ?)`);

            const baseDate = new Date(start_date);
            intervals.forEach(months => {
                const plannedDate = new Date(baseDate);
                plannedDate.setMonth(baseDate.getMonth() + months);
                stmt.run(uuidv4(), id, months, plannedDate.toISOString());
            });
            stmt.finalize();

            res.json({ success: true, id });
        });
});

// DELETE /api/stability/study/:id - Delete study
app.delete('/api/stability/study/:id', (req, res) => {
    const studyId = req.params.id;

    // Delete results linked to timepoints of this study
    db.run(`DELETE FROM stability_results WHERE timepoint_id IN (SELECT id FROM stability_timepoints WHERE study_id = ?)`, [studyId], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        // Delete timepoints
        db.run(`DELETE FROM stability_timepoints WHERE study_id = ?`, [studyId], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            // Delete study
            db.run(`DELETE FROM stability_studies WHERE id = ?`, [studyId], (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, message: 'Study deleted' });
            });
        });
    });
});

// GET /api/stability/studies - List studies
app.get('/api/stability/studies', (req, res) => {
    db.all(`SELECT * FROM stability_studies ORDER BY start_date DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, studies: rows });
    });
});

// GET /api/stability/study/:id - Get study details
app.get('/api/stability/study/:id', (req, res) => {
    const studyId = req.params.id;

    db.get(`SELECT * FROM stability_studies WHERE id = ?`, [studyId], (err, study) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!study) return res.status(404).json({ success: false, error: 'Study not found' });

        db.all(`SELECT * FROM stability_timepoints WHERE study_id = ? ORDER BY planned_interval_months`, [studyId], (err, timepoints) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            // Get results for all timepoints
            db.all(`SELECT r.*, t.planned_interval_months 
                    FROM stability_results r 
                    JOIN stability_timepoints t ON r.timepoint_id = t.id 
                    WHERE t.study_id = ?`, [studyId], (err, results) => {
                if (err) return res.status(500).json({ success: false, error: err.message });

                res.json({
                    success: true,
                    study,
                    timepoints: timepoints.map(tp => ({
                        ...tp,
                        results: results.filter(r => r.timepoint_id === tp.id)
                    }))
                });
            });
        });
    });
});

// POST /api/stability/timepoint/:id/results - Add/Update results
app.post('/api/stability/timepoint/:id/results', (req, res) => {
    const timepointId = req.params.id;
    const results = req.body; // Array of results [{parameter_name, measured_value, unit, limit_min, limit_max, analyst, notes}]

    const stmt = db.prepare(`INSERT INTO stability_results 
        (id, timepoint_id, parameter_name, measured_value, unit, limit_min, limit_max, compliance_status, analyst, performed_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const performedDate = new Date().toISOString();

    results.forEach(r => {
        let status = 'PASS';
        if (r.limit_min !== undefined && r.measured_value < r.limit_min) status = 'FAIL';
        if (r.limit_max !== undefined && r.measured_value > r.limit_max) status = 'FAIL';

        stmt.run(uuidv4(), timepointId, r.parameter_name, r.measured_value, r.unit, r.limit_min, r.limit_max, status, r.analyst, performedDate, r.notes);
    });

    stmt.finalize();

    // Mark timepoint as completed
    db.run(`UPDATE stability_timepoints SET status = 'COMPLETED', actual_date = ? WHERE id = ?`, [performedDate, timepointId], (err) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

const regulatoryEngine = require('./reporting/regulatoryDossier');
const stabilityPredictor = require('./reporting/stabilityPredictor');

// POST /api/regulatory/dossier - Generate Dossier
app.post('/api/regulatory/dossier', async (req, res) => {
    const { product_name } = req.body;
    try {
        const dossier = await regulatoryEngine.generateDossier(product_name);
        res.json({ success: true, dossier });
    } catch (error) {
        console.error('Dossier error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/stability/study/:id/predict - Predict shelf life
app.get('/api/stability/study/:id/predict', (req, res) => {
    const studyId = req.params.id;

    db.all(`SELECT r.measured_value, t.planned_interval_months 
            FROM stability_results r 
            JOIN stability_timepoints t ON r.timepoint_id = t.id 
            WHERE t.study_id = ? AND r.parameter_name = 'Assay'
            ORDER BY t.planned_interval_months`, [studyId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });

        const data = rows.map(r => ({ months: r.planned_interval_months, assay: r.measured_value }));
        const prediction = stabilityPredictor.predictShelfLife(data);

        res.json({ success: true, prediction });
    });
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// ROC Optimization Endpoints
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 

// GET /api/roc/config - Load optimized configuration
app.get('/api/roc/config', (req, res) => {
    console.log('📊 Returning ROC configuration');
    const configPath = path.join(__dirname, 'ml_data/optimized_ci_config.json');
    fs.readFile(configPath, 'utf8', (err, data) => {
        if (err) {
            console.error('❌ ROC config read error:', err);
            return res.status(404).json({ success: false, error: 'ROC config not found' });
        }
        res.json(JSON.parse(data));
    });
});

// (Duplicate /api/roc/retrain removed — see route at line ~1242)

// GET /api/roc/curve - Serve ROC curve visualization
app.get('/api/roc/curve', (req, res) => {
    const imgPath = path.join(__dirname, 'ml_data/roc_curve.png');
    if (fs.existsSync(imgPath)) {
        res.sendFile(imgPath);
    } else {
        res.status(404).json({ success: false, error: 'ROC curve image not found' });
    }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// Regulatory Compliance Endpoints
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 

// GET /api/regulatory/matrix - Get full compliance matrix
app.get('/api/regulatory/matrix', (req, res) => {
    console.log('⚖️ Serving Regulatory Compliance Matrix');
    const matrix = getFullComplianceMatrix();
    res.json(matrix);
});

// POST /api/regulatory/dossier - Generate Dossier
app.post('/api/regulatory/dossier', async (req, res) => {
    const { product_name } = req.body;
    console.log(`📄 Generating Regulatory Dossier for: ${product_name}`);
    try {
        const dossier = await regulatoryEngine.generateDossier(product_name);
        res.json({ success: true, dossier });
    } catch (error) {
        console.error('❌ Dossier generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/regulatory/download/:format - Download report
app.get('/api/regulatory/download/:format', (req, res) => {
    const format = req.params.format;
    console.log(`📥 Downloading Regulatory Report in ${format} format`);
    const matrix = getFullComplianceMatrix();

    if (format === 'json') {
        res.json(matrix);
    } else {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=regulatory_compliance.${format}`);
        res.send(JSON.stringify(matrix, null, 2));
    }
});

// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 
// Start Server
// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = 

app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('   ✓ Backend server running successfully!');
    console.log('   ✓ Enhanced with CIMB Method + Excel Reports');
    console.log('   ✓ URL: http://localhost:' + PORT);
    console.log('   ✓ Database: SQLite (mass_balance.db)');
    console.log('   ✓ Status: Ready to receive requests');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log('Available Methods:');
    console.log('  • SMB    - Simple Mass Balance');
    console.log('  • AMB    - Absolute Mass Balance');
    console.log('  • RMB    - Relative Mass Balance');
    console.log('  • LK-IMB - Lukulay-Körner Integrated Mass Balance');
    console.log('  • CIMB   - Corrected Integrated Mass Balance');
    console.log('');
    console.log('API Endpoints:');
    console.log('  GET  /                          - Health check');
    console.log('  POST /api/calculate             - Calculate mass balance');
    console.log('  POST /api/save                  - Save calculation');
    console.log('  GET  /api/history               - Get calculation history');
    console.log('  GET  /api/calculation/:id       - Get specific calculation');
    console.log('  DELETE /api/calculation/:id     - Delete calculation');
    console.log('');
    console.log('Excel Report Endpoints:');
    console.log('  GET  /api/excel/template        - Download blank template');
    console.log('  POST /api/excel/generate        - Generate report from data');
    console.log('  GET  /api/excel/calculation/:id - Report for calculation');
    console.log('  GET  /api/excel/history         - History report (limit param)');
    console.log('  GET  /api/excel/database        - Full database report');
    console.log('');

    // Auto-initialize default LIMS for demo/development
    try {
        const defaultSystem = 'thermo_watson';
        const mockConfig = {
            base_url: 'http://localhost:5000/api/mock-lims',
            api_key: 'demo-api-key-123',
            username: 'demo_user',
            password: 'demo_password'
        };
        limsManager.initialize(defaultSystem, mockConfig);
        console.log(`📡 Auto-initialized LIMS: ${defaultSystem} (Mock Mode)`);
    } catch (e) {
        console.warn('⚠️ LIMS auto-initialization skipped:', e.message);
    }
});

// Error handling
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});