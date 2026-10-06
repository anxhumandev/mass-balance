# 🧬 Mass Balance Calculator

### Intelligent Mass Balance & Stability Analysis Platform for Pharmaceutical Quality Monitoring

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)

---

## 📌 Overview

Mass Balance Calculator is an enterprise-grade pharmaceutical analytics platform designed to automate mass balance calculations, improve drug stability analysis workflows, and provide AI-powered predictive intelligence for regulatory-ready reports.

The platform eliminates manual spreadsheet dependency by providing a full-stack digital solution that integrates:

* **🤖 AI & Machine Learning Layer**: Predictive degradation and anomaly detection
* **🏢 Enterprise Integration**: Seamless LIMS synchronization
* **📊 Quality by Design (QbD)**: Integrated CQA/CPP management and design space exploration
* **📅 Stability Monitoring**: Automated protocol tracking and shelf-life prediction
* **Dual Statistical Methods**: LK-IMB and CIMB with 95% Confidence Intervals
* **Risk-Based Assessment**: Automated LOW/MODERATE/HIGH classification
* **Instant PDF & Excel Report Generation**
* **Persistent Data Storage with History**

Built for pharmaceutical quality control, Mass Balance Calculator demonstrates how digital automation can improve **pharma QC**, **stability studies**, and **regulatory documentation workflows**.

---

## 🎬 Demo

Watch the complete demonstration of Mass Balance Calculator in action:

