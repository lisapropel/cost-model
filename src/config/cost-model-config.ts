/**
 * Cost Model Configuration System
 * Robotics Surgical Mining Operations - v3.0 Modular
 *
 * Architecture aligned with CostModel_v3.0_Modular.xlsx:
 * - CONFIG: Raw inputs (FX, Parameters, Equipment, Labor catalogs)
 * - RATES: Derived atomic cost functions
 * - POLICIES: Business logic rules
 * - CALCULATOR: Block-level marginal cost engine
 * - AGGREGATOR: Project-level rollup
 * - AUDIT_LOG: Version control & snapshots
 */

// ============================================================================
// CONFIG LAYER - Pure Inputs (No Calculations)
// ============================================================================

export interface FXRates {
  effectiveDate: string; // ISO date
  baseCurrency: 'USD';
  rates: {
    CAD: number;
    EUR: number;
    AUD: number;
    GBP: number;
  };
  source: 'manual' | 'bloomberg' | 'xe' | 'oanda';
  lockedUntil?: string; // For budget lock periods
}

export interface ProjectParameters {
  // Core
  projectCode: string;
  siteName: string;

  // Mining Specifics
  specificGravity: number; // SG - ore density
  lifeOfMine: { years: number; startYear: number }; // LOM
  penetrationRate: { metersPerHour: number; rockType: string }[];

  // Operational
  availability: {
    planned: number; // 0-1, target availability
    mechanical: number; // equipment reliability
    operational: number; // labor/process availability
  };

  // Surgical Mining Specifics
  precisionTolerance: { mm: number };
  roboticCycleTime: { seconds: number };
  autonomyLevel: 'supervised' | 'semi-autonomous' | 'fully-autonomous';
}

export interface EquipmentCatalog {
  items: EquipmentItem[];
  lastUpdated: string;
  approvedBy: string;
}

export interface EquipmentItem {
  itemCode: string;
  name: string;
  category: 'robot' | 'hauler' | 'drill' | 'sensor' | 'control' | 'support';

  // Cost
  baseCost: number;
  currency: 'USD' | 'CAD' | 'EUR';
  costUnit: 'each' | 'set' | 'system';

  // Specs
  specs: {
    powerKW?: number;
    weightKG?: number;
    capacityUnit?: string;
    capacity?: number;
  };

  // Lifecycle
  usefulLife: { years: number };
  salvageValue: number; // % of base cost

  // Vendor
  vendor: string;
  leadTimeWeeks: number;
  warrantyMonths: number;
}

export interface LaborCatalog {
  roles: LaborRole[];
  jurisdiction: string; // For compliance
  collectiveAgreement?: string;
  lastUpdated: string;
}

export interface LaborRole {
  roleCode: string;
  title: string;
  category: 'direct' | 'indirect' | 'supervision' | 'specialist';

  // Compensation
  annualRate: number;
  currency: 'USD' | 'CAD' | 'EUR';
  rateType: 'salary' | 'hourly';

  // Loading
  utilizationFactor: number; // Productive hours ratio
  burdenRate: number; // Benefits + overhead as multiplier

  // Requirements
  certifications: string[];
  minimumExperience: { years: number };
}

// ============================================================================
// RATES LAYER - Atomic Calculation Functions
// ============================================================================

export interface EquipmentRates {
  itemCode: string;

  // Time-based rates (FX-adjusted to project currency)
  costPerHour: number;
  costPerDay: number;
  costPerMonth: number;
  costPerYear: number;

  // Derived
  depreciationPerHour: number;
  maintenancePerHour: number;

  // Assumptions
  hoursPerDay: number;
  daysPerMonth: number;
  utilizationAssumption: number;
}

export interface ConsumableRates {
  itemCode: string;
  name: string;

  // Cost per unit of work
  costPerMeter: number;
  costPerTonne: number;
  costPerCycle: number;

  // Wear curves (non-linear consumption)
  wearCurve: {
    depth: number; // meters
    wearMultiplier: number; // 1.0 = baseline
  }[];

  // Rock type adjustments
  rockTypeFactors: {
    rockType: string;
    consumptionMultiplier: number;
  }[];
}

export interface LaborRates {
  roleCode: string;

  // Fully loaded costs
  loadedHourlyRate: number;
  loadedDailyRate: number;
  loadedMonthlyRate: number;

  // Breakdown
  baseRate: number;
  benefits: number;
  overhead: number;

  // Productivity adjusted
  effectiveHourlyRate: number; // Loaded / utilization
}

