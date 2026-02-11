/**
 * Cost Calculation Engine
 * Block-Level Marginal Cost Calculator for Robotics Surgical Mining
 *
 * Flow: CONFIG → RATES → POLICIES → CALCULATOR → AGGREGATOR
 */

import type {
  CostModelConfig,
  EquipmentRates,
  LaborRates,
  ConsumableRates,
  FuelRates,
  BlockCharacteristics,
  BlockCostResult,
  ProjectCashflow,
  ProjectSummary,
} from '../config/cost-model-config';

// ============================================================================
// RATES CALCULATOR - Derives atomic rates from CONFIG
// ============================================================================

export class RatesCalculator {
  constructor(private config: CostModelConfig) {}

  /**
   * Calculate equipment rates (cost per time unit)
   */
  calculateEquipmentRates(): EquipmentRates[] {
    const { equipmentCatalog, fxRates, calculatorSettings } = this.config;
    const targetCurrency = calculatorSettings.projectCurrency;

    return equipmentCatalog.items.map((item) => {
      // FX conversion
      const fxRate = this.getFXRate(item.currency, targetCurrency);
      const costInProjectCurrency = item.baseCost * fxRate;

      // Depreciation calculation (straight-line)
      const depreciableValue = costInProjectCurrency * (1 - item.salvageValue / 100);
      const annualDepreciation = depreciableValue / item.usefulLife.years;

      // Standard operating assumptions
      const hoursPerDay = 20; // 2x 10hr shifts with overlap
      const daysPerMonth = 25;
      const daysPerYear = 300;

      // Annual costs
      const maintenancePercent = 0.05; // 5% of capital annually
      const insurancePercent = 0.02;
      const annualMaintenance = costInProjectCurrency * maintenancePercent;
      const annualInsurance = costInProjectCurrency * insurancePercent;

      const totalAnnualCost = annualDepreciation + annualMaintenance + annualInsurance;

      return {
        itemCode: item.itemCode,
        costPerYear: totalAnnualCost,
        costPerMonth: totalAnnualCost / 12,
        costPerDay: totalAnnualCost / daysPerYear,
        costPerHour: totalAnnualCost / (daysPerYear * hoursPerDay),
        depreciationPerHour: annualDepreciation / (daysPerYear * hoursPerDay),
        maintenancePerHour: annualMaintenance / (daysPerYear * hoursPerDay),
        hoursPerDay,
        daysPerMonth,
        utilizationAssumption: this.config.projectParameters.availability.planned,
      };
    });
  }

  /**
   * Calculate labor rates (fully loaded costs)
   */
  calculateLaborRates(): LaborRates[] {
    const { laborCatalog, fxRates, calculatorSettings } = this.config;
    const targetCurrency = calculatorSettings.projectCurrency;
    const hoursPerYear = 2080; // Standard work hours

    return laborCatalog.roles.map((role) => {
      const fxRate = this.getFXRate(role.currency, targetCurrency);
      const baseAnnual = role.annualRate * fxRate;

      // Apply burden rate (benefits + overhead)
      const loadedAnnual = baseAnnual * role.burdenRate;

      // Calculate rates
      const loadedHourly = loadedAnnual / hoursPerYear;
      const effectiveHourly = loadedHourly / role.utilizationFactor;

      return {
        roleCode: role.roleCode,
        loadedHourlyRate: loadedHourly,
        loadedDailyRate: loadedHourly * 8,
        loadedMonthlyRate: loadedAnnual / 12,
        baseRate: baseAnnual / hoursPerYear,
        benefits: (baseAnnual * (role.burdenRate - 1)) / hoursPerYear,
        overhead: 0, // Could be extracted if tracked separately
        effectiveHourlyRate: effectiveHourly,
      };
    });
  }

