/**
 * Cost Model Application
 * Robotics Surgical Mining Operations - v3.0
 *
 * Entry point for the fintech-grade cost model configurator
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CostModelConfigurator } from './components/CostModelConfigurator';
import { CostModelEngine } from './engine/CostCalculationEngine';
import type { CostModelConfig } from './config/cost-model-config';
import { createDefaultConfig } from './config/cost-model-config';
import './styles/configurator.css';

// ============================================================================
// APPLICATION STATE MANAGEMENT
// ============================================================================

type AppView = 'configurator' | 'dashboard' | 'reports';

interface AppState {
  config: CostModelConfig;
  currentView: AppView;
  isLoading: boolean;
  lastSaved: Date | null;
  error: string | null;
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    config: createDefaultConfig(),
    currentView: 'configurator',
    isLoading: true,
    lastSaved: null,
    error: null,
  });

  // Load saved configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = localStorage.getItem('costModelConfig');
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig);
          setState((prev) => ({
            ...prev,
            config: parsed,
            isLoading: false,
          }));
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        console.error('Failed to load config:', err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Failed to load saved configuration',
        }));
      }
    };

    loadConfig();
  }, []);

  // Save configuration
  const handleSave = useCallback(async (config: CostModelConfig) => {
    try {
      localStorage.setItem('costModelConfig', JSON.stringify(config));
      setState((prev) => ({
        ...prev,
        config,
        lastSaved: new Date(),
        error: null,
      }));
    } catch (err) {
      console.error('Failed to save config:', err);
      setState((prev) => ({
        ...prev,
        error: 'Failed to save configuration',
      }));
    }
  }, []);

  // Run calculation engine
  const handleCalculate = useCallback(async (config: CostModelConfig) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Initialize engine and recalculate rates
      const engine = new CostModelEngine(config);
      const updatedConfig = engine.recalculateRates();

      setState((prev) => ({
        ...prev,
        config: updatedConfig,
        isLoading: false,
      }));
    } catch (err) {
      console.error('Calculation error:', err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Calculation failed',
      }));
    }
  }, []);

  // Export configuration
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(state.config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cost-model-${state.config.projectParameters.projectCode}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.config]);

  // Import configuration
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setState((prev) => ({
          ...prev,
          config: imported,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          error: 'Invalid configuration file',
        }));
      }
    };
    reader.readAsText(file);
  }, []);

  if (state.isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading Cost Model...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Top Action Bar */}
      <div className="app-toolbar">
        <div className="toolbar-left">
          <h1 className="app-logo">RSM Cost Model</h1>
          <nav className="app-nav">
            <button
              className={state.currentView === 'configurator' ? 'active' : ''}
              onClick={() => setState((prev) => ({ ...prev, currentView: 'configurator' }))}
            >
              Configurator
            </button>
            <button
              className={state.currentView === 'dashboard' ? 'active' : ''}
              onClick={() => setState((prev) => ({ ...prev, currentView: 'dashboard' }))}
            >
              Dashboard
            </button>
            <button
              className={state.currentView === 'reports' ? 'active' : ''}
              onClick={() => setState((prev) => ({ ...prev, currentView: 'reports' }))}
            >
              Reports
            </button>
          </nav>
        </div>

        <div className="toolbar-right">
          <label className="btn-secondary import-btn">
            Import
            <input type="file" accept=".json" onChange={handleImport} hidden />
          </label>
          <button className="btn-secondary" onClick={handleExport}>
            Export
          </button>
          {state.lastSaved && (
            <span className="last-saved">
              Saved: {state.lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {state.error && (
        <div className="error-banner">
          <span>{state.error}</span>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))}>
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="app-main">
        {state.currentView === 'configurator' && (
          <CostModelConfigurator
            initialConfig={state.config}
            onSave={handleSave}
            onCalculate={handleCalculate}
          />
        )}

        {state.currentView === 'dashboard' && (
          <Dashboard config={state.config} />
        )}

        {state.currentView === 'reports' && (
          <Reports config={state.config} />
        )}
      </main>
    </div>
  );
};

// ============================================================================
// DASHBOARD VIEW
// ============================================================================

interface DashboardProps {
  config: CostModelConfig;
}

