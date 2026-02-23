"""
ROC-Optimized Confidence Index Threshold Calculator
Uses LogisticRegression with cross-validation to find optimal CI cutoff.

Theoretical basis:
  - Fawcett (2006): ROC analysis requires a learned decision function
  - Youden (1950): Optimal threshold = argmax(TPR - FPR)
  - ICH Q2R2: Mass balance >95% indicates acceptable recovery

Pipeline:
  1. Load multi-feature training data (degradation_level, lk_imb, cimb)
  2. Train LogisticRegression with StratifiedKFold cross-validation
  3. Generate unbiased predicted probabilities via cross_val_predict
  4. Compute ROC curve, AUC, and optimal threshold via Youden's J
  5. Save trained model coefficients + config for runtime inference
"""

import json
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server environments
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import roc_curve, roc_auc_score, confusion_matrix
from sklearn.pipeline import Pipeline
from pathlib import Path


def load_training_data(filepath='ml_data/ci_training_data.json'):
    """Load historical mass balance data with multi-feature structure."""
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    records = data['data']
    feature_cols = data.get('feature_columns', ['degradation_level', 'lk_imb', 'cimb'])
    
    X = np.array([[d[col] for col in feature_cols] for d in records])
    y = np.array([1 if d['actual_failure'] else 0 for d in records])
    
    return X, y, feature_cols, records


def train_and_evaluate(X, y, feature_cols):
    """
    Train LogisticRegression with StratifiedKFold cross-validation.
    
    Returns:
        dict: Model performance, ROC data, optimal threshold, and model params
    """
    # Build pipeline: StandardScaler → LogisticRegression
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', LogisticRegression(
            C=1.0,
            penalty='l2',
            solver='lbfgs',
            max_iter=1000,
            random_state=42
        ))
    ])
    
    # Cross-validated probability predictions (unbiased)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    y_proba = cross_val_predict(pipeline, X, y, cv=cv, method='predict_proba')[:, 1]
    
    # Fit final model on all data for coefficient extraction
    pipeline.fit(X, y)
    scaler = pipeline.named_steps['scaler']
    classifier = pipeline.named_steps['classifier']
    
    # ROC curve from cross-validated probabilities
    fpr, tpr, thresholds = roc_curve(y, y_proba)
    auc_score = roc_auc_score(y, y_proba)
    
    # Optimal threshold via Youden's J statistic
    j_scores = tpr - fpr
    optimal_idx = np.argmax(j_scores)
    optimal_proba_threshold = thresholds[optimal_idx]
    
    # Convert probability threshold to CI scale: CI = (1 - failure_proba) * 100
    optimal_ci_threshold = round((1 - optimal_proba_threshold) * 100, 1)
    
    # Confusion matrix at optimal threshold
    y_pred = (y_proba >= optimal_proba_threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, y_pred).ravel()
    
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    ppv = tp / (tp + fp) if (tp + fp) > 0 else 0
    npv = tn / (tn + fn) if (tn + fn) > 0 else 0
    accuracy = (tp + tn) / (tp + tn + fp + fn)
    
    # Extract model coefficients for runtime inference (no Python needed at calc time)
    coefficients = classifier.coef_[0].tolist()
    intercept = classifier.intercept_[0]
    scaler_mean = scaler.mean_.tolist()
    scaler_scale = scaler.scale_.tolist()
    
    results = {
        'optimal_ci_threshold': optimal_ci_threshold,
        'optimal_proba_threshold': round(optimal_proba_threshold, 4),
        'auc_score': round(auc_score, 4),
        'sensitivity': round(sensitivity, 4),
        'specificity': round(specificity, 4),
        'ppv': round(ppv, 4),
        'npv': round(npv, 4),
        'accuracy': round(accuracy, 4),
        'true_positives': int(tp),
        'true_negatives': int(tn),
        'false_positives': int(fp),
        'false_negatives': int(fn),
        'j_statistic': round(j_scores[optimal_idx], 4),
        'fpr': fpr.tolist(),
        'tpr': tpr.tolist(),
        'thresholds_ci': ((1 - thresholds) * 100).tolist(),
        'model_params': {
            'feature_columns': feature_cols,
            'coefficients': [round(c, 6) for c in coefficients],
            'intercept': round(intercept, 6),
            'scaler_mean': [round(m, 6) for m in scaler_mean],
            'scaler_scale': [round(s, 6) for s in scaler_scale]
        }
    }
    
    return results


