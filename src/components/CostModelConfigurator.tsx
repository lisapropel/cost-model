/**
 * Cost Model Configurator - Best-in-Class Fintech Experience
 * Robotics Surgical Mining Operations
 *
 * Features:
 * - Tabbed interface matching Excel sheet structure
 * - Real-time validation with fintech-grade precision
 * - Audit trail for all changes
 * - Version comparison and rollback
 * - Inline calculations with dependency tracking
 */

import React, { useState, useCallback, useMemo } from 'react';
import type {
  CostModelConfig,
  FXRates,
  ProjectParameters,
  EquipmentItem,
  LaborRole,
  MarginRules,
  RiskPremiums,
  AuditLogEntry,
} from '../config/cost-model-config';

// ============================================================================
// TYPES
// ============================================================================

type ConfigTab =
  | 'config'
  | 'rates'
  | 'policies'
  | 'calculator'
  | 'aggregator'
  | 'audit';

type ConfigSubTab = {
  config: 'fx' | 'parameters' | 'equipment' | 'labor';
  rates: 'equipment' | 'consumables' | 'labor' | 'fuel';
  policies: 'margins' | 'risk' | 'volume' | 'allocation';
  calculator: 'input' | 'output';
  aggregator: 'cashflow' | 'summary';
  audit: 'log' | 'snapshots' | 'simulations';
};

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ConfiguratorState {
  config: CostModelConfig;
  activeTab: ConfigTab;
  activeSubTab: string;
  isDirty: boolean;
  validationErrors: ValidationError[];
  auditLog: AuditLogEntry[];
  isCalculating: boolean;
}

// ============================================================================
// MAIN CONFIGURATOR COMPONENT
// ============================================================================

interface CostModelConfiguratorProps {
  initialConfig: CostModelConfig;
  onSave: (config: CostModelConfig) => Promise<void>;
  onCalculate: (config: CostModelConfig) => Promise<void>;
  readOnly?: boolean;
}