export interface FuelRates {
  fuelType: 'diesel' | 'electricity' | 'hydrogen';

  // Current rates
  baseCostPerUnit: number;
  unit: 'liter' | 'kWh' | 'kg';

  // Volatility scenarios for sensitivity
  scenarios: {
    name: 'low' | 'base' | 'high' | 'extreme';
    multiplier: number;
    probability: number;
  }[];

  // Carbon pricing (if applicable)
  carbonCostPerUnit?: number;
}

// ============================================================================
// POLICIES LAYER - Business Logic Rules
// ============================================================================

export interface MarginRules {
  rules: {
    costCategory: string;
    marginPercent: number;
    justification: string;
    approvedBy: string;
    validFrom: string;
    validTo?: string;
  }[];
}

export interface RiskPremiums {
  premiums: {
    attribute: string;
    condition: string;
    premiumPercent: number;
    rationale: string;
  }[];

  // Example conditions:
  // depth > 500m → +5%
  // rock hardness > 8 → +3%
  // remote location → +7%
}

export interface VolumeDiscounts {
  tiers: {
    minQuantity: number;
    maxQuantity: number;
    discountPercent: number;
    category: 'equipment' | 'consumables' | 'labor';
  }[];
}

export interface AllocationRules {
  fixedCostAllocations: {
    costType: string;
    allocationMethod: 'tonnage' | 'meters' | 'hours' | 'headcount' | 'revenue';
    allocationBasis: string; // Description
  }[];
}

// ============================================================================
// CALCULATOR LAYER - Block-Level Marginal Cost Engine
// ============================================================================

export interface BlockCharacteristics {
  blockId: string;

  // Physical
  depth: number; // meters from surface
  tonnage: number;
  volume: number; // cubic meters

  // Grade
  grade: number; // % or g/t
  gradeUnit: '%' | 'g/t' | 'ppm';

  // Rock properties
  rockType: string;
  hardness: number; // Mohs scale
  abrasivity: number; // index

  // Geometry
  strikeLength: number;
  width: number;
  height: number;
}

export interface BlockCostResult {
  blockId: string;
  calculatedAt: string;
  configVersion: string;

  // Unit costs
  costPerTonne: number;
  costPerMeter: number;

  // Breakdown by category
  breakdown: {
    category: string;
    cost: number;
    percentOfTotal: number;
  }[];

  // CAPEX allocation
  capexComponent: {
    equipmentDepreciation: number;
    infrastructureAllocation: number;
    total: number;
  };

  // OPEX components
  opexComponent: {
    labor: number;
    consumables: number;
    energy: number;
    maintenance: number;
    overhead: number;
    total: number;
  };

  // Applied policies
  appliedMargins: { rule: string; amount: number }[];
  appliedPremiums: { risk: string; amount: number }[];
  appliedDiscounts: { tier: string; amount: number }[];

  // Totals
  subtotal: number;
  contingency: number;
  grandTotal: number;
}

// ============================================================================
// AGGREGATOR LAYER - Project-Level Rollup
// ============================================================================

export interface ProjectCashflow {
  period: string; // YYYY-MM
  year: number;
  month: number;

  // Revenue (if applicable)
  revenue?: {
    tonnes: number;
    grade: number;
    metalPrice: number;
    grossRevenue: number;
    netRevenue: number; // After royalties, smelting, etc.
  };

  // CAPEX
  capex: {
    equipment: number;
    infrastructure: number;
    development: number;
    workingCapital: number;
    total: number;
  };

  // OPEX
  opex: {
    mining: number;
    processing: number;
    maintenance: number;
    labor: number;
    energy: number;
    gAndA: number;
    other: number;
    total: number;
  };

  // Summary
  netCashflow: number;
  cumulativeCashflow: number;

  // For board presentations
  variance?: {
    vsBudget: number;
    vsPriorForecast: number;
  };
}

export interface ProjectSummary {
  // Timeline
  projectStart: string;
  projectEnd: string;
  totalMonths: number;

  // Totals
  totalCAPEX: number;
  totalOPEX: number;
  totalRevenue?: number;
  totalCashflow: number;

  // Metrics
  npv: number;
  irr: number;
  paybackMonths: number;

  // Cost ratios
  costPerTonne: number;
  costPerMeter: number;
  opexIntensity: number; // OPEX / Revenue

  // Fixed cost burden
  fixedCosts: number;
  variableCosts: number;
  fixedCostRatio: number;
}