def plot_roc_curve(results, output_path='ml_data/roc_curve.png'):
    """Generate 4-panel ROC analysis visualization."""
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle('ROC Analysis — Logistic Regression (5-Fold CV)', fontsize=16, fontweight='bold', y=0.98)
    
    # Panel 1: ROC Curve
    ax1 = axes[0, 0]
    ax1.plot(results['fpr'], results['tpr'], 'b-', linewidth=2.5,
             label=f"AUC = {results['auc_score']:.4f}")
    ax1.plot([0, 1], [0, 1], 'r--', linewidth=1, alpha=0.6, label='Random (AUC = 0.5)')
    ax1.fill_between(results['fpr'], results['tpr'], alpha=0.1, color='blue')
    ax1.set_xlabel('False Positive Rate', fontsize=12)
    ax1.set_ylabel('True Positive Rate', fontsize=12)
    ax1.set_title('ROC Curve', fontsize=13, fontweight='bold')
    ax1.legend(loc='lower right', fontsize=10)
    ax1.grid(True, alpha=0.3)
    
    # Panel 2: Youden's J vs CI Threshold
    ax2 = axes[0, 1]
    j_scores = np.array(results['tpr']) - np.array(results['fpr'])
    ci_thresholds = results['thresholds_ci']
    ax2.plot(ci_thresholds, j_scores, 'g-', linewidth=2)
    ax2.axvline(results['optimal_ci_threshold'], color='r', linestyle='--', linewidth=2,
                label=f"Optimal CI = {results['optimal_ci_threshold']:.1f}")
    ax2.set_xlabel('Confidence Index Threshold', fontsize=12)
    ax2.set_ylabel("Youden's J Statistic", fontsize=12)
    ax2.set_title('Threshold Optimization', fontsize=13, fontweight='bold')
    ax2.legend(loc='best', fontsize=10)
    ax2.grid(True, alpha=0.3)
    
    # Panel 3: Confusion Matrix
    ax3 = axes[1, 0]
    cm = np.array([[results['true_negatives'], results['false_positives']],
                   [results['false_negatives'], results['true_positives']]])
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=False,
                xticklabels=['Predict Pass', 'Predict Fail'],
                yticklabels=['Actual Pass', 'Actual Fail'],
                annot_kws={'size': 16, 'weight': 'bold'}, ax=ax3)
    ax3.set_title('Confusion Matrix', fontsize=13, fontweight='bold')
    
    # Panel 4: Performance Metrics
    ax4 = axes[1, 1]
    metrics = ['Sensitivity', 'Specificity', 'PPV', 'NPV', 'Accuracy']
    values = [results['sensitivity'], results['specificity'], results['ppv'],
              results['npv'], results['accuracy']]
    colors = ['#2ecc71' if v >= 0.8 else '#f39c12' if v >= 0.6 else '#e74c3c' for v in values]
    bars = ax4.barh(metrics, values, color=colors, edgecolor='white', linewidth=0.5)
    ax4.set_xlabel('Score', fontsize=12)
    ax4.set_title('Performance Metrics', fontsize=13, fontweight='bold')
    ax4.set_xlim(0, 1.15)
    ax4.grid(axis='x', alpha=0.3)
    for bar, value in zip(bars, values):
        ax4.text(value + 0.02, bar.get_y() + bar.get_height() / 2,
                 f'{value:.3f}', va='center', fontsize=11, fontweight='bold')
    
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"  ROC curve saved to {output_path}")
    return output_path