  /**
   * Calculate consumable rates with wear curves
   */
  calculateConsumableRates(consumables: ConsumableConfig[]): ConsumableRates[] {
    return consumables.map((item) => ({
      itemCode: item.code,
      name: item.name,
      costPerMeter: item.costPerUnit / item.metersPerUnit,
      costPerTonne: item.costPerUnit / item.tonnesPerUnit,
      costPerCycle: item.costPerUnit / item.cyclesPerUnit,
      wearCurve: item.wearCurve || [
        { depth: 0, wearMultiplier: 1.0 },
        { depth: 200, wearMultiplier: 1.1 },
        { depth: 500, wearMultiplier: 1.25 },
        { depth: 1000, wearMultiplier: 1.5 },
      ],
      rockTypeFactors: item.rockTypeFactors || [],
    }));
  }

  /**
   * Calculate fuel rates with scenarios
   */
  calculateFuelRates(): FuelRates[] {
    return [
      {
        fuelType: 'diesel',
        baseCostPerUnit: 1.35,
        unit: 'liter',
        scenarios: [
          { name: 'low', multiplier: 0.8, probability: 0.15 },
          { name: 'base', multiplier: 1.0, probability: 0.5 },
          { name: 'high', multiplier: 1.3, probability: 0.25 },
          { name: 'extreme', multiplier: 1.8, probability: 0.1 },
        ],
        carbonCostPerUnit: 0.12,
      },
      {
        fuelType: 'electricity',
        baseCostPerUnit: 0.12,
        unit: 'kWh',
        scenarios: [
          { name: 'low', multiplier: 0.9, probability: 0.2 },
          { name: 'base', multiplier: 1.0, probability: 0.6 },
          { name: 'high', multiplier: 1.2, probability: 0.15 },
          { name: 'extreme', multiplier: 1.5, probability: 0.05 },
        ],
      },
    ];
  }

  private getFXRate(from: string, to: string): number {
    if (from === to) return 1;

    const { rates } = this.config.fxRates;

    // All rates are stored as per 1 USD
    if (from === 'USD') {
      return rates[to as keyof typeof rates] || 1;
    }
    if (to === 'USD') {
      return 1 / (rates[from as keyof typeof rates] || 1);
    }

    // Cross rate via USD
    const fromToUSD = 1 / (rates[from as keyof typeof rates] || 1);
    const usdToTarget = rates[to as keyof typeof rates] || 1;
    return fromToUSD * usdToTarget;
  }
}

// ============================================================================
// POLICIES ENGINE - Applies business logic
// ============================================================================

export class PoliciesEngine {
  constructor(private config: CostModelConfig) {}

  /**
   * Get applicable margin for a cost category
   */
  getMargin(costCategory: string, date: Date = new Date()): number {
    const rule = this.config.marginRules.rules.find((r) => {
      const validFrom = new Date(r.validFrom);
      const validTo = r.validTo ? new Date(r.validTo) : new Date('2099-12-31');
      return r.costCategory === costCategory && date >= validFrom && date <= validTo;
    });

    return rule?.marginPercent || 0;
  }

  /**
   * Calculate risk premium based on block characteristics
   */
  calculateRiskPremium(block: BlockCharacteristics): { premium: number; appliedPremiums: { risk: string; amount: number }[] } {
    const appliedPremiums: { risk: string; amount: number }[] = [];
    let totalPremium = 0;

    for (const premium of this.config.riskPremiums.premiums) {
      const applies = this.evaluateCondition(premium.attribute, premium.condition, block);
      if (applies) {
        appliedPremiums.push({ risk: premium.attribute, amount: premium.premiumPercent });
        totalPremium += premium.premiumPercent;
      }
    }

    return { premium: totalPremium, appliedPremiums };
  }

  /**
   * Get applicable volume discount
   */
  getVolumeDiscount(category: 'equipment' | 'consumables' | 'labor', quantity: number): number {
    const tier = this.config.volumeDiscounts.tiers.find(
      (t) => t.category === category && quantity >= t.minQuantity && quantity <= t.maxQuantity
    );
    return tier?.discountPercent || 0;
  }

  /**
   * Get allocation method for a fixed cost type
   */
  getAllocationMethod(costType: string): { method: string; basis: string } {
    const rule = this.config.allocationRules.fixedCostAllocations.find(
      (a) => a.costType === costType
    );
    return rule
      ? { method: rule.allocationMethod, basis: rule.allocationBasis }
      : { method: 'tonnage', basis: 'Default allocation per tonne' };
  }