// ============================================================================
// AUDIT LAYER - Version Control & Compliance
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: string;

  // What changed
  layer: 'config' | 'rates' | 'policies' | 'calculator' | 'aggregator';
  entity: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;

  // Who & why
  changedBy: string;
  changeReason: string;
  approvedBy?: string;

  // Traceability
  ticketRef?: string; // Jira, etc.
  documentRef?: string;
}

export interface AssumptionSnapshot {
  snapshotId: string;
  name: string;
  createdAt: string;
  createdBy: string;

  // Full state capture
  fxRates: FXRates;
  projectParameters: ProjectParameters;
  equipmentCatalog: EquipmentCatalog;
  laborCatalog: LaborCatalog;
  policies: {
    margins: MarginRules;
    riskPremiums: RiskPremiums;
    volumeDiscounts: VolumeDiscounts;
    allocations: AllocationRules;
  };

  // Metadata
  scenarioType: 'budget' | 'forecast' | 'sensitivity' | 'what-if';
  lockedForReporting: boolean;
  notes?: string;
}

export interface SimulationRun {
  runId: string;
  runAt: string;
  runBy: string;

  // Input reference
  snapshotId: string;
  blockIds: string[];

  // Parameters
  parameters: {
    startPeriod: string;
    endPeriod: string;
    discountRate: number;
    inflationRate: number;
  };

  // Output reference
  outputFile?: string;
  summary: ProjectSummary;

  // Approval
  status: 'draft' | 'reviewed' | 'approved' | 'superseded';
  reviewedBy?: string;
  approvedBy?: string;
}

// ============================================================================
// MASTER CONFIG - Full Model State
// ============================================================================

export interface CostModelConfig {
  // Metadata
  version: string;
  modelName: string;
  lastModified: string;
  modifiedBy: string;

  // CONFIG Layer
  fxRates: FXRates;
  projectParameters: ProjectParameters;
  equipmentCatalog: EquipmentCatalog;
  laborCatalog: LaborCatalog;

  // RATES Layer (derived, can be recalculated)
  equipmentRates?: EquipmentRates[];
  consumableRates?: ConsumableRates[];
  laborRates?: LaborRates[];
  fuelRates?: FuelRates[];

  // POLICIES Layer
  marginRules: MarginRules;
  riskPremiums: RiskPremiums;
  volumeDiscounts: VolumeDiscounts;
  allocationRules: AllocationRules;

  // Settings
  calculatorSettings: {
    contingencyPercent: number;
    roundingPrecision: number;
    projectCurrency: 'USD' | 'CAD' | 'EUR';
  };

  aggregatorSettings: {
    fiscalYearStartMonth: number;
    discountRate: number;
    taxRate: number;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION FACTORY
// ============================================================================

export function createDefaultConfig(): CostModelConfig {
  return {
    version: '3.0.0',
    modelName: 'Robotics Surgical Mining Cost Model',
    lastModified: new Date().toISOString(),
    modifiedBy: 'system',

    fxRates: {
      effectiveDate: new Date().toISOString().split('T')[0],
      baseCurrency: 'USD',
      rates: { CAD: 1.36, EUR: 0.92, AUD: 1.53, GBP: 0.79 },
      source: 'manual',
    },

    projectParameters: {
      projectCode: 'RSM-001',
      siteName: 'New Site',
      specificGravity: 2.7,
      lifeOfMine: { years: 15, startYear: new Date().getFullYear() },
      penetrationRate: [
        { metersPerHour: 2.5, rockType: 'soft' },
        { metersPerHour: 1.5, rockType: 'medium' },
        { metersPerHour: 0.8, rockType: 'hard' },
      ],
      availability: {
        planned: 0.92,
        mechanical: 0.95,
        operational: 0.97,
      },
      precisionTolerance: { mm: 5 },
      roboticCycleTime: { seconds: 45 },
      autonomyLevel: 'semi-autonomous',
    },

    equipmentCatalog: {
      items: [],
      lastUpdated: new Date().toISOString(),
      approvedBy: '',
    },

    laborCatalog: {
      roles: [],
      jurisdiction: 'Canada - Ontario',
      lastUpdated: new Date().toISOString(),
    },

    marginRules: { rules: [] },
    riskPremiums: { premiums: [] },
    volumeDiscounts: { tiers: [] },
    allocationRules: { fixedCostAllocations: [] },

    calculatorSettings: {
      contingencyPercent: 10,
      roundingPrecision: 2,
      projectCurrency: 'USD',
    },

    aggregatorSettings: {
      fiscalYearStartMonth: 1,
      discountRate: 0.08,
      taxRate: 0.25,
    },
  };
}

export default CostModelConfig;