[**View Project Demo**](https://drive.google.com/file/d/1DUwHV2xMkMosHj3Oc-4XkVHJNJX5nsbF/view?usp=sharing)

---

## 🚀 Key Features

### 🤖 AI & Machine Learning Layer

* **Predictive Degradation (GNN)**: Leverages **Graph Neural Networks** to analyze molecular structure (SMILES) and predict potential degradation products, their molecular weights, and expected mass balance recovery before performing experimental stress tests.
* **ML-Powered Anomaly Detection**: Uses sophisticated algorithms to detect experimental outliers, flagging results that deviate from historical patterns even if they fall within standard 95-105% thresholds.
* **Bayesian Statistical Engine**: Goes beyond simple t-distributions by incorporating **Prior Distributions** from historical data to provide more robust uncertainty quantification and higher confidence in mass balance closure.
* **Hybrid Molecular Interaction**: Combines experimental HPLC data with predicted stoichiometric models to estimate **UV-silent degradants** and **volatile losses**, effectively "solving" for the missing mass in complex degradation pathways.

### 🏢 Enterprise Integration & LIMS

* **Direct LIMS Synchronization**: Out-of-the-box connectors for **LabWare**, **STARLIMS**, and **Watson LIMS**, allowing for automated retrieval of experimental results and meta-data synchronization.
* **LIMS-to-DoE Workflow**: Seamlessly bridge laboratory data into **Quality by Design (QbD)** modules, enabling bulk synchronization of samples for large-scale Design of Experiments (DoE) studies.
* **Enterprise Security & Config**: Manage custom system adapters, API endpoints, and authentication credentials through a centralized, secure configuration interface.

### 📊 Quality by Design (QbD) Framework

* **CQA & CPP Management**: Define and track **Critical Quality Attributes** (e.g., CIMB, Assay) and **Critical Process Parameters** (e.g., pH, Temperature), establishing clear linkage between processes and product quality.
* **Design Space Exploration**: Visualize the experimental "Safe Zone" through interactive dashboards, identifying optimal operating conditions where mass balance and stability are guaranteed.
* **Automated Control Strategy**: Implement data-driven process controls and monitoring protocols that adjust based on real-time experimental findings.

### 📅 Intelligent Stability Monitoring

* **Automated Study Lifecycle**: Manage stability studies from protocol initiation to final report, with built-in tracking for batches, storage conditions (e.g., 25°C/60% RH), and analysts.
* **ICH-Compliant Timepoint Tracking**: Automatic generation and tracking of standard stability intervals (0, 3, 6, 9, 12, 18, 24, 36 months) with "Next Event" alerting.
* **Predictive Shelf-Life Forecasting**: Employs regression models on longitudinal data to predict **Expiration Dating** and provide early-warning alerts for potential Out-of-Specification (OOS) trends.
* **Live Compliance Matrix**: Real-time cross-referencing of experimental findings against ICH Q1A(R2) limits and batch-specific acceptance criteria.

### 🛡️ Regulatory & Compliance

* **Automated Compliance Matrix**: Real-time monitoring against ICH limits
* **Hybrid Detection**: UV-silent and volatile loss estimation

### 🧮 Advanced Mass Balance Methods

* **SMB** (Simple Mass Balance) - Basic uncorrected calculation
* **AMB** (Absolute Mass Balance) - Purity normalized
* **RMB** (Relative Mass Balance) - Delta ratio based
* **LK-IMB** (Lukulay-Körner Integrated Mass Balance) - Lambda + Omega corrections with **95% CI**
* **CIMB** (Corrected Integrated Mass Balance) - Stoichiometric pathway corrections with **95% CI**

### 📊 Statistical Analysis & Risk Assessment

* **95% Confidence Intervals** for both LK-IMB and CIMB methods
* **t-Distribution** based uncertainty quantification
* **Risk Level Classification**:
  - 🟢 **LOW** (98-102%): Excellent mass balance
  - 🟡 **MODERATE** (95-98% or 102-105%): Acceptable with justification
  - 🔴 **HIGH** (<95% or >105%): Investigation required

### 📈 Smart Report Generation

* **Professional 4-Page PDF Reports** (jsPDF) with:

  - **Page 1**: Professional cover page with status badge and branding
  - **Page 2**: Executive summary with key findings, LK-IMB statistical analysis with visual confidence interval scale, and risk assessment
  - **Page 3**: CIMB statistical analysis with visual confidence interval representation and detailed risk assessment
  - **Page 4**: Complete method comparison table, correction factors display, diagnostic assessment, and ICH Q1A(R2) compliance statement
  - Color-coded risk levels with visual indicators
  - Timestamp-based file naming: `Mass_Balance_Report_YYYYMMDD_Method.pdf`
* **Comprehensive Excel Workbooks** (XlsxWriter) with:

  - **6-Sheet Full Report**: Calculation Input, Mass Balance Results, Detailed Analysis, Calculation History, Analytics Dashboard, Reference Guide
  - **History-Only Export**: Single-sheet calculation history table for quick data review
  - Modern blue header styling (#3b82f6)
  - Timestamp-based file naming: `Mass Balance Report YYYYMMDD_HHMM.xlsx`
  - LK-IMB & CIMB confidence intervals with color-coded risk levels
  - Automated calculations with correction factors (Lambda, Omega, S)
  - Conditional formatting for instant visual feedback

### 🌐 Full Stack Architecture

* **Modern React Frontend** with Vite
* **Scalable Node.js Backend** with Express
* **Python Scientific Processing** with XlsxWriter
* **SQLite Database** for persistent storage
* **RESTful API** design

### ⚡ Real-Time Processing

* Instant calculation on input submission
* Live results dashboard with interactive charts
* One-click PDF/Excel export
* Calculation history with search and filter

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────┐
│         Frontend (React + Vite)                 │
│  - Advanced Dashboards (QbD, ROC, Stability)    │
│  - AI Predictive Interface                      │
│  - Professional PDF/Excel Reporting             │
│  - Enterprise LIMS Configuration                │
└────────────────┬────────────────────────────────┘
                 │ HTTP/REST API
                 ↓
┌─────────────────────────────────────────────────┐
│      Backend API (Node.js + Express)            │
│  - Mass Balance Calculations (LK-IMB & CIMB)    │
│  - ML Anomaly & GNN Prediction Layer            │
│  - Bayesian Statistical Engine                  │
│  - Regulatory Compliance Logic                  │
└────────────────┬────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────┐
│         Database (SQLite)                       │
│  - Expanded QbD & Stability Schemas             │
│  - Multi-System LIMS Mappings                   │
│  - Statistical Prior Distributions              │
└─────────────────────────────────────────────────┘

      AI/ML Services (Python)      LIMS Connectors
              ↓                          ↓
    Predictive Intelligence      Enterprise Sync
```

---

## 📂 Project Structure

```
mass-balance/
│
├── backend/
│   ├── server.js                    # Core API with ML & QbD endpoints
│   ├── lims/                        # LIMS integration connectors (LabWare/STARLIMS)
│   ├── ml/                          # ML prediction & anomaly detection services
│   ├── bayesian/                    # Bayesian statistical models
│   ├── reporting/                   # Regulatory dossier generation engine
│   ├── mass_balance.db              # SQLite with expanded QbD/Stability tables
│   ├── regulatoryMatrix.js          # Compliance assessment logic
│   └── hybridDetection.js           # UV-silent & volatile loss analysis
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── QbDDashboard.jsx     # Quality by Design interface
│   │   │   ├── ROCDashboard.jsx     # Optimization & CI thresholds
│   │   │   ├── StabilityMonitor.jsx # Stability study management
│   │   │   ├── Regulatory.jsx       # Compliance assessment matrix
│   │   │   ├── PredictiveDegradation.jsx # AI-powered forecasting
│   │   │   ├── Analytics.jsx        # Advanced data visualization
│   │   │   ├── LIMSConfig.jsx       # Enterprise system settings
│   │   │   └── Results.jsx          # Results with charts & PDF export
│   │   └── App.jsx                  # Main router with new modules
│
├── excel-service/
│   ├── excel.py                     # Python Excel generation service
│   └── reports/                     # Generated Excel files
│
└── README.md                        # This file
```

---

## 🚀 Quick Start Guide

### Prerequisites

Ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (3.8 or higher) - [Download](https://www.python.org/)
- **npm** (comes with Node.js)

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/anxhumandev/NOVARTIS-MASS-BALANCE-CALCULATOR.git
cd mass-balance
```

#### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

Required packages:

- express
- cors
- body-parser
- sqlite3
- uuid

#### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

Required packages:

- react
- vite
- axios
- recharts
- lucide-react
- jspdf

#### 4. Install Python Dependencies

```bash
cd excel-service
pip install -r requirements.txt
```

Required Python packages:

- xlsxwriter
- sqlite3 (built-in)

### Running the Application

#### Option 1: Run Both Servers Separately

**Terminal 1 - Backend Server:**

```bash
cd backend
npm run dev
```

Backend will start on: `http://localhost:5000`

**Terminal 2 - Frontend Server:**

```bash
cd frontend
npm run dev
```

Frontend will start on: `http://localhost:5173`

#### Option 2: Generate Excel Report

```bash
python excel.py
```

This generates the calculation history and report files.

### Accessing the Application

1. Open your browser and navigate to: `http://localhost:5173`
2. Enter your experimental data in the input form
3. Click "Calculate Mass Balance"
4. View results with statistical analysis
5. Download PDF or Excel reports

---

## 🧪 Scientific Calculation Methods

### 1. Simple Mass Balance (SMB)

```
SMB = Stressed API + Stressed Degradants
```

### 2. Absolute Mass Balance (AMB)

```
AMB = (Stressed API + Stressed Degradants) / (Initial API + Initial Degradants) × 100
```

### 3. Relative Mass Balance (RMB)

```
RMB = (ΔDegradants / ΔAPI) × 100
```

### 4. LK-IMB (Lukulay-Körner Integrated Mass Balance)

```
LK-IMB = (Stressed API + Corrected Degradants) / Initial API × 100

Where:
- Corrected Degradants = Stressed Degradants × λ × ω
- λ (Lambda) = 1 / RRF (Response Factor Correction)
- ω (Omega) = Parent MW / Degradant MW (Molecular Weight Correction)

Statistical Analysis:
- 95% CI = LK-IMB ± (t-critical × combined standard deviation)
- Risk Level: LOW (98-102%), MODERATE (95-98% or 102-105%), HIGH (<95% or >105%)
```

### 5. CIMB (Corrected Integrated Mass Balance)

```
CIMB = (Stressed API + Stoichiometrically Corrected Degradants) / Initial API × 100

Where:
- Corrected Degradants = Stressed Degradants × λ × S
- S (Stoichiometric Factor) varies by stress type:
  * Acid/Base: (Parent MW + 18) / Degradant MW
  * Oxidative: (Parent MW + 16) / Degradant MW
  * Thermal/Photolytic: ω

Statistical Analysis:
- 95% CI = CIMB ± (t-critical × combined standard deviation)
- Risk Level: LOW (98-102%), MODERATE (95-98% or 102-105%), HIGH (<95% or >105%)
```

---

## 📥 Input Parameters

| Parameter                         | Description                   | Example                                    |
| --------------------------------- | ----------------------------- | ------------------------------------------ |
| **Initial API Assay (%)**   | Starting purity before stress | 98.00                                      |
| **Stressed API Assay (%)**  | Purity after stress testing   | 82.50                                      |
| **Initial Degradants (%)**  | Baseline impurity level       | 0.50                                       |
| **Stressed Degradants (%)** | Impurity after stress         | 4.90                                       |
| **Parent MW (g/mol)**       | Molecular weight of API       | 500.00                                     |
| **Degradant MW (g/mol)**    | Molecular weight of degradant | 250.00                                     |
| **RRF**                     | Relative Response Factor      | 0.80                                       |
| **Stress Condition**        | Type of stress applied        | Base, Acid, Oxidative, Thermal, Photolytic |
| **Sample ID**               | Unique sample identifier      | VAL-2026-001                               |
| **Analyst Name**            | Person performing analysis    | Anshuman                                   |

---

## 📤 Output & Reports

### Web Dashboard Output

- **All Method Results**: SMB, AMB, RMB, LK-IMB, CIMB
- **LK-IMB Statistical Analysis**:
  - Point Estimate
  - 95% Confidence Interval (Lower & Upper)
  - Risk Level with color coding
- **CIMB Statistical Analysis**:
  - Point Estimate
  - 95% Confidence Interval (Lower & Upper)
  - Risk Level with color coding
- **Interactive Charts**: Mass balance comparison with reference lines
- **Correction Factors**: λ, ω, S values
- **Recommended Method**: Based on degradation level
- **Diagnostic Messages**: ICH Q1A(R2) compliance indicators

### PDF Report Contents (4-Page Professional Format)

1. **Page 1 - Cover Page**:

   - Professional pharmaceutical report design
   - MB badge with blue circular branding
   - Report title and ICH Q1A(R2) compliance label
   - Color-coded status badge (PASS/ALERT/FAIL)
   - Report generation date and time
   - Version: Dual-Method Mass Balance Calculator v2.0
2. **Page 2 - Executive Summary & LK-IMB Analysis**:

   - Analysis overview with conclusion
   - Key findings (degradation level, correction factors, CIMB results, risk level)
   - Volatile loss and UV-silent degradant detection
   - LK-IMB statistical analysis with visual confidence interval scale (85-115%)
   - Acceptable range visualization (95-105% highlighted in green)
   - Point estimate with error bars
   - 3-tier risk assessment (LOW/MODERATE/HIGH) with color coding
   - Current LK-IMB risk level banner
3. **Page 3 - CIMB Statistical Analysis**:

   - CIMB confidence interval visualization with scale (85-115%)
   - Point estimate (blue) with 95% CI error bars
   - Acceptable range overlay (95-105%)
   - Detailed risk assessment matrix
   - Current CIMB risk level status banner
4. **Page 4 - Method Comparison & Results**:

   - Complete results table for all 5 methods (SMB, AMB, RMB, LK-IMB, CIMB)
   - Formula display for each method
   - Status indicators (PASS/ALERT/FAIL)
   - Recommended method highlighted in green
   - Correction factors display (Lambda, Omega, S)
   - Diagnostic assessment in formatted text box
   - Scientific rationale explanation
   - ICH Q1A(R2) compliance statement
   - Footer with timestamp and version info

### Excel Workbook Sheets (6-Sheet Full Report)

1. **Calculation Input**:

   - User-friendly input form with labeled fields
   - Sample metadata (Sample ID, Analyst, Date, Stress Type)
   - API and degradant measurements (initial & stressed)
   - Correction factor inputs (Parent MW, Degradant MW, RRF)
   - Modern blue headers (#3b82f6)
2. **Mass Balance Results**:

   - All 5 method results (SMB, AMB, RMB, LK-IMB, CIMB)
   - LK-IMB with 95% confidence interval (Lower CI, Point Estimate, Upper CI)
   - CIMB with 95% confidence interval (Lower CI, Point Estimate, Upper CI)
   - Risk levels for both LK-IMB and CIMB (LOW/MODERATE/HIGH)
   - Color-coded risk assessment (green/yellow/red)
   - Calculated correction factors (Lambda, Omega, Stoichiometric)
3. **Detailed Analysis**:

   - Method-by-method breakdown
   - Formula explanations
   - Statistical significance indicators
   - Recommended method with justification
4. **Calculation History**:

   - Timestamped calculation log
   - Sample ID tracking
   - Method results comparison over time
   - Risk level trends
5. **Analytics Dashboard**:

   - Key performance indicators (KPIs)
   - Method usage statistics
   - Risk distribution summary
6. **Reference Guide**:

   - Method descriptions and formulas
   - Correction factor definitions (Lambda, Omega, S)
   - Risk level criteria and acceptance ranges
   - ICH Q1A(R2) compliance notes

### History-Only Excel Export

- **Single-sheet format** for quick data review
- Contains only the Calculation History Log table
- Includes: Calc ID, Date, Sample ID, Analyst, Stress Type, API/Degradant values, Method, Result, Risk Level, Status
- Filename: `Calculation History YYYYMMDD_HHMM.xlsx`
- Accessible from History page via "Export History" button

---

## 🛠️ Technology Stack

### Frontend

- **React** - UI framework
- **Vite** - Build tool and dev server
- **Axios** - HTTP client
- **Recharts** - Data visualization
- **jsPDF** - PDF generation
- **Lucide React** - Icons
- **Tailwind CSS** - Styling

### Backend

- **Node.js** - Runtime environment
- **Express** - Web framework
- **SQLite3** - Database
- **CORS** - Cross-origin resource sharing
- **UUID** - Unique ID generation

### Scientific Layer

- **Python 3.8+**
- **XlsxWriter** - Excel file generation

---

## 🧪 Sample Test Data

Use this data to test the application:

| Parameter           | Value        |
| ------------------- | ------------ |
| Initial API         | 98.00%       |
| Stressed API        | 82.50%       |
| Initial Degradants  | 0.50%        |
| Stressed Degradants | 4.90%        |
| Parent MW           | 500.00 g/mol |
| Degradant MW        | 250.00 g/mol |
| RRF                 | 0.80         |
| Stress Condition    | Base         |
| Sample ID           | VAL-2026-001 |
| Analyst Name        | Anshuman     |

**Expected Results:**

- LK-IMB: ~97.4% (Risk: MODERATE)
- CIMB: ~98.8% (Risk: LOW)
- Recommended Method: CIMB

---

## 📈 Use Cases

✅ **Pharmaceutical Stability Studies** - ICH Q1A(R2) compliant analysis
✅ **Quality Control Labs** - Routine mass balance verification
✅ **Regulatory Documentation** - Audit-ready PDF reports
✅ **Analytical Method Validation** - Statistical confidence intervals
✅ **Degradation Pathway Monitoring** - Trend tracking over time
✅ **Risk-Based Decision Making** - Automated risk level classification

---

## 🎯 API Endpoints

### Calculate Mass Balance

```
POST /api/calculate
Content-Type: application/json

Request Body:
{
  "initial_api": 98.00,
  "stressed_api": 82.50,
  "initial_degradants": 0.50,
  "stressed_degradants": 4.90,
  "parent_mw": 500.00,
  "degradant_mw": 250.00,
  "rrf": 0.80,
  "stress_type": "Base",
  "sample_id": "VAL-2026-001",
  "analyst_name": "A. Singla"
}

Response:
{
  "calculation_id": "uuid",
  "timestamp": "ISO-8601",
  "results": {
    "smb": 87.40,
    "amb": 88.78,
    "rmb": 28.39,
    "lk_imb": 97.40,
    "lk_imb_lower_ci": 92.40,
    "lk_imb_upper_ci": 102.40,
    "lk_imb_risk_level": "MODERATE",
    "cimb": 98.80,
    "cimb_lower_ci": 93.80,
    "cimb_upper_ci": 103.80,
    "cimb_risk_level": "LOW"
  },
  "correction_factors": {...},
  "recommended_method": "CIMB",
  "status": "PASS"
}
```

### Save Calculation

```
POST /api/save
```

### Get History

```
GET /api/history
```

### Get Specific Calculation

```
GET /api/calculation/:id
```

### Delete Calculation

```
DELETE /api/calculation/:id
```

---

## 🏆 Innovation Highlights

✨ **Dual Statistical Methods** - Both LK-IMB and CIMB with confidence intervals
✨ **Risk-Based Assessment** - Automated LOW/MODERATE/HIGH classification
✨ **Eliminates Manual Excel** - Full digital workflow
✨ **Reduces Human Error** - Automated calculations with validation
✨ **Audit-Ready Reports** - PDF and Excel with statistical rigor
✨ **Modern UI/UX** - Intuitive interface with real-time feedback
✨ **Scalable Architecture** - Ready for enterprise deployment

---

## 🔮 Future Roadmap

- [x] LIMS Integration (LabWare, STARLIMS, Watson)
- [x] AI-Based Degradation Prediction (GNN/Hybrid)
- [x] Quality by Design (QbD) Framework
- [x] Stability Protocol Monitoring
- [x] ROC-Optimized Confidence Thresholds
- [x] Regulatory Dossier Generation (FDA/EMA Style)
- [ ] Cloud Deployment (AWS/Azure)
- [ ] Batch Upload Analysis (Mass Import)
- [ ] Real-time Multi-Compound Analysis
- [ ] Advanced Monte Carlo Simulation
- [ ] Integrated Voice-to-Data Logging

---

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check if port 5000 is in use
netstat -ano | findstr :5000

# Kill the process if needed
taskkill /PID <process_id> /F

# Restart backend
cd backend
npm run dev
```

### Frontend won't start

```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Database errors

```bash
# Delete and recreate database
cd backend
rm mass_balance.db
# Restart server (will auto-create new DB)
npm run dev
```

### Python Excel generation fails

```bash
# Reinstall xlsxwriter
pip uninstall xlsxwriter
pip install xlsxwriter

# Run script
python excel.py
```

---

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Author

**Kumar Anshuman**

- Full Stack Development
- Scientific Computation
- Pharmaceutical Analytics

---

## 🙏 Acknowledgments

- ICH Q1A(R2) Guidelines for Stability Testing
- Lukulay-Körner Method for Integrated Mass Balance
- Pharmaceutical Quality Control Best Practices

---

## 💡 Vision Statement

Mass Balance Calculator aims to accelerate pharmaceutical quality analytics by combining scientific rigor with digital automation — enabling faster, more reliable, and scalable stability intelligence for modern drug development pipelines.

**Built with ❤️ for the pharmaceutical community**

---

## 📞 Support

For questions, issues, or feature requests, please open an issue on the repository.

---

**Version:** 3.0 (AI-Powered Enterprise Edition)
**Status:** Stable / Production Ready