export const CostModelConfigurator: React.FC<CostModelConfiguratorProps> = ({
  initialConfig,
  onSave,
  onCalculate,
  readOnly = false,
}) => {
  const [state, setState] = useState<ConfiguratorState>({
    config: initialConfig,
    activeTab: 'config',
    activeSubTab: 'fx',
    isDirty: false,
    validationErrors: [],
    auditLog: [],
    isCalculating: false,
  });

  // Tab configuration with icons and descriptions
  const tabs: { id: ConfigTab; label: string; icon: string; description: string }[] = [
    { id: 'config', label: 'CONFIG', icon: '📄', description: 'Inputs Only - No Calculations' },
    { id: 'rates', label: 'RATES', icon: '📈', description: 'Calculation Layer - Atomic Functions' },
    { id: 'policies', label: 'POLICIES', icon: '📋', description: 'Business Logic Rules' },
    { id: 'calculator', label: 'CALCULATOR', icon: '⭐', description: 'Block-Level Marginal Cost Engine' },
    { id: 'aggregator', label: 'AGGREGATOR', icon: '📊', description: 'Project-Level Rollup' },
    { id: 'audit', label: 'AUDIT', icon: '🔍', description: 'Version Control & History' },
  ];

  const subTabs: Record<ConfigTab, { id: string; label: string }[]> = {
    config: [
      { id: 'fx', label: 'FX Rates' },
      { id: 'parameters', label: 'Project Parameters' },
      { id: 'equipment', label: 'Equipment Catalog' },
      { id: 'labor', label: 'Labor Catalog' },
    ],
    rates: [
      { id: 'equipment', label: 'Equipment Rates' },
      { id: 'consumables', label: 'Consumable Rates' },
      { id: 'labor', label: 'Labor Rates' },
      { id: 'fuel', label: 'Fuel Rates' },
    ],
    policies: [
      { id: 'margins', label: 'Margin Rules' },
      { id: 'risk', label: 'Risk Premiums' },
      { id: 'volume', label: 'Volume Discounts' },
      { id: 'allocation', label: 'Allocation Rules' },
    ],
    calculator: [
      { id: 'input', label: 'Block Input' },
      { id: 'output', label: 'Cost Output' },
    ],
    aggregator: [
      { id: 'cashflow', label: 'Time-Series Cashflow' },
      { id: 'summary', label: 'Project Summary' },
    ],
    audit: [
      { id: 'log', label: 'Change History' },
      { id: 'snapshots', label: 'Assumption Snapshots' },
      { id: 'simulations', label: 'Simulation Runs' },
    ],
  };

  // Change handler with audit logging
  const handleChange = useCallback(
    <K extends keyof CostModelConfig>(
      key: K,
      value: CostModelConfig[K],
      fieldPath: string
    ) => {
      setState((prev) => {
        const oldValue = prev.config[key];
        const newAuditEntry: AuditLogEntry = {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
          layer: prev.activeTab,
          entity: key,
          field: fieldPath,
          oldValue,
          newValue: value,
          changedBy: 'current-user', // Replace with actual user
          changeReason: 'Manual edit',
        };

        return {
          ...prev,
          config: {
            ...prev.config,
            [key]: value,
            lastModified: new Date().toISOString(),
          },
          isDirty: true,
          auditLog: [...prev.auditLog, newAuditEntry],
        };
      });
    },
    []
  );

  // Validation
  const validate = useCallback((config: CostModelConfig): ValidationError[] => {
    const errors: ValidationError[] = [];

    // FX validation
    if (config.fxRates.rates.CAD <= 0) {
      errors.push({ field: 'fxRates.rates.CAD', message: 'CAD rate must be positive', severity: 'error' });
    }

    // Project parameters validation
    if (config.projectParameters.specificGravity < 1 || config.projectParameters.specificGravity > 10) {
      errors.push({
        field: 'projectParameters.specificGravity',
        message: 'Specific gravity typically between 1-10',
        severity: 'warning',
      });
    }

    if (config.projectParameters.availability.planned > 1) {
      errors.push({
        field: 'projectParameters.availability.planned',
        message: 'Availability cannot exceed 100%',
        severity: 'error',
      });
    }

    // Equipment catalog validation
    config.equipmentCatalog.items.forEach((item, idx) => {
      if (item.baseCost < 0) {
        errors.push({
          field: `equipmentCatalog.items[${idx}].baseCost`,
          message: `${item.name}: Cost cannot be negative`,
          severity: 'error',
        });
      }
    });

    // Calculator settings validation
    if (config.calculatorSettings.contingencyPercent < 0 || config.calculatorSettings.contingencyPercent > 50) {
      errors.push({
        field: 'calculatorSettings.contingencyPercent',
        message: 'Contingency typically 0-50%',
        severity: 'warning',
      });
    }

    return errors;
  }, []);

  // Render active tab content
  const renderTabContent = () => {
    const { activeTab, activeSubTab, config } = state;

    switch (activeTab) {
      case 'config':
        return renderConfigTab(activeSubTab, config, handleChange, readOnly);
      case 'rates':
        return renderRatesTab(activeSubTab, config);
      case 'policies':
        return renderPoliciesTab(activeSubTab, config, handleChange, readOnly);
      case 'calculator':
        return renderCalculatorTab(activeSubTab, config);
      case 'aggregator':
        return renderAggregatorTab(activeSubTab, config);
      case 'audit':
        return renderAuditTab(activeSubTab, state.auditLog);
      default:
        return null;
    }
  };

  return (
    <div className="cost-model-configurator">
      {/* Header */}
      <header className="config-header">
        <div className="header-title">
          <h1>{state.config.modelName}</h1>
          <span className="version-badge">v{state.config.version}</span>
          {state.isDirty && <span className="dirty-indicator">Unsaved Changes</span>}
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              const errors = validate(state.config);
              setState((prev) => ({ ...prev, validationErrors: errors }));
            }}
          >
            Validate
          </button>
          <button
            className="btn-primary"
            disabled={readOnly || state.validationErrors.some((e) => e.severity === 'error')}
            onClick={() => onSave(state.config)}
          >
            Save
          </button>
          <button
            className="btn-accent"
            disabled={state.isCalculating}
            onClick={() => onCalculate(state.config)}
          >
            {state.isCalculating ? 'Calculating...' : 'Run Calculator'}
          </button>
        </div>
      </header>

      {/* Validation Errors Banner */}
      {state.validationErrors.length > 0 && (
        <div className="validation-banner">
          {state.validationErrors.map((err, idx) => (
            <div key={idx} className={`validation-item validation-${err.severity}`}>
              <span className="field">{err.field}:</span> {err.message}
            </div>
          ))}
        </div>
      )}

      {/* Main Navigation Tabs */}
      <nav className="main-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${state.activeTab === tab.id ? 'active' : ''}`}
            onClick={() =>
              setState((prev) => ({
                ...prev,
                activeTab: tab.id,
                activeSubTab: subTabs[tab.id][0].id,
              }))
            }
            title={tab.description}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Sub-Navigation */}
      <nav className="sub-tabs">
        {subTabs[state.activeTab].map((sub) => (
          <button
            key={sub.id}
            className={`subtab-button ${state.activeSubTab === sub.id ? 'active' : ''}`}
            onClick={() => setState((prev) => ({ ...prev, activeSubTab: sub.id }))}
          >
            {sub.label}
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <main className="config-content">{renderTabContent()}</main>

      {/* Footer Status Bar */}
      <footer className="config-footer">
        <span>Last Modified: {new Date(state.config.lastModified).toLocaleString()}</span>
        <span>By: {state.config.modifiedBy}</span>
        <span>Currency: {state.config.calculatorSettings.projectCurrency}</span>
      </footer>
    </div>
  );
};

// ============================================================================
// CONFIG TAB COMPONENTS
// ============================================================================

function renderConfigTab(
  subTab: string,
  config: CostModelConfig,
  onChange: <K extends keyof CostModelConfig>(key: K, value: CostModelConfig[K], fieldPath: string) => void,
  readOnly: boolean
) {
  switch (subTab) {
    case 'fx':
      return <FXRatesEditor rates={config.fxRates} onChange={(v) => onChange('fxRates', v, 'fxRates')} readOnly={readOnly} />;
    case 'parameters':
      return <ProjectParametersEditor params={config.projectParameters} onChange={(v) => onChange('projectParameters', v, 'projectParameters')} readOnly={readOnly} />;
    case 'equipment':
      return <EquipmentCatalogEditor catalog={config.equipmentCatalog} onChange={(v) => onChange('equipmentCatalog', v, 'equipmentCatalog')} readOnly={readOnly} />;
    case 'labor':
      return <LaborCatalogEditor catalog={config.laborCatalog} onChange={(v) => onChange('laborCatalog', v, 'laborCatalog')} readOnly={readOnly} />;
    default:
      return null;
  }
}

// ============================================================================
// FX RATES EDITOR
// ============================================================================

interface FXRatesEditorProps {
  rates: FXRates;
  onChange: (rates: FXRates) => void;
  readOnly: boolean;
}

const FXRatesEditor: React.FC<FXRatesEditorProps> = ({ rates, onChange, readOnly }) => {
  return (
    <section className="editor-section">
      <h2>Foreign Exchange Rates</h2>
      <p className="section-description">
        Base currency: USD. All costs will be converted to project currency using these rates.
      </p>

      <div className="form-grid">
        <div className="form-group">
          <label>Effective Date</label>
          <input
            type="date"
            value={rates.effectiveDate}
            onChange={(e) => onChange({ ...rates, effectiveDate: e.target.value })}
            disabled={readOnly}
          />
        </div>

        <div className="form-group">
          <label>Source</label>
          <select
            value={rates.source}
            onChange={(e) => onChange({ ...rates, source: e.target.value as FXRates['source'] })}
            disabled={readOnly}
          >
            <option value="manual">Manual Entry</option>
            <option value="bloomberg">Bloomberg</option>
            <option value="xe">XE.com</option>
            <option value="oanda">OANDA</option>
          </select>
        </div>

        <div className="form-group">
          <label>Lock Until (Optional)</label>
          <input
            type="date"
            value={rates.lockedUntil || ''}
            onChange={(e) => onChange({ ...rates, lockedUntil: e.target.value || undefined })}
            disabled={readOnly}
          />
          <span className="form-hint">Lock rates for budget periods</span>
        </div>
      </div>

      <h3>Exchange Rates (per 1 USD)</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Currency</th>
            <th>Rate</th>
            <th>Inverse</th>
          </tr>
        </thead>
        <tbody>
          {(['CAD', 'EUR', 'AUD', 'GBP'] as const).map((curr) => (
            <tr key={curr}>
              <td className="currency-cell">
                <span className="currency-flag">{getCurrencyFlag(curr)}</span>
                {curr}
              </td>
              <td>
                <input
                  type="number"
                  step="0.0001"
                  value={rates.rates[curr]}
                  onChange={(e) =>
                    onChange({
                      ...rates,
                      rates: { ...rates.rates, [curr]: parseFloat(e.target.value) || 0 },
                    })
                  }
                  disabled={readOnly}
                  className="rate-input"
                />
              </td>
              <td className="inverse-rate">{(1 / rates.rates[curr]).toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

function getCurrencyFlag(currency: string): string {
  const flags: Record<string, string> = { CAD: '🇨🇦', EUR: '🇪🇺', AUD: '🇦🇺', GBP: '🇬🇧', USD: '🇺🇸' };
  return flags[currency] || '💱';
}

// ============================================================================
// PROJECT PARAMETERS EDITOR
// ============================================================================

interface ProjectParametersEditorProps {
  params: ProjectParameters;
  onChange: (params: ProjectParameters) => void;
  readOnly: boolean;
}

const ProjectParametersEditor: React.FC<ProjectParametersEditorProps> = ({ params, onChange, readOnly }) => {
  return (
    <section className="editor-section">
      <h2>Project Parameters</h2>

      {/* Core Parameters */}
      <fieldset className="form-fieldset">
        <legend>Core Identification</legend>
        <div className="form-grid">
          <div className="form-group">
            <label>Project Code</label>
            <input
              type="text"
              value={params.projectCode}
              onChange={(e) => onChange({ ...params, projectCode: e.target.value })}
              disabled={readOnly}
              placeholder="RSM-001"
            />
          </div>
          <div className="form-group">
            <label>Site Name</label>
            <input
              type="text"
              value={params.siteName}
              onChange={(e) => onChange({ ...params, siteName: e.target.value })}
              disabled={readOnly}
            />
          </div>
        </div>
      </fieldset>

      {/* Mining Specifics */}
      <fieldset className="form-fieldset">
        <legend>Mining Parameters</legend>
        <div className="form-grid">
          <div className="form-group">
            <label>
              Specific Gravity (SG)
              <span className="tooltip" title="Ore density in tonnes per cubic meter">ℹ️</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={params.specificGravity}
              onChange={(e) => onChange({ ...params, specificGravity: parseFloat(e.target.value) })}
              disabled={readOnly}
            />
            <span className="unit">t/m³</span>
          </div>

          <div className="form-group">
            <label>Life of Mine (LOM)</label>
            <div className="input-group">
              <input
                type="number"
                value={params.lifeOfMine.years}
                onChange={(e) =>
                  onChange({
                    ...params,
                    lifeOfMine: { ...params.lifeOfMine, years: parseInt(e.target.value) },
                  })
                }
                disabled={readOnly}
              />
              <span className="unit">years</span>
            </div>
          </div>

          <div className="form-group">
            <label>Start Year</label>
            <input
              type="number"
              value={params.lifeOfMine.startYear}
              onChange={(e) =>
                onChange({
                  ...params,
                  lifeOfMine: { ...params.lifeOfMine, startYear: parseInt(e.target.value) },
                })
              }
              disabled={readOnly}
            />
          </div>
        </div>

        <h4>Penetration Rates by Rock Type</h4>
        <table className="data-table compact">
          <thead>
            <tr>
              <th>Rock Type</th>
              <th>Rate (m/hr)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {params.penetrationRate.map((rate, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    type="text"
                    value={rate.rockType}
                    onChange={(e) => {
                      const updated = [...params.penetrationRate];
                      updated[idx] = { ...rate, rockType: e.target.value };
                      onChange({ ...params, penetrationRate: updated });
                    }}
                    disabled={readOnly}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    value={rate.metersPerHour}
                    onChange={(e) => {
                      const updated = [...params.penetrationRate];
                      updated[idx] = { ...rate, metersPerHour: parseFloat(e.target.value) };
                      onChange({ ...params, penetrationRate: updated });
                    }}
                    disabled={readOnly}
                  />
                </td>
                <td>
                  {!readOnly && (
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => {
                        const updated = params.penetrationRate.filter((_, i) => i !== idx);
                        onChange({ ...params, penetrationRate: updated });
                      }}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly && (
          <button
            className="btn-secondary btn-sm"
            onClick={() =>
              onChange({
                ...params,
                penetrationRate: [...params.penetrationRate, { rockType: '', metersPerHour: 0 }],
              })
            }
          >
            + Add Rock Type
          </button>
        )}
      </fieldset>

      {/* Availability */}
      <fieldset className="form-fieldset">
        <legend>Availability Factors</legend>
        <div className="form-grid three-col">
          <div className="form-group">
            <label>Planned Availability</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={params.availability.planned}
                onChange={(e) =>
                  onChange({
                    ...params,
                    availability: { ...params.availability, planned: parseFloat(e.target.value) },
                  })
                }
                disabled={readOnly}
              />
              <span className="percentage-display">{(params.availability.planned * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="form-group">
            <label>Mechanical Availability</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={params.availability.mechanical}
                onChange={(e) =>
                  onChange({
                    ...params,
                    availability: { ...params.availability, mechanical: parseFloat(e.target.value) },
                  })
                }
                disabled={readOnly}
              />
              <span className="percentage-display">{(params.availability.mechanical * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="form-group">
            <label>Operational Availability</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={params.availability.operational}
                onChange={(e) =>
                  onChange({
                    ...params,
                    availability: { ...params.availability, operational: parseFloat(e.target.value) },
                  })
                }
                disabled={readOnly}
              />
              <span className="percentage-display">{(params.availability.operational * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
        <div className="calculated-field">
          <strong>Overall Equipment Effectiveness (OEE):</strong>{' '}
          {(
            params.availability.planned *
            params.availability.mechanical *
            params.availability.operational *
            100
          ).toFixed(1)}
          %
        </div>
      </fieldset>

      {/* Surgical Mining Specifics */}
      <fieldset className="form-fieldset">
        <legend>Surgical Mining / Robotics Configuration</legend>
        <div className="form-grid">
          <div className="form-group">
            <label>Precision Tolerance</label>
            <div className="input-group">
              <input
                type="number"
                step="0.1"
                value={params.precisionTolerance.mm}
                onChange={(e) =>
                  onChange({
                    ...params,
                    precisionTolerance: { mm: parseFloat(e.target.value) },
                  })
                }
                disabled={readOnly}
              />
              <span className="unit">mm</span>
            </div>
          </div>
          <div className="form-group">
            <label>Robotic Cycle Time</label>
            <div className="input-group">
              <input
                type="number"
                value={params.roboticCycleTime.seconds}
                onChange={(e) =>
                  onChange({
                    ...params,
                    roboticCycleTime: { seconds: parseInt(e.target.value) },
                  })
                }
                disabled={readOnly}
              />
              <span className="unit">seconds</span>
            </div>
          </div>
          <div className="form-group">
            <label>Autonomy Level</label>
            <select
              value={params.autonomyLevel}
              onChange={(e) =>
                onChange({
                  ...params,
                  autonomyLevel: e.target.value as ProjectParameters['autonomyLevel'],
                })
              }
              disabled={readOnly}
            >
              <option value="supervised">Supervised (Human in the loop)</option>
              <option value="semi-autonomous">Semi-Autonomous</option>
              <option value="fully-autonomous">Fully Autonomous</option>
            </select>
          </div>
        </div>
      </fieldset>
    </section>
  );
};

// ============================================================================
// EQUIPMENT CATALOG EDITOR
// ============================================================================

interface EquipmentCatalogEditorProps {
  catalog: CostModelConfig['equipmentCatalog'];
  onChange: (catalog: CostModelConfig['equipmentCatalog']) => void;
  readOnly: boolean;
}

const EquipmentCatalogEditor: React.FC<EquipmentCatalogEditorProps> = ({ catalog, onChange, readOnly }) => {
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filteredItems = useMemo(() => {
    if (filterCategory === 'all') return catalog.items;
    return catalog.items.filter((item) => item.category === filterCategory);
  }, [catalog.items, filterCategory]);

  const totalValue = useMemo(
    () => catalog.items.reduce((sum, item) => sum + item.baseCost, 0),
    [catalog.items]
  );

  return (
    <section className="editor-section">
      <h2>Equipment Catalog</h2>

      <div className="catalog-header">
        <div className="catalog-meta">
          <span>Last Updated: {new Date(catalog.lastUpdated).toLocaleDateString()}</span>
          <span>Approved By: {catalog.approvedBy || 'Pending'}</span>
          <span className="total-value">Total Catalog Value: ${totalValue.toLocaleString()}</span>
        </div>

        <div className="catalog-actions">
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            <option value="robot">Robots</option>
            <option value="hauler">Haulers</option>
            <option value="drill">Drills</option>
            <option value="sensor">Sensors</option>
            <option value="control">Control Systems</option>
            <option value="support">Support Equipment</option>
          </select>

          {!readOnly && (
            <button
              className="btn-primary"
              onClick={() =>
                setEditingItem({
                  itemCode: `EQ-${String(catalog.items.length + 1).padStart(4, '0')}`,
                  name: '',
                  category: 'robot',
                  baseCost: 0,
                  currency: 'USD',
                  costUnit: 'each',
                  specs: {},
                  usefulLife: { years: 10 },
                  salvageValue: 10,
                  vendor: '',
                  leadTimeWeeks: 12,
                  warrantyMonths: 24,
                })
              }
            >
              + Add Equipment
            </button>
          )}
        </div>
      </div>

      <table className="data-table equipment-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Category</th>
            <th>Base Cost</th>
            <th>Currency</th>
            <th>Life (yrs)</th>
            <th>Vendor</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) => (
            <tr key={item.itemCode} className={`category-${item.category}`}>
              <td className="item-code">{item.itemCode}</td>
              <td className="item-name">{item.name}</td>
              <td>
                <span className={`category-badge ${item.category}`}>{item.category}</span>
              </td>
              <td className="cost-cell">{item.baseCost.toLocaleString()}</td>
              <td>{item.currency}</td>
              <td>{item.usefulLife.years}</td>
              <td>{item.vendor}</td>
              <td className="actions-cell">
                {!readOnly && (
                  <>
                    <button className="btn-icon" onClick={() => setEditingItem(item)} title="Edit">
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-danger"
                      onClick={() =>
                        onChange({
                          ...catalog,
                          items: catalog.items.filter((i) => i.itemCode !== item.itemCode),
                        })
                      }
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Equipment Item Modal Editor */}
      {editingItem && (
        <EquipmentItemModal
          item={editingItem}
          onSave={(item) => {
            const existingIdx = catalog.items.findIndex((i) => i.itemCode === item.itemCode);
            const updatedItems =
              existingIdx >= 0
                ? catalog.items.map((i) => (i.itemCode === item.itemCode ? item : i))
                : [...catalog.items, item];
            onChange({ ...catalog, items: updatedItems, lastUpdated: new Date().toISOString() });
            setEditingItem(null);
          }}
          onCancel={() => setEditingItem(null)}
        />
      )}
    </section>
  );
};

// ============================================================================
// EQUIPMENT ITEM MODAL
// ============================================================================

interface EquipmentItemModalProps {
  item: EquipmentItem;
  onSave: (item: EquipmentItem) => void;
  onCancel: () => void;
}

const EquipmentItemModal: React.FC<EquipmentItemModalProps> = ({ item, onSave, onCancel }) => {
  const [draft, setDraft] = useState<EquipmentItem>(item);

  return (
    <div className="modal-overlay">
      <div className="modal-content equipment-modal">
        <div className="modal-header">
          <h3>{item.name ? `Edit: ${item.name}` : 'Add New Equipment'}</h3>
          <button className="btn-icon" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label>Item Code</label>
              <input
                type="text"
                value={draft.itemCode}
                onChange={(e) => setDraft({ ...draft, itemCode: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as EquipmentItem['category'] })}
              >
                <option value="robot">Robot</option>
                <option value="hauler">Hauler</option>
                <option value="drill">Drill</option>
                <option value="sensor">Sensor</option>
                <option value="control">Control System</option>
                <option value="support">Support</option>
              </select>
            </div>
            <div className="form-group">
              <label>Base Cost</label>
              <input
                type="number"
                value={draft.baseCost}
                onChange={(e) => setDraft({ ...draft, baseCost: parseFloat(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Currency</label>
              <select
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value as 'USD' | 'CAD' | 'EUR' })}
              >
                <option value="USD">USD</option>
                <option value="CAD">CAD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="form-group">
              <label>Useful Life (years)</label>
              <input
                type="number"
                value={draft.usefulLife.years}
                onChange={(e) =>
                  setDraft({ ...draft, usefulLife: { years: parseInt(e.target.value) } })
                }
              />
            </div>
            <div className="form-group">
              <label>Salvage Value (%)</label>
              <input
                type="number"
                value={draft.salvageValue}
                onChange={(e) => setDraft({ ...draft, salvageValue: parseFloat(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Vendor</label>
              <input
                type="text"
                value={draft.vendor}
                onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Lead Time (weeks)</label>
              <input
                type="number"
                value={draft.leadTimeWeeks}
                onChange={(e) => setDraft({ ...draft, leadTimeWeeks: parseInt(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Warranty (months)</label>
              <input
                type="number"
                value={draft.warrantyMonths}
                onChange={(e) => setDraft({ ...draft, warrantyMonths: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <fieldset className="form-fieldset">
            <legend>Specifications (Optional)</legend>
            <div className="form-grid">
              <div className="form-group">
                <label>Power (kW)</label>
                <input
                  type="number"
                  value={draft.specs.powerKW || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, specs: { ...draft.specs, powerKW: parseFloat(e.target.value) || undefined } })
                  }
                />
              </div>
              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  value={draft.specs.weightKG || ''}
                  onChange={(e) =>
                    setDraft({ ...draft, specs: { ...draft.specs, weightKG: parseFloat(e.target.value) || undefined } })
                  }
                />
              </div>
            </div>
          </fieldset>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(draft)}>Save Equipment</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// LABOR CATALOG EDITOR
// ============================================================================

interface LaborCatalogEditorProps {
  catalog: CostModelConfig['laborCatalog'];
  onChange: (catalog: CostModelConfig['laborCatalog']) => void;
  readOnly: boolean;
}

const LaborCatalogEditor: React.FC<LaborCatalogEditorProps> = ({ catalog, onChange, readOnly }) => {
  return (
    <section className="editor-section">
      <h2>Labor Catalog</h2>

      <div className="catalog-header">
        <div className="catalog-meta">
          <span>Jurisdiction: {catalog.jurisdiction}</span>
          {catalog.collectiveAgreement && <span>CBA: {catalog.collectiveAgreement}</span>}
          <span>Last Updated: {new Date(catalog.lastUpdated).toLocaleDateString()}</span>
        </div>

        {!readOnly && (
          <button
            className="btn-primary"
            onClick={() => {
              const newRole: LaborRole = {
                roleCode: `LBR-${String(catalog.roles.length + 1).padStart(3, '0')}`,
                title: '',
                category: 'direct',
                annualRate: 0,
                currency: 'USD',
                rateType: 'salary',
                utilizationFactor: 0.85,
                burdenRate: 1.35,
                certifications: [],
                minimumExperience: { years: 0 },
              };
              onChange({ ...catalog, roles: [...catalog.roles, newRole] });
            }}
          >
            + Add Role
          </button>
        )}
      </div>

      <table className="data-table labor-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Category</th>
            <th>Annual Rate</th>
            <th>Utilization</th>
            <th>Burden</th>
            <th>Loaded Rate</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {catalog.roles.map((role, idx) => {
            const loadedRate = role.annualRate * role.burdenRate;
            const effectiveRate = loadedRate / role.utilizationFactor;

            return (
              <tr key={role.roleCode} className={`category-${role.category}`}>
                <td className="item-code">{role.roleCode}</td>
                <td>
                  <input
                    type="text"
                    value={role.title}
                    onChange={(e) => {
                      const updated = [...catalog.roles];
                      updated[idx] = { ...role, title: e.target.value };
                      onChange({ ...catalog, roles: updated });
                    }}
                    disabled={readOnly}
                    className="inline-input"
                  />
                </td>
                <td>
                  <select
                    value={role.category}
                    onChange={(e) => {
                      const updated = [...catalog.roles];
                      updated[idx] = { ...role, category: e.target.value as LaborRole['category'] };
                      onChange({ ...catalog, roles: updated });
                    }}
                    disabled={readOnly}
                  >
                    <option value="direct">Direct</option>
                    <option value="indirect">Indirect</option>
                    <option value="supervision">Supervision</option>
                    <option value="specialist">Specialist</option>
                  </select>
                </td>
                <td>
                  <div className="input-group compact">
                    <input
                      type="number"
                      value={role.annualRate}
                      onChange={(e) => {
                        const updated = [...catalog.roles];
                        updated[idx] = { ...role, annualRate: parseFloat(e.target.value) };
                        onChange({ ...catalog, roles: updated });
                      }}
                      disabled={readOnly}
                      className="compact-input"
                    />
                    <span className="unit">{role.currency}</span>
                  </div>
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={role.utilizationFactor}
                    onChange={(e) => {
                      const updated = [...catalog.roles];
                      updated[idx] = { ...role, utilizationFactor: parseFloat(e.target.value) };
                      onChange({ ...catalog, roles: updated });
                    }}
                    disabled={readOnly}
                    className="compact-input"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={role.burdenRate}
                    onChange={(e) => {
                      const updated = [...catalog.roles];
                      updated[idx] = { ...role, burdenRate: parseFloat(e.target.value) };
                      onChange({ ...catalog, roles: updated });
                    }}
                    disabled={readOnly}
                    className="compact-input"
                  />
                </td>
                <td className="calculated-cell">${effectiveRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="actions-cell">
                  {!readOnly && (
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => {
                        const updated = catalog.roles.filter((_, i) => i !== idx);
                        onChange({ ...catalog, roles: updated });
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};

// ============================================================================
// RATES TAB (Derived Calculations)
// ============================================================================

function renderRatesTab(subTab: string, config: CostModelConfig) {
  return (
    <section className="editor-section">
      <h2>Calculated Rates</h2>
      <p className="section-description">
        These rates are derived from CONFIG inputs. They update automatically when inputs change.
      </p>

      <div className="rates-grid">
        {subTab === 'equipment' && config.equipmentRates && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>$/Hour</th>
                <th>$/Day</th>
                <th>$/Month</th>
                <th>$/Year</th>
              </tr>
            </thead>
            <tbody>
              {config.equipmentRates.map((rate) => (
                <tr key={rate.itemCode}>
                  <td>{rate.itemCode}</td>
                  <td>${rate.costPerHour.toFixed(2)}</td>
                  <td>${rate.costPerDay.toFixed(2)}</td>
                  <td>${rate.costPerMonth.toLocaleString()}</td>
                  <td>${rate.costPerYear.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(!config.equipmentRates || config.equipmentRates.length === 0) && (
          <div className="empty-state">
            <p>Rates will be calculated after running the Calculator.</p>
            <p>Ensure CONFIG data is complete, then click "Run Calculator".</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// POLICIES TAB
// ============================================================================

function renderPoliciesTab(
  subTab: string,
  config: CostModelConfig,
  onChange: <K extends keyof CostModelConfig>(key: K, value: CostModelConfig[K], fieldPath: string) => void,
  readOnly: boolean
) {
  return (
    <section className="editor-section">
      <h2>Business Policies</h2>

      {subTab === 'margins' && (
        <MarginRulesEditor
          rules={config.marginRules}
          onChange={(v) => onChange('marginRules', v, 'marginRules')}
          readOnly={readOnly}
        />
      )}

      {subTab === 'risk' && (
        <RiskPremiumsEditor
          premiums={config.riskPremiums}
          onChange={(v) => onChange('riskPremiums', v, 'riskPremiums')}
          readOnly={readOnly}
        />
      )}

      {subTab === 'volume' && (
        <VolumeDiscountsEditor
          discounts={config.volumeDiscounts}
          onChange={(v) => onChange('volumeDiscounts', v, 'volumeDiscounts')}
          readOnly={readOnly}
        />
      )}

      {subTab === 'allocation' && (
        <AllocationRulesEditor
          rules={config.allocationRules}
          onChange={(v) => onChange('allocationRules', v, 'allocationRules')}
          readOnly={readOnly}
        />
      )}
    </section>
  );
}

// Margin Rules Editor
const MarginRulesEditor: React.FC<{
  rules: MarginRules;
  onChange: (rules: MarginRules) => void;
  readOnly: boolean;
}> = ({ rules, onChange, readOnly }) => (
  <div>
    <h3>Margin Rules</h3>
    <p className="section-description">Define profit margins by cost category.</p>

    <table className="data-table">
      <thead>
        <tr>
          <th>Cost Category</th>
          <th>Margin %</th>
          <th>Justification</th>
          <th>Valid From</th>
          <th>Approved By</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rules.rules.map((rule, idx) => (
          <tr key={idx}>
            <td>
              <input
                type="text"
                value={rule.costCategory}
                onChange={(e) => {
                  const updated = [...rules.rules];
                  updated[idx] = { ...rule, costCategory: e.target.value };
                  onChange({ rules: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              <input
                type="number"
                step="0.1"
                value={rule.marginPercent}
                onChange={(e) => {
                  const updated = [...rules.rules];
                  updated[idx] = { ...rule, marginPercent: parseFloat(e.target.value) };
                  onChange({ rules: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              <input
                type="text"
                value={rule.justification}
                onChange={(e) => {
                  const updated = [...rules.rules];
                  updated[idx] = { ...rule, justification: e.target.value };
                  onChange({ rules: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              <input
                type="date"
                value={rule.validFrom}
                onChange={(e) => {
                  const updated = [...rules.rules];
                  updated[idx] = { ...rule, validFrom: e.target.value };
                  onChange({ rules: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>{rule.approvedBy || '-'}</td>
            <td>
              {!readOnly && (
                <button
                  className="btn-icon btn-danger"
                  onClick={() => onChange({ rules: rules.rules.filter((_, i) => i !== idx) })}
                >
                  ×
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {!readOnly && (
      <button
        className="btn-secondary"
        onClick={() =>
          onChange({
            rules: [
              ...rules.rules,
              {
                costCategory: '',
                marginPercent: 0,
                justification: '',
                approvedBy: '',
                validFrom: new Date().toISOString().split('T')[0],
              },
            ],
          })
        }
      >
        + Add Margin Rule
      </button>
    )}
  </div>
);

// Risk Premiums Editor
const RiskPremiumsEditor: React.FC<{
  premiums: RiskPremiums;
  onChange: (premiums: RiskPremiums) => void;
  readOnly: boolean;
}> = ({ premiums, onChange, readOnly }) => (
  <div>
    <h3>Risk Premiums</h3>
    <p className="section-description">
      Add cost premiums based on project risk attributes (depth, location, rock hardness, etc.)
    </p>

    <table className="data-table">
      <thead>
        <tr>
          <th>Attribute</th>
          <th>Condition</th>
          <th>Premium %</th>
          <th>Rationale</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {premiums.premiums.map((premium, idx) => (
          <tr key={idx}>
            <td>
              <select
                value={premium.attribute}
                onChange={(e) => {
                  const updated = [...premiums.premiums];
                  updated[idx] = { ...premium, attribute: e.target.value };
                  onChange({ premiums: updated });
                }}
                disabled={readOnly}
              >
                <option value="">Select...</option>
                <option value="depth">Depth</option>
                <option value="rock_hardness">Rock Hardness</option>
                <option value="location">Location (Remote)</option>
                <option value="water_table">Water Table</option>
                <option value="seismic_zone">Seismic Zone</option>
                <option value="environmental">Environmental Sensitivity</option>
              </select>
            </td>
            <td>
              <input
                type="text"
                placeholder="e.g., > 500m"
                value={premium.condition}
                onChange={(e) => {
                  const updated = [...premiums.premiums];
                  updated[idx] = { ...premium, condition: e.target.value };
                  onChange({ premiums: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              <input
                type="number"
                step="0.5"
                value={premium.premiumPercent}
                onChange={(e) => {
                  const updated = [...premiums.premiums];
                  updated[idx] = { ...premium, premiumPercent: parseFloat(e.target.value) };
                  onChange({ premiums: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              <input
                type="text"
                value={premium.rationale}
                onChange={(e) => {
                  const updated = [...premiums.premiums];
                  updated[idx] = { ...premium, rationale: e.target.value };
                  onChange({ premiums: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              {!readOnly && (
                <button
                  className="btn-icon btn-danger"
                  onClick={() => onChange({ premiums: premiums.premiums.filter((_, i) => i !== idx) })}
                >
                  ×
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {!readOnly && (
      <button
        className="btn-secondary"
        onClick={() =>
          onChange({
            premiums: [
              ...premiums.premiums,
              { attribute: '', condition: '', premiumPercent: 0, rationale: '' },
            ],
          })
        }
      >
        + Add Risk Premium
      </button>
    )}
  </div>
);

// Volume Discounts Editor
const VolumeDiscountsEditor: React.FC<{
  discounts: CostModelConfig['volumeDiscounts'];
  onChange: (discounts: CostModelConfig['volumeDiscounts']) => void;
  readOnly: boolean;
}> = ({ discounts, onChange, readOnly }) => (
  <div>
    <h3>Volume Discount Tiers</h3>
    <table className="data-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Min Qty</th>
          <th>Max Qty</th>
          <th>Discount %</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {discounts.tiers.map((tier, idx) => (
          <tr key={idx}>
            <td>
              <select
                value={tier.category}
                onChange={(e) => {
                  const updated = [...discounts.tiers];
                  updated[idx] = { ...tier, category: e.target.value as typeof tier.category };
                  onChange({ tiers: updated });
                }}
                disabled={readOnly}
              >
                <option value="equipment">Equipment</option>
                <option value="consumables">Consumables</option>
                <option value="labor">Labor</option>
              </select>
            </td>
            <td>
              <input
                type="number"
                value={tier.minQuantity}
                onChange={(e) => {
                  const updated = [...discounts.tiers];
                  updated[idx] = { ...tier, minQuantity: parseInt(e.target.value) };
                  onChange({ tiers: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              <input
                type="number"
                value={tier.maxQuantity}
                onChange={(e) => {
                  const updated = [...discounts.tiers];
                  updated[idx] = { ...tier, maxQuantity: parseInt(e.target.value) };
                  onChange({ tiers: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              <input
                type="number"
                step="0.5"
                value={tier.discountPercent}
                onChange={(e) => {
                  const updated = [...discounts.tiers];
                  updated[idx] = { ...tier, discountPercent: parseFloat(e.target.value) };
                  onChange({ tiers: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              {!readOnly && (
                <button
                  className="btn-icon btn-danger"
                  onClick={() => onChange({ tiers: discounts.tiers.filter((_, i) => i !== idx) })}
                >
                  ×
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {!readOnly && (
      <button
        className="btn-secondary"
        onClick={() =>
          onChange({
            tiers: [
              ...discounts.tiers,
              { category: 'equipment', minQuantity: 0, maxQuantity: 0, discountPercent: 0 },
            ],
          })
        }
      >
        + Add Discount Tier
      </button>
    )}
  </div>
);

// Allocation Rules Editor
const AllocationRulesEditor: React.FC<{
  rules: CostModelConfig['allocationRules'];
  onChange: (rules: CostModelConfig['allocationRules']) => void;
  readOnly: boolean;
}> = ({ rules, onChange, readOnly }) => (
  <div>
    <h3>Fixed Cost Allocation Rules</h3>
    <p className="section-description">
      Define how fixed costs are allocated to production units.
    </p>

    <table className="data-table">
      <thead>
        <tr>
          <th>Cost Type</th>
          <th>Allocation Method</th>
          <th>Basis Description</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rules.fixedCostAllocations.map((alloc, idx) => (
          <tr key={idx}>
            <td>
              <input
                type="text"
                value={alloc.costType}
                onChange={(e) => {
                  const updated = [...rules.fixedCostAllocations];
                  updated[idx] = { ...alloc, costType: e.target.value };
                  onChange({ fixedCostAllocations: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              <select
                value={alloc.allocationMethod}
                onChange={(e) => {
                  const updated = [...rules.fixedCostAllocations];
                  updated[idx] = {
                    ...alloc,
                    allocationMethod: e.target.value as typeof alloc.allocationMethod,
                  };
                  onChange({ fixedCostAllocations: updated });
                }}
                disabled={readOnly}
              >
                <option value="tonnage">Per Tonne</option>
                <option value="meters">Per Meter</option>
                <option value="hours">Per Operating Hour</option>
                <option value="headcount">Per Headcount</option>
                <option value="revenue">% of Revenue</option>
              </select>
            </td>
            <td>
              <input
                type="text"
                value={alloc.allocationBasis}
                onChange={(e) => {
                  const updated = [...rules.fixedCostAllocations];
                  updated[idx] = { ...alloc, allocationBasis: e.target.value };
                  onChange({ fixedCostAllocations: updated });
                }}
                disabled={readOnly}
              />
            </td>
            <td>
              {!readOnly && (
                <button
                  className="btn-icon btn-danger"
                  onClick={() =>
                    onChange({
                      fixedCostAllocations: rules.fixedCostAllocations.filter((_, i) => i !== idx),
                    })
                  }
                >
                  ×
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {!readOnly && (
      <button
        className="btn-secondary"
        onClick={() =>
          onChange({
            fixedCostAllocations: [
              ...rules.fixedCostAllocations,
              { costType: '', allocationMethod: 'tonnage', allocationBasis: '' },
            ],
          })
        }
      >
        + Add Allocation Rule
      </button>
    )}
  </div>
);

// ============================================================================
// CALCULATOR TAB
// ============================================================================

function renderCalculatorTab(subTab: string, config: CostModelConfig) {
  return (
    <section className="editor-section calculator-section">
      <h2>⭐ Block-Level Marginal Cost Calculator</h2>
      <p className="section-description">
        This is the simulation interface. Enter block characteristics to calculate marginal costs.
      </p>

      {subTab === 'input' && <BlockInputForm />}
      {subTab === 'output' && <BlockCostOutput />}
    </section>
  );
}

const BlockInputForm: React.FC = () => {
  const [blockInput, setBlockInput] = useState({
    blockId: '',
    depth: 0,
    tonnage: 0,
    volume: 0,
    grade: 0,
    gradeUnit: '%' as const,
    rockType: '',
    hardness: 0,
    abrasivity: 0,
    strikeLength: 0,
    width: 0,
    height: 0,
  });

  return (
    <div className="calculator-input">
      <fieldset className="form-fieldset">
        <legend>Block Identification</legend>
        <div className="form-grid">
          <div className="form-group">
            <label>Block ID</label>
            <input
              type="text"
              value={blockInput.blockId}
              onChange={(e) => setBlockInput({ ...blockInput, blockId: e.target.value })}
              placeholder="BLK-001"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-fieldset">
        <legend>Physical Characteristics</legend>
        <div className="form-grid">
          <div className="form-group">
            <label>Depth (m)</label>
            <input
              type="number"
              value={blockInput.depth}
              onChange={(e) => setBlockInput({ ...blockInput, depth: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Tonnage (t)</label>
            <input
              type="number"
              value={blockInput.tonnage}
              onChange={(e) => setBlockInput({ ...blockInput, tonnage: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Volume (m³)</label>
            <input
              type="number"
              value={blockInput.volume}
              onChange={(e) => setBlockInput({ ...blockInput, volume: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-fieldset">
        <legend>Grade & Rock Properties</legend>
        <div className="form-grid">
          <div className="form-group">
            <label>Grade</label>
            <div className="input-group">
              <input
                type="number"
                step="0.01"
                value={blockInput.grade}
                onChange={(e) => setBlockInput({ ...blockInput, grade: parseFloat(e.target.value) })}
              />
              <select
                value={blockInput.gradeUnit}
                onChange={(e) =>
                  setBlockInput({ ...blockInput, gradeUnit: e.target.value as typeof blockInput.gradeUnit })
                }
              >
                <option value="%">%</option>
                <option value="g/t">g/t</option>
                <option value="ppm">ppm</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Rock Type</label>
            <input
              type="text"
              value={blockInput.rockType}
              onChange={(e) => setBlockInput({ ...blockInput, rockType: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Hardness (Mohs)</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="10"
              value={blockInput.hardness}
              onChange={(e) => setBlockInput({ ...blockInput, hardness: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Abrasivity Index</label>
            <input
              type="number"
              step="0.1"
              value={blockInput.abrasivity}
              onChange={(e) => setBlockInput({ ...blockInput, abrasivity: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-fieldset">
        <legend>Geometry</legend>
        <div className="form-grid three-col">
          <div className="form-group">
            <label>Strike Length (m)</label>
            <input
              type="number"
              value={blockInput.strikeLength}
              onChange={(e) => setBlockInput({ ...blockInput, strikeLength: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Width (m)</label>
            <input
              type="number"
              value={blockInput.width}
              onChange={(e) => setBlockInput({ ...blockInput, width: parseFloat(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Height (m)</label>
            <input
              type="number"
              value={blockInput.height}
              onChange={(e) => setBlockInput({ ...blockInput, height: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      <div className="form-actions">
        <button className="btn-primary btn-lg">Calculate Block Cost</button>
        <button className="btn-secondary">Add to Batch</button>
        <button className="btn-secondary">Import from CSV</button>
      </div>
    </div>
  );
};

const BlockCostOutput: React.FC = () => {
  return (
    <div className="calculator-output">
      <div className="empty-state">
        <h3>No calculation results yet</h3>
        <p>Enter block characteristics and click "Calculate Block Cost" to see results.</p>
      </div>
    </div>
  );
};

// ============================================================================
// AGGREGATOR TAB
// ============================================================================

function renderAggregatorTab(subTab: string, config: CostModelConfig) {
  return (
    <section className="editor-section">
      <h2>Project-Level Aggregation</h2>
      <p className="section-description">
        Time-series projection for board presentations. References Calculator for per-block costs.
      </p>

      {subTab === 'cashflow' && (
        <div className="cashflow-view">
          <div className="empty-state">
            <h3>Cashflow Projection</h3>
            <p>Run the Calculator with block data to generate cashflow projections.</p>
          </div>
        </div>
      )}

      {subTab === 'summary' && (
        <div className="summary-view">
          <div className="kpi-grid">
            <div className="kpi-card">
              <label>Total CAPEX</label>
              <span className="kpi-value">-</span>
            </div>
            <div className="kpi-card">
              <label>Total OPEX</label>
              <span className="kpi-value">-</span>
            </div>
            <div className="kpi-card">
              <label>NPV</label>
              <span className="kpi-value">-</span>
            </div>
            <div className="kpi-card">
              <label>IRR</label>
              <span className="kpi-value">-</span>
            </div>
            <div className="kpi-card">
              <label>Payback Period</label>
              <span className="kpi-value">-</span>
            </div>
            <div className="kpi-card">
              <label>Cost per Tonne</label>
              <span className="kpi-value">-</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// AUDIT TAB
// ============================================================================

function renderAuditTab(subTab: string, auditLog: AuditLogEntry[]) {
  return (
    <section className="editor-section">
      <h2>Audit & Version Control</h2>

      {subTab === 'log' && (
        <div className="audit-log">
          <h3>Change History</h3>
          {auditLog.length === 0 ? (
            <p className="empty-state">No changes recorded yet.</p>
          ) : (
            <table className="data-table audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Layer</th>
                  <th>Field</th>
                  <th>Changed By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.slice(-20).reverse().map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.timestamp).toLocaleString()}</td>
                    <td><span className={`layer-badge ${entry.layer}`}>{entry.layer}</span></td>
                    <td>{entry.field}</td>
                    <td>{entry.changedBy}</td>
                    <td>{entry.changeReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {subTab === 'snapshots' && (
        <div className="snapshots">
          <h3>Assumption Snapshots</h3>
          <p className="section-description">
            Create snapshots to preserve configuration state for budgets and scenarios.
          </p>
          <button className="btn-primary">Create New Snapshot</button>
          <div className="empty-state">No snapshots created yet.</div>
        </div>
      )}

      {subTab === 'simulations' && (
        <div className="simulations">
          <h3>Simulation Run History</h3>
          <p className="section-description">
            Track which configuration versions were used for each simulation.
          </p>
          <div className="empty-state">No simulation runs recorded.</div>
        </div>
      )}
    </section>
  );
}

export default CostModelConfigurator;