  private evaluateCondition(attribute: string, condition: string, block: BlockCharacteristics): boolean {
    // Parse conditions like "> 500" or "= hard"
    const match = condition.match(/([><=!]+)\s*(.+)/);
    if (!match) return false;

    const [, operator, valueStr] = match;
    const threshold = parseFloat(valueStr) || valueStr.trim();

    let blockValue: number | string;
    switch (attribute) {
      case 'depth':
        blockValue = block.depth;
        break;
      case 'rock_hardness':
        blockValue = block.hardness;
        break;
      case 'grade':
        blockValue = block.grade;
        break;
      case 'abrasivity':
        blockValue = block.abrasivity;
        break;
      default:
        return false;
    }

    switch (operator) {
      case '>':
        return typeof blockValue === 'number' && blockValue > (threshold as number);
      case '>=':
        return typeof blockValue === 'number' && blockValue >= (threshold as number);
      case '<':
        return typeof blockValue === 'number' && blockValue < (threshold as number);
      case '<=':
        return typeof blockValue === 'number' && blockValue <= (threshold as number);
      case '=':
      case '==':
        return blockValue === threshold;
      case '!=':
        return blockValue !== threshold;
      default:
        return false;
    }
  }
}

// ============================================================================
// BLOCK COST CALCULATOR - Core marginal cost engine
// ============================================================================

export class BlockCostCalculator {
  private ratesCalc: RatesCalculator;
  private policies: PoliciesEngine;
  private equipmentRates: EquipmentRates[];
  private laborRates: LaborRates[];

  constructor(private config: CostModelConfig) {
    this.ratesCalc = new RatesCalculator(config);
    this.policies = new PoliciesEngine(config);

    // Pre-calculate rates
    this.equipmentRates = this.ratesCalc.calculateEquipmentRates();
    this.laborRates = this.ratesCalc.calculateLaborRates();
  }

