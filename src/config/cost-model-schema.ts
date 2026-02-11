/**
 * Cost Model Configuration Schema
 * Robotics Surgical Mining Operations
 *
 * Data Layer Architecture:
 * L0: Raw Input Data (equipment specs, labor rates, material costs)
 * L1: Derived Metrics (utilization rates, efficiency factors)
 * L2: Aggregated Costs (category totals, period summaries)
 * L3: Model Outputs (NPV, IRR, payback period, sensitivity analysis)
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type Currency = 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD';
export type TimeUnit = 'hour' | 'day' | 'week' | 'month' | 'year';
export type DepreciationMethod = 'straight-line' | 'declining-balance' | 'units-of-production';

export interface MonetaryValue {
  amount: number;
  currency: Currency;
  asOf?: Date;
}

export interface TimeSeriesValue {
  value: number;
  timestamp: Date;
  confidence?: number; // 0-1 confidence level for projections
}

// ============================================================================
// L0: RAW INPUT DATA LAYER
// ============================================================================

export interface RoboticsEquipment {
  id: string;
  name: string;
  category: 'surgical-robot' | 'autonomous-hauler' | 'drill-rig' | 'conveyor' | 'sensor-array' | 'control-system';
  manufacturer: string;
  model: string;

  // Acquisition
  purchasePrice: MonetaryValue;
  installationCost: MonetaryValue;
  commissioningCost: MonetaryValue;

  // Specifications
  specs: {
    powerConsumption: { value: number; unit: 'kW' };
    operatingHoursPerDay: number;
    expectedLifespan: { value: number; unit: TimeUnit };
    automationLevel: 'manual' | 'semi-autonomous' | 'fully-autonomous';
    precisionTolerance?: { value: number; unit: 'mm' | 'um' };
  };

  // Maintenance
  maintenanceSchedule: MaintenanceSchedule;
  warrantyPeriod: { value: number; unit: TimeUnit };
}

export interface MaintenanceSchedule {
  preventive: {
    interval: { value: number; unit: TimeUnit };
    estimatedCost: MonetaryValue;
    downtimeHours: number;
  }[];
  calibration: {
    interval: { value: number; unit: TimeUnit };
    estimatedCost: MonetaryValue;
    downtimeHours: number;
  };
  majorOverhaul: {
    interval: { value: number; unit: TimeUnit };
    estimatedCost: MonetaryValue;
    downtimeHours: number;
  };
}

export interface LaborConfig {
  roles: LaborRole[];
  shifts: ShiftPattern[];
  trainingCosts: TrainingCost[];
}

export interface LaborRole {
  id: string;
  title: string;
  category: 'operator' | 'technician' | 'engineer' | 'supervisor' | 'specialist';
  hourlyRate: MonetaryValue;
  benefits: {
    percentage: number; // % of base salary
    includes: string[];
  };
  certification: string[];
  requiredCount: number;
}

export interface ShiftPattern {
  id: string;
  name: string;
  hoursPerShift: number;
  shiftsPerDay: number;
  daysPerWeek: number;
  overtimeMultiplier: number;
  nightShiftPremium: number; // % premium
}

export interface TrainingCost {
  roleId: string;
  initialTraining: {
    duration: { value: number; unit: TimeUnit };
    cost: MonetaryValue;
    externalProvider?: string;
  };
  ongoingTraining: {
    frequency: { value: number; unit: TimeUnit };
    costPerSession: MonetaryValue;
  };
  certificationRenewal?: {
    frequency: { value: number; unit: TimeUnit };
    cost: MonetaryValue;
  };
}

export interface ConsumablesConfig {
  items: ConsumableItem[];
  inventoryPolicy: {
    safetyStockDays: number;
    reorderPoint: number;
    economicOrderQuantity: number;
  };
}

export interface ConsumableItem {
  id: string;
  name: string;
  category: 'cutting-tool' | 'lubricant' | 'filter' | 'sensor' | 'PPE' | 'medical-supply';
  unitCost: MonetaryValue;
  usageRate: { value: number; per: TimeUnit };
  leadTime: { value: number; unit: TimeUnit };
  shelfLife?: { value: number; unit: TimeUnit };
}

export interface EnergyConfig {
  electricityRate: {
    base: MonetaryValue; // per kWh
    peakMultiplier: number;
    peakHours: { start: number; end: number }[];
    demandCharge?: MonetaryValue; // per kW of peak demand
  };
  fuelCosts?: {
    type: 'diesel' | 'natural-gas' | 'hydrogen';
    rate: MonetaryValue; // per unit
    unit: 'liter' | 'gallon' | 'cubic-meter' | 'kg';
  }[];
  renewableCredits?: {
    available: boolean;
    creditValue: MonetaryValue; // per kWh
  };
}

export interface InfrastructureConfig {
  facilities: Facility[];
  utilities: UtilityCost[];
  insurance: InsurancePolicy[];
}

export interface Facility {
  id: string;
  name: string;
  type: 'control-room' | 'maintenance-bay' | 'storage' | 'medical-station' | 'office';
  area: { value: number; unit: 'sqm' | 'sqft' };
  leaseOrOwn: 'lease' | 'own';
  cost: MonetaryValue; // monthly lease or initial purchase
  maintenanceCost: MonetaryValue; // annual
}

export interface UtilityCost {
  type: 'water' | 'sewage' | 'waste-disposal' | 'telecommunications' | 'internet';
  monthlyBase: MonetaryValue;
  variableRate?: { rate: MonetaryValue; per: string };
}

export interface InsurancePolicy {
  type: 'equipment' | 'liability' | 'workers-comp' | 'business-interruption' | 'cyber';
  annualPremium: MonetaryValue;
  coverage: MonetaryValue;
  deductible: MonetaryValue;
}

// ============================================================================
// L1: DERIVED METRICS LAYER
// ============================================================================

export interface OperationalMetrics {
  equipmentUtilization: {
    equipmentId: string;
    plannedUtilization: number; // 0-1
    actualUtilization?: number;
    unplannedDowntime?: number; // hours per month
  }[];

  laborEfficiency: {
    roleId: string;
    productivityFactor: number; // 1.0 = baseline
    learningCurve?: {
      initialEfficiency: number;
      timeToFullEfficiency: { value: number; unit: TimeUnit };
    };
  }[];

  processMetrics: {
    cycleTime: { value: number; unit: TimeUnit };
    throughput: { value: number; unit: string; per: TimeUnit };
    qualityRate: number; // 0-1
    reworkRate: number; // 0-1
  };
}

export interface RiskFactors {
  operationalRisks: Risk[];
  financialRisks: Risk[];
  regulatoryRisks: Risk[];
}

export interface Risk {
  id: string;
  name: string;
  description: string;
  probability: number; // 0-1
  impact: {
    type: 'cost' | 'delay' | 'safety' | 'reputation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    estimatedCost?: MonetaryValue;
  };
  mitigation?: {
    strategy: string;
    cost: MonetaryValue;
    residualProbability: number;
  };
}

export interface EscalationFactors {
  laborInflation: number; // annual %
  materialInflation: number;
  energyInflation: number;
  generalInflation: number;
  technologyDeflation?: number; // for equipment cost reductions over time
}

// ============================================================================
// L2: AGGREGATED COSTS LAYER
// ============================================================================

export interface CAPEXBreakdown {
  equipment: {
    category: string;
    totalCost: MonetaryValue;
    items: { name: string; cost: MonetaryValue }[];
  }[];

  installation: {
    category: string;
    cost: MonetaryValue;
  }[];

  infrastructure: {
    category: string;
    cost: MonetaryValue;
  }[];

  softCosts: {
    engineering: MonetaryValue;
    projectManagement: MonetaryValue;
    permitsAndLicenses: MonetaryValue;
    contingency: MonetaryValue; // typically 10-20%
  };

  workingCapital: MonetaryValue;

  total: MonetaryValue;
}

export interface OPEXBreakdown {
  period: { start: Date; end: Date };

  labor: {
    directLabor: MonetaryValue;
    indirectLabor: MonetaryValue;
    overtime: MonetaryValue;
    benefits: MonetaryValue;
    training: MonetaryValue;
  };

  maintenance: {
    preventive: MonetaryValue;
    corrective: MonetaryValue;
    sparePartsInventory: MonetaryValue;
    externalServices: MonetaryValue;
  };

  consumables: {
    category: string;
    cost: MonetaryValue;
  }[];

  energy: {
    electricity: MonetaryValue;
    fuel?: MonetaryValue;
    demandCharges?: MonetaryValue;
  };

  facilities: {
    rent: MonetaryValue;
    utilities: MonetaryValue;
    insurance: MonetaryValue;
    security: MonetaryValue;
  };

  technology: {
    softwareLicenses: MonetaryValue;
    cloudServices: MonetaryValue;
    dataStorage: MonetaryValue;
    cybersecurity: MonetaryValue;
  };

  compliance: {
    regulatory: MonetaryValue;
    audits: MonetaryValue;
    certifications: MonetaryValue;
  };

  total: MonetaryValue;
}

// ============================================================================
// L3: MODEL OUTPUTS LAYER
// ============================================================================

export interface FinancialProjection {
  horizon: { value: number; unit: TimeUnit };
  discountRate: number;

  cashFlows: {
    period: number;
    year: number;
    capex: MonetaryValue;
    opex: MonetaryValue;
    revenue?: MonetaryValue;
    netCashFlow: MonetaryValue;
    cumulativeCashFlow: MonetaryValue;
    discountedCashFlow: MonetaryValue;
  }[];

  summary: {
    totalCAPEX: MonetaryValue;
    totalOPEX: MonetaryValue;
    npv: MonetaryValue;
    irr?: number;
    paybackPeriod?: { value: number; unit: TimeUnit };
    profitabilityIndex?: number;
  };
}

export interface SensitivityAnalysis {
  baseCase: FinancialProjection;

  scenarios: {
    name: string;
    variable: string;
    variation: number; // % change from base
    result: {
      npv: MonetaryValue;
      npvChange: number; // % change from base
      irr?: number;
      paybackPeriod?: { value: number; unit: TimeUnit };
    };
  }[];

  tornadoChart: {
    variable: string;
    lowCase: { value: number; npvImpact: MonetaryValue };
    highCase: { value: number; npvImpact: MonetaryValue };
  }[];
}

export interface MonteCarloResult {
  iterations: number;

  npvDistribution: {
    mean: MonetaryValue;
    median: MonetaryValue;
    stdDev: MonetaryValue;
    percentiles: {
      p5: MonetaryValue;
      p25: MonetaryValue;
      p75: MonetaryValue;
      p95: MonetaryValue;
    };
    probabilityOfLoss: number;
  };

  keyDrivers: {
    variable: string;
    correlationWithNPV: number;
  }[];
}

// ============================================================================
// MASTER CONFIGURATION
// ============================================================================

export interface CostModelConfig {
  metadata: {
    name: string;
    version: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    description?: string;
    tags?: string[];
  };

  projectParameters: {
    projectName: string;
    location: {
      country: string;
      region: string;
      site: string;
    };
    startDate: Date;
    duration: { value: number; unit: TimeUnit };
    currency: Currency;
    fiscalYearStart: number; // month 1-12
  };

  // L0 Data
  equipment: RoboticsEquipment[];
  labor: LaborConfig;
  consumables: ConsumablesConfig;
  energy: EnergyConfig;
  infrastructure: InfrastructureConfig;

  // L1 Metrics
  operationalMetrics: OperationalMetrics;
  riskFactors: RiskFactors;
  escalationFactors: EscalationFactors;

  // L2 Aggregations (computed)
  capexBreakdown?: CAPEXBreakdown;
  opexBreakdown?: OPEXBreakdown[];

  // L3 Outputs (computed)
  financialProjection?: FinancialProjection;
  sensitivityAnalysis?: SensitivityAnalysis;
  monteCarloResult?: MonteCarloResult;

  // Model Settings
  settings: {
    depreciationMethod: DepreciationMethod;
    taxRate: number;
    discountRate: number;
    inflationAssumptions: EscalationFactors;
    contingencyPercentage: number;
  };
}

export default CostModelConfig;