const Dashboard: React.FC<DashboardProps> = ({ config }) => {
  // Calculate summary metrics
  const equipmentCount = config.equipmentCatalog.items.length;
  const equipmentValue = config.equipmentCatalog.items.reduce(
    (sum, item) => sum + item.baseCost,
    0
  );
  const laborCount = config.laborCatalog.roles.length;
  const laborCost = config.laborCatalog.roles.reduce(
    (sum, role) => sum + role.annualRate * role.burdenRate,
    0
  );

  const oee =
    config.projectParameters.availability.planned *
    config.projectParameters.availability.mechanical *
    config.projectParameters.availability.operational;

  return (
    <div className="dashboard">
      <h2>Project Dashboard</h2>
      <p className="project-subtitle">
        {config.projectParameters.siteName} ({config.projectParameters.projectCode})
      </p>

      <div className="dashboard-grid">
        {/* Project Overview Card */}
        <div className="dashboard-card">
          <h3>Project Overview</h3>
          <dl>
            <dt>Life of Mine</dt>
            <dd>{config.projectParameters.lifeOfMine.years} years</dd>

            <dt>Start Year</dt>
            <dd>{config.projectParameters.lifeOfMine.startYear}</dd>

            <dt>Autonomy Level</dt>
            <dd style={{ textTransform: 'capitalize' }}>
              {config.projectParameters.autonomyLevel.replace('-', ' ')}
            </dd>

            <dt>Overall Equipment Effectiveness</dt>
            <dd>{(oee * 100).toFixed(1)}%</dd>
          </dl>
        </div>

        {/* Equipment Summary Card */}
        <div className="dashboard-card">
          <h3>Equipment Fleet</h3>
          <div className="metric-large">
            <span className="metric-value">{equipmentCount}</span>
            <span className="metric-label">Total Units</span>
          </div>
          <div className="metric-large">
            <span className="metric-value">
              ${(equipmentValue / 1_000_000).toFixed(1)}M
            </span>
            <span className="metric-label">Catalog Value</span>
          </div>

          <h4>By Category</h4>
          <ul className="category-list">
            {['robot', 'hauler', 'drill', 'sensor', 'control', 'support'].map((cat) => {
              const count = config.equipmentCatalog.items.filter(
                (i) => i.category === cat
              ).length;
              return count > 0 ? (
                <li key={cat}>
                  <span className={`category-badge ${cat}`}>{cat}</span>
                  <span>{count}</span>
                </li>
              ) : null;
            })}
          </ul>
        </div>

        {/* Labor Summary Card */}
        <div className="dashboard-card">
          <h3>Labor Force</h3>
          <div className="metric-large">
            <span className="metric-value">{laborCount}</span>
            <span className="metric-label">Defined Roles</span>
          </div>
          <div className="metric-large">
            <span className="metric-value">
              ${(laborCost / 1_000_000).toFixed(2)}M
            </span>
            <span className="metric-label">Annual Loaded Cost</span>
          </div>

          <h4>Jurisdiction</h4>
          <p>{config.laborCatalog.jurisdiction}</p>
        </div>

        {/* FX Rates Card */}
        <div className="dashboard-card">
          <h3>FX Rates</h3>
          <p className="fx-date">As of {config.fxRates.effectiveDate}</p>

          <table className="fx-table">
            <tbody>
              {Object.entries(config.fxRates.rates).map(([currency, rate]) => (
                <tr key={currency}>
                  <td>{currency}</td>
                  <td>{rate.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="fx-source">Source: {config.fxRates.source}</p>
        </div>

        {/* Mining Parameters Card */}
        <div className="dashboard-card wide">
          <h3>Mining Parameters</h3>
          <div className="params-grid">
            <div>
              <dt>Specific Gravity</dt>
              <dd>{config.projectParameters.specificGravity} t/m³</dd>
            </div>
            <div>
              <dt>Precision Tolerance</dt>
              <dd>{config.projectParameters.precisionTolerance.mm} mm</dd>
            </div>
            <div>
              <dt>Robotic Cycle Time</dt>
              <dd>{config.projectParameters.roboticCycleTime.seconds}s</dd>
            </div>
          </div>

          <h4>Penetration Rates</h4>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Rock Type</th>
                <th>Rate (m/hr)</th>
              </tr>
            </thead>
            <tbody>
              {config.projectParameters.penetrationRate.map((rate, idx) => (
                <tr key={idx}>
                  <td>{rate.rockType}</td>
                  <td>{rate.metersPerHour}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Policies Summary Card */}
        <div className="dashboard-card wide">
          <h3>Active Policies</h3>
          <div className="policies-summary">
            <div>
              <h4>Margin Rules</h4>
              <p>{config.marginRules.rules.length} active rules</p>
            </div>
            <div>
              <h4>Risk Premiums</h4>
              <p>{config.riskPremiums.premiums.length} defined premiums</p>
            </div>
            <div>
              <h4>Volume Discounts</h4>
              <p>{config.volumeDiscounts.tiers.length} tiers</p>
            </div>
            <div>
              <h4>Allocation Rules</h4>
              <p>{config.allocationRules.fixedCostAllocations.length} rules</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// REPORTS VIEW
// ============================================================================

interface ReportsProps {
  config: CostModelConfig;
}

const Reports: React.FC<ReportsProps> = ({ config }) => {
  return (
    <div className="reports">
      <h2>Reports & Analytics</h2>

      <div className="reports-list">
        <div className="report-card">
          <h3>CAPEX Summary</h3>
          <p>Capital expenditure breakdown by category</p>
          <button className="btn-primary">Generate Report</button>
        </div>

        <div className="report-card">
          <h3>OPEX Forecast</h3>
          <p>Operating cost projections over LOM</p>
          <button className="btn-primary">Generate Report</button>
        </div>

        <div className="report-card">
          <h3>Sensitivity Analysis</h3>
          <p>Impact of key variables on NPV/IRR</p>
          <button className="btn-primary">Generate Report</button>
        </div>

        <div className="report-card">
          <h3>Block Cost Detail</h3>
          <p>Per-block marginal cost breakdown</p>
          <button className="btn-primary">Generate Report</button>
        </div>

        <div className="report-card">
          <h3>Equipment Utilization</h3>
          <p>Fleet efficiency and availability analysis</p>
          <button className="btn-primary">Generate Report</button>
        </div>

        <div className="report-card">
          <h3>Labor Cost Analysis</h3>
          <p>Workforce cost distribution and trends</p>
          <button className="btn-primary">Generate Report</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ADDITIONAL STYLES
// ============================================================================

const additionalStyles = `
  .app-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--color-bg-secondary);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .app-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-6);
    background: var(--color-bg-dark);
    color: white;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .app-logo {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .app-nav {
    display: flex;
    gap: var(--space-1);
  }

  .app-nav button {
    padding: var(--space-2) var(--space-4);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .app-nav button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .app-nav button.active {
    background: var(--color-primary);
    color: white;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .toolbar-right .btn-secondary {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.3);
    color: white;
  }

  .toolbar-right .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .last-saved {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .error-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) var(--space-6);
    background: #fef2f2;
    border-bottom: 1px solid #fecaca;
    color: var(--color-danger);
  }

  .app-main {
    flex: 1;
    overflow: auto;
  }

  /* Dashboard Styles */
  .dashboard {
    padding: var(--space-6);
  }

  .dashboard h2 {
    margin: 0 0 var(--space-2);
  }

  .project-subtitle {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-6);
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-4);
  }

  .dashboard-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    box-shadow: var(--shadow-sm);
  }

  .dashboard-card.wide {
    grid-column: span 2;
  }

  .dashboard-card h3 {
    margin: 0 0 var(--space-4);
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dashboard-card h4 {
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }

  .dashboard-card dl {
    margin: 0;
  }

  .dashboard-card dt {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-3);
  }

  .dashboard-card dd {
    margin: var(--space-1) 0 0;
    font-size: var(--font-size-base);
    font-weight: 500;
  }

  .metric-large {
    display: flex;
    flex-direction: column;
    margin-bottom: var(--space-4);
  }

  .metric-value {
    font-size: var(--font-size-2xl);
    font-weight: 700;
    color: var(--color-primary);
  }

  .metric-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .category-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .category-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .fx-date {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--space-3);
  }

  .fx-table {
    width: 100%;
    font-family: var(--font-mono);
  }

  .fx-table td {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .fx-table td:last-child {
    text-align: right;
  }

  .fx-source {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-3);
    text-transform: capitalize;
  }

  .params-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .params-grid dt {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .params-grid dd {
    margin: var(--space-1) 0 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .policies-summary {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4);
  }

  .policies-summary h4 {
    margin: 0 0 var(--space-1);
    font-size: var(--font-size-sm);
  }

  .policies-summary p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  /* Reports Styles */
  .reports {
    padding: var(--space-6);
  }

  .reports h2 {
    margin: 0 0 var(--space-6);
  }

  .reports-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-4);
  }

  .report-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    box-shadow: var(--shadow-sm);
  }

  .report-card h3 {
    margin: 0 0 var(--space-2);
    font-size: var(--font-size-base);
  }

  .report-card p {
    margin: 0 0 var(--space-4);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
`;

// Inject additional styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = additionalStyles;
  document.head.appendChild(styleEl);
}

export default App;