  /**
   * Calculate the marginal cost for a mining block
   */
  calculateBlockCost(block: BlockCharacteristics): BlockCostResult {
    const configVersion = this.config.version;
    const calculatedAt = new Date().toISOString();

    // 1. Calculate base costs by category
    const laborCost = this.calculateLaborCost(block);
    const equipmentCost = this.calculateEquipmentCost(block);
    const consumablesCost = this.calculateConsumablesCost(block);
    const energyCost = this.calculateEnergyCost(block);
    const maintenanceCost = this.calculateMaintenanceCost(block);
    const overheadCost = this.calculateOverhead(block);

    // CAPEX allocation (per-block portion of capital costs)
    const capexAllocation = this.calculateCAPEXAllocation(block);

    // 2. Apply policies
    const { premium: riskPremium, appliedPremiums } = this.policies.calculateRiskPremium(block);

    // Margins by category
    const appliedMargins: { rule: string; amount: number }[] = [];
    const laborMargin = this.policies.getMargin('labor');
    const equipmentMargin = this.policies.getMargin('equipment');
    if (laborMargin) appliedMargins.push({ rule: 'labor', amount: laborMargin });
    if (equipmentMargin) appliedMargins.push({ rule: 'equipment', amount: equipmentMargin });

    // Volume discounts (placeholder - would need order quantity context)
    const appliedDiscounts: { tier: string; amount: number }[] = [];

    // 3. Build cost breakdown
    const opexTotal = laborCost + consumablesCost + energyCost + maintenanceCost + overheadCost;
    const capexTotal = capexAllocation.equipmentDepreciation + capexAllocation.infrastructureAllocation;

    const subtotal = opexTotal + capexTotal;

    // Apply risk premium
    const riskAdjustment = subtotal * (riskPremium / 100);

    // Apply margins
    const marginAdjustment = appliedMargins.reduce(
      (sum, m) => sum + (m.amount / 100) * subtotal,
      0
    );

    // Apply discounts
    const discountAdjustment = appliedDiscounts.reduce(
      (sum, d) => sum - (d.amount / 100) * subtotal,
      0
    );

    // Contingency
    const contingencyRate = this.config.calculatorSettings.contingencyPercent / 100;
    const contingency = subtotal * contingencyRate;

    const grandTotal = subtotal + riskAdjustment + marginAdjustment + discountAdjustment + contingency;

    // Unit costs
    const costPerTonne = grandTotal / block.tonnage;
    const costPerMeter = grandTotal / (block.strikeLength || 1);

    // Build breakdown
    const breakdown = [
      { category: 'Labor', cost: laborCost, percentOfTotal: (laborCost / grandTotal) * 100 },
      { category: 'Consumables', cost: consumablesCost, percentOfTotal: (consumablesCost / grandTotal) * 100 },
      { category: 'Energy', cost: energyCost, percentOfTotal: (energyCost / grandTotal) * 100 },
      { category: 'Maintenance', cost: maintenanceCost, percentOfTotal: (maintenanceCost / grandTotal) * 100 },
      { category: 'Overhead', cost: overheadCost, percentOfTotal: (overheadCost / grandTotal) * 100 },
      { category: 'Equipment CAPEX', cost: capexAllocation.equipmentDepreciation, percentOfTotal: (capexAllocation.equipmentDepreciation / grandTotal) * 100 },
      { category: 'Infrastructure', cost: capexAllocation.infrastructureAllocation, percentOfTotal: (capexAllocation.infrastructureAllocation / grandTotal) * 100 },
    ];

    return {
      blockId: block.blockId,
      calculatedAt,
      configVersion,
      costPerTonne,
      costPerMeter,
      breakdown,
      capexComponent: capexAllocation,
      opexComponent: {
        labor: laborCost,
        consumables: consumablesCost,
        energy: energyCost,
        maintenance: maintenanceCost,
        overhead: overheadCost,
        total: opexTotal,
      },
      appliedMargins,
      appliedPremiums,
      appliedDiscounts,
      subtotal,
      contingency,
      grandTotal,
    };
  }

  private calculateLaborCost(block: BlockCharacteristics): number {
    // Labor hours based on block characteristics
    const { projectParameters } = this.config;

    // Find applicable penetration rate
    const penRate = projectParameters.penetrationRate.find(
      (r) => r.rockType.toLowerCase() === block.rockType.toLowerCase()
    ) || projectParameters.penetrationRate[1]; // Default to medium

    // Hours to mine the block
    const metersToMine = block.strikeLength * block.width;
    const miningHours = metersToMine / penRate.metersPerHour;

    // Adjust for availability
    const effectiveHours = miningHours / (
      projectParameters.availability.planned *
      projectParameters.availability.mechanical *
      projectParameters.availability.operational
    );

    // Apply labor rates
    let totalLabor = 0;
    for (const rate of this.laborRates) {
      // Weight by role category (could be more sophisticated)
      const weight = rate.roleCode.includes('direct') ? 1.0 : 0.3;
      totalLabor += rate.effectiveHourlyRate * effectiveHours * weight;
    }

    return totalLabor;
  }

  private calculateEquipmentCost(block: BlockCharacteristics): number {
    // Equipment operating hours
    const miningHours = this.estimateMiningHours(block);

    let totalEquipment = 0;
    for (const rate of this.equipmentRates) {
      totalEquipment += rate.costPerHour * miningHours;
    }

    return totalEquipment;
  }

  private calculateConsumablesCost(block: BlockCharacteristics): number {
    // Base consumables rate per tonne
    const baseRatePerTonne = 2.50; // Placeholder - would come from consumables catalog

    // Adjust for depth (wear curve)
    let depthMultiplier = 1.0;
    if (block.depth > 500) depthMultiplier = 1.25;
    if (block.depth > 1000) depthMultiplier = 1.5;

    // Adjust for rock hardness
    let hardnessMultiplier = 1.0;
    if (block.hardness > 6) hardnessMultiplier = 1.3;
    if (block.hardness > 8) hardnessMultiplier = 1.6;

    return baseRatePerTonne * block.tonnage * depthMultiplier * hardnessMultiplier;
  }