def save_optimized_config(results, output_path='ml_data/optimized_ci_config.json'):
    """Save optimized configuration with model coefficients for runtime inference."""
    config = {
        'version': '2.0',
        'training_date': datetime.now().strftime('%Y-%m-%d'),
        'training_timestamp': datetime.now().isoformat(),
        'model_type': 'LogisticRegression',
        'cross_validation': '5-fold Stratified',
        'optimal_ci_threshold': results['optimal_ci_threshold'],
        'optimal_proba_threshold': results['optimal_proba_threshold'],
        'model_performance': {
            'auc': results['auc_score'],
            'sensitivity': results['sensitivity'],
            'specificity': results['specificity'],
            'ppv': results['ppv'],
            'npv': results['npv'],
            'accuracy': results['accuracy'],
            'j_statistic': results['j_statistic']
        },
        'model_coefficients': results['model_params'],
        'risk_classification': {
            'LOW': {
                'ci_range': [results['optimal_ci_threshold'], 100],
                'description': 'High confidence — mass balance likely acceptable'
            },
            'MODERATE': {
                'ci_range': [max(0, results['optimal_ci_threshold'] - 15), results['optimal_ci_threshold']],
                'description': 'Borderline — requires expert analytical review'
            },
            'HIGH': {
                'ci_range': [0, max(0, results['optimal_ci_threshold'] - 15)],
                'description': 'Low confidence — investigation recommended'
            }
        },
        'confusion_matrix': {
            'true_positives': results['true_positives'],
            'true_negatives': results['true_negatives'],
            'false_positives': results['false_positives'],
            'false_negatives': results['false_negatives']
        },
        'usage_notes': [
            f"Optimal threshold ({results['optimal_ci_threshold']}%) maximizes Youden's J = {results['j_statistic']:.4f}",
            f"Model AUC = {results['auc_score']:.4f} via 5-fold stratified cross-validation",
            'CI is computed as (1 − P(failure)) × 100 using LogisticRegression',
            'Features: degradation_level, LK-IMB recovery, CIMB recovery',
            'Retrain quarterly or when >50 new validated samples are available'
        ]
    }
    
    with open(output_path, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"  Config saved to {output_path}")
    return config


def main():
    """Main execution pipeline."""
    print("=" * 60)
    print("  ROC-Optimized CI Threshold — ML Pipeline v2.0")
    print("  Model: LogisticRegression | CV: 5-Fold Stratified")
    print("=" * 60)
    
    # Step 1: Load data
    print("\n[1/4] Loading training data...")
    X, y, feature_cols, records = load_training_data()
    n_pass = np.sum(y == 0)
    n_fail = np.sum(y == 1)
    print(f"  Loaded {len(records)} samples ({n_pass} pass / {n_fail} fail)")
    print(f"  Features: {feature_cols}")
    print(f"  Class balance: {n_fail / len(y) * 100:.1f}% failure rate")
    
    # Step 2: Train and evaluate
    print("\n[2/4] Training LogisticRegression with 5-fold CV...")
    results = train_and_evaluate(X, y, feature_cols)
    print(f"  Optimal CI Threshold: {results['optimal_ci_threshold']:.1f}%")
    print(f"  AUC Score:            {results['auc_score']:.4f}")
    print(f"  Sensitivity:          {results['sensitivity']:.4f}")
    print(f"  Specificity:          {results['specificity']:.4f}")
    print(f"  Accuracy:             {results['accuracy']:.4f}")
    print(f"  Youden's J:           {results['j_statistic']:.4f}")
    
    # Step 3: Generate visualization
    print("\n[3/4] Generating ROC visualization...")
    plot_roc_curve(results)
    
    # Step 4: Save config
    print("\n[4/4] Saving optimized configuration...")
    config = save_optimized_config(results)
    
    # Summary
    print("\n" + "=" * 60)
    print("  ✓ ROC Optimization Complete")
    print("=" * 60)
    coeffs = results['model_params']['coefficients']
    print(f"\n  Model equation:")
    print(f"    logit(P_fail) = {results['model_params']['intercept']:.4f}")
    for col, coef in zip(feature_cols, coeffs):
        print(f"                    + {coef:.4f} × {col}_scaled")
    print(f"\n  Threshold: CI ≥ {results['optimal_ci_threshold']}% → PASS")
    print(f"             CI < {results['optimal_ci_threshold']}% → FAIL")
    
    return results


if __name__ == '__main__':
    results = main()
