/**
 * Cost Model - Robotics Surgical Mining Operations
 * Main Entry Point
 */

// Configuration Types & Factory
export type {
  CostModelConfig,
  FXRates,
  ProjectParameters,
  EquipmentCatalog,
  EquipmentItem,
  LaborCatalog,
  LaborRole,
  MarginRules,
  RiskPremiums,
  VolumeDiscounts,
  AllocationRules,
  EquipmentRates,
  LaborRates,
  ConsumableRates,
  FuelRates,
  BlockCharacteristics,
  BlockCostResult,
  ProjectCashflow,
  ProjectSummary,
  AuditLogEntry,
  AssumptionSnapshot,
  SimulationRun,
} from './config/cost-model-config';

export { createDefaultConfig } from './config/cost-model-config';

// Calculation Engine
export {
  CostModelEngine,
  RatesCalculator,
  PoliciesEngine,
  BlockCostCalculator,
  ProjectAggregator,
} from './engine/CostCalculationEngine';

// React Components
export { CostModelConfigurator } from './components/CostModelConfigurator';
export { App } from './App';