  private calculateEnergyCost(block: BlockCharacteristics): number {
    const miningHours = this.estimateMiningHours(block);

    // Sum power consumption from equipment
    let totalPowerKW = 0;
    for (const item of this.config.equipmentCatalog.items) {
      totalPowerKW += item.specs.powerKW || 0;
    }

    // kWh consumed
    const kWhConsumed = totalPowerKW * miningHours;

    // Electricity rate (placeholder)
    const electricityRate = 0.12; // $/kWh

    return kWhConsumed * electricityRate;
  }

  private calculateMaintenanceCost(block: BlockCharacteristics): number {
    const miningHours = this.estimateMiningHours(block);

    let totalMaintenance = 0;
    for (const rate of this.equipmentRates) {
      totalMaintenance += rate.maintenancePerHour * miningHours;
    }

    return totalMaintenance;
  }

  private calculateOverhead(block: BlockCharacteristics): number {
    // G&A as percentage of direct costs
    const directCosts = this.calculateLaborCost(block) + this.calculateEquipmentCost(block);
    const overheadRate = 0.15; // 15% overhead

    return directCosts * overheadRate;
  }

  private calculateCAPEXAllocation(block: BlockCharacteristics): {
    equipmentDepreciation: number;
    infrastructureAllocation: number;
    total: number;
  } {
    const { lifeOfMine, availability } = this.config.projectParameters;

    // Total equipment capital
    const totalEquipmentCapital = this.config.equipmentCatalog.items.reduce(
      (sum, item) => sum + item.baseCost,
      0
    );

    // Depreciation per tonne (simplified - assumes linear production)
    const totalProductionEstimate = block.tonnage * 1000; // Placeholder for LOM tonnage
    const depreciationPerTonne = totalEquipmentCapital / totalProductionEstimate;
    const equipmentDepreciation = depreciationPerTonne * block.tonnage;

    // Infrastructure allocation (placeholder)
    const infrastructureAllocation = block.tonnage * 1.0; // $1/tonne infrastructure

    return {
      equipmentDepreciation,
      infrastructureAllocation,
      total: equipmentDepreciation + infrastructureAllocation,
    };
  }

  private estimateMiningHours(block: BlockCharacteristics): number {
    const { projectParameters } = this.config;

    const penRate = projectParameters.penetrationRate.find(
      (r) => r.rockType.toLowerCase() === block.rockType.toLowerCase()
    ) || projectParameters.penetrationRate[1];

    const metersToMine = block.strikeLength * block.width;
    const baseHours = metersToMine / penRate.metersPerHour;

    const oee =
      projectParameters.availability.planned *
      projectParameters.availability.mechanical *
      projectParameters.availability.operational;

    return baseHours / oee;
  }
}

// ============================================================================
// PROJECT AGGREGATOR - Roll up to project level
// ============================================================================

export class ProjectAggregator {
  constructor(
    private config: CostModelConfig,
    private calculator: BlockCostCalculator
  ) {}

  /**
   * Generate project-level cashflow from block costs
   */
  generateCashflow(
    blocks: BlockCharacteristics[],
    schedule: BlockSchedule[]
  ): ProjectCashflow[] {
    const cashflows: ProjectCashflow[] = [];
    const { aggregatorSettings, projectParameters } = this.config;

    // Calculate block costs
    const blockCosts = new Map<string, BlockCostResult>();
    for (const block of blocks) {
      blockCosts.set(block.blockId, this.calculator.calculateBlockCost(block));
    }

    // Group by period
    const startYear = projectParameters.lifeOfMine.startYear;
    const endYear = startYear + projectParameters.lifeOfMine.years;

    for (let year = startYear; year <= endYear; year++) {
      for (let month = 1; month <= 12; month++) {
        const period = `${year}-${String(month).padStart(2, '0')}`;

        // Find blocks scheduled for this period
        const scheduledBlocks = schedule.filter((s) => s.period === period);

        // Sum costs
        let periodCapex = 0;
        let periodOpex = 0;
        let periodTonnage = 0;

        for (const scheduled of scheduledBlocks) {
          const cost = blockCosts.get(scheduled.blockId);
          const block = blocks.find((b) => b.blockId === scheduled.blockId);

          if (cost && block) {
            periodCapex += cost.capexComponent.total;
            periodOpex += cost.opexComponent.total;
            periodTonnage += block.tonnage;
          }
        }

        cashflows.push({
          period,
          year,
          month,
          capex: {
            equipment: periodCapex * 0.7,
            infrastructure: periodCapex * 0.2,
            development: periodCapex * 0.1,
            workingCapital: 0,
            total: periodCapex,
          },
          opex: {
            mining: periodOpex * 0.4,
            processing: periodOpex * 0.2,
            maintenance: periodOpex * 0.15,
            labor: periodOpex * 0.15,
            energy: periodOpex * 0.05,
            gAndA: periodOpex * 0.05,
            other: 0,
            total: periodOpex,
          },
          netCashflow: -(periodCapex + periodOpex),
          cumulativeCashflow: 0, // Calculate after
        });
      }
    }

    // Calculate cumulative
    let cumulative = 0;
    for (const cf of cashflows) {
      cumulative += cf.netCashflow;
      cf.cumulativeCashflow = cumulative;
    }

    return cashflows;
  }

  /**
   * Generate project summary metrics
   */
  generateSummary(cashflows: ProjectCashflow[]): ProjectSummary {
    const { aggregatorSettings, projectParameters } = this.config;

    const totalCAPEX = cashflows.reduce((sum, cf) => sum + cf.capex.total, 0);
    const totalOPEX = cashflows.reduce((sum, cf) => sum + cf.opex.total, 0);
    const totalCashflow = cashflows[cashflows.length - 1]?.cumulativeCashflow || 0;

    // NPV calculation
    const discountRate = aggregatorSettings.discountRate;
    let npv = 0;
    for (let i = 0; i < cashflows.length; i++) {
      const period = i / 12; // Convert to years
      npv += cashflows[i].netCashflow / Math.pow(1 + discountRate, period);
    }

    // IRR calculation (simplified - would use numerical methods)
    const irr = this.calculateIRR(cashflows.map((cf) => cf.netCashflow));

    // Payback period
    const paybackIndex = cashflows.findIndex((cf) => cf.cumulativeCashflow >= 0);
    const paybackMonths = paybackIndex >= 0 ? paybackIndex : cashflows.length;

    // Cost metrics
    const totalTonnage = 1000000; // Placeholder
    const totalMeters = 5000; // Placeholder

    return {
      projectStart: `${projectParameters.lifeOfMine.startYear}-01`,
      projectEnd: `${projectParameters.lifeOfMine.startYear + projectParameters.lifeOfMine.years}-12`,
      totalMonths: cashflows.length,
      totalCAPEX,
      totalOPEX,
      totalCashflow,
      npv,
      irr: irr || 0,
      paybackMonths,
      costPerTonne: (totalCAPEX + totalOPEX) / totalTonnage,
      costPerMeter: (totalCAPEX + totalOPEX) / totalMeters,
      opexIntensity: 0, // Would need revenue data
      fixedCosts: totalCAPEX,
      variableCosts: totalOPEX,
      fixedCostRatio: totalCAPEX / (totalCAPEX + totalOPEX),
    };
  }

  private calculateIRR(cashflows: number[], guess: number = 0.1): number | null {
    // Newton-Raphson method for IRR
    const maxIterations = 100;
    const tolerance = 0.0001;

    let rate = guess;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivNPV = 0;

      for (let t = 0; t < cashflows.length; t++) {
        const factor = Math.pow(1 + rate, t / 12);
        npv += cashflows[t] / factor;
        derivNPV -= (t / 12) * cashflows[t] / (factor * (1 + rate));
      }

      if (Math.abs(derivNPV) < tolerance) return null;

      const newRate = rate - npv / derivNPV;

      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }

      rate = newRate;
    }

    return null; // Did not converge
  }
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

interface ConsumableConfig {
  code: string;
  name: string;
  costPerUnit: number;
  metersPerUnit: number;
  tonnesPerUnit: number;
  cyclesPerUnit: number;
  wearCurve?: { depth: number; wearMultiplier: number }[];
  rockTypeFactors?: { rockType: string; consumptionMultiplier: number }[];
}

interface BlockSchedule {
  blockId: string;
  period: string; // YYYY-MM
  sequence: number;
}

// ============================================================================
// MAIN ENGINE FACADE
// ============================================================================

export class CostModelEngine {
  private ratesCalc: RatesCalculator;
  private policies: PoliciesEngine;
  private blockCalc: BlockCostCalculator;
  private aggregator: ProjectAggregator;

  constructor(private config: CostModelConfig) {
    this.ratesCalc = new RatesCalculator(config);
    this.policies = new PoliciesEngine(config);
    this.blockCalc = new BlockCostCalculator(config);
    this.aggregator = new ProjectAggregator(config, this.blockCalc);
  }

  /**
   * Recalculate all derived rates from CONFIG
   */
  recalculateRates(): CostModelConfig {
    return {
      ...this.config,
      equipmentRates: this.ratesCalc.calculateEquipmentRates(),
      laborRates: this.ratesCalc.calculateLaborRates(),
      fuelRates: this.ratesCalc.calculateFuelRates(),
    };
  }

  /**
   * Calculate cost for a single block
   */
  calculateBlock(block: BlockCharacteristics): BlockCostResult {
    return this.blockCalc.calculateBlockCost(block);
  }

  /**
   * Calculate costs for multiple blocks in batch
   */
  calculateBlocks(blocks: BlockCharacteristics[]): BlockCostResult[] {
    return blocks.map((block) => this.blockCalc.calculateBlockCost(block));
  }

  /**
   * Generate full project financials
   */
  runFullProjection(blocks: BlockCharacteristics[], schedule: BlockSchedule[]): {
    blockCosts: BlockCostResult[];
    cashflows: ProjectCashflow[];
    summary: ProjectSummary;
  } {
    const blockCosts = this.calculateBlocks(blocks);
    const cashflows = this.aggregator.generateCashflow(blocks, schedule);
    const summary = this.aggregator.generateSummary(cashflows);

    return { blockCosts, cashflows, summary };
  }

  /**
   * Run sensitivity analysis on a key variable
   */
  runSensitivity(
    blocks: BlockCharacteristics[],
    schedule: BlockSchedule[],
    variable: string,
    variations: number[]
  ): { variation: number; npv: number; irr: number | null }[] {
    const results: { variation: number; npv: number; irr: number | null }[] = [];

    for (const variation of variations) {
      // Create modified config
      const modifiedConfig = this.applyVariation(variable, variation);
      const engine = new CostModelEngine(modifiedConfig);
      const projection = engine.runFullProjection(blocks, schedule);

      results.push({
        variation,
        npv: projection.summary.npv,
        irr: projection.summary.irr,
      });
    }

    return results;
  }

  private applyVariation(variable: string, variation: number): CostModelConfig {
    const multiplier = 1 + variation / 100;

    switch (variable) {
      case 'discount_rate':
        return {
          ...this.config,
          aggregatorSettings: {
            ...this.config.aggregatorSettings,
            discountRate: this.config.aggregatorSettings.discountRate * multiplier,
          },
        };

      case 'equipment_cost':
        return {
          ...this.config,
          equipmentCatalog: {
            ...this.config.equipmentCatalog,
            items: this.config.equipmentCatalog.items.map((item) => ({
              ...item,
              baseCost: item.baseCost * multiplier,
            })),
          },
        };

      case 'labor_cost':
        return {
          ...this.config,
          laborCatalog: {
            ...this.config.laborCatalog,
            roles: this.config.laborCatalog.roles.map((role) => ({
              ...role,
              annualRate: role.annualRate * multiplier,
            })),
          },
        };

      default:
        return this.config;
    }
  }
}

export default CostModelEngine;
