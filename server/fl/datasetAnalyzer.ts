/**
 * Robust CSV Parser, Dataset Profiler, Statistical Analyzer,
 * and Logistic Regression Engine for Clinical EHR Data.
 */

export interface ParsedCsvData {
  headers: string[];
  rows: Record<string, string>[];
  rawRows: string[][];
  totalLines: number;
}

export interface ColumnSummary {
  name: string;
  dtype: 'numeric' | 'categorical';
  count: number;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  // Numeric stats
  mean?: number;
  std?: number;
  min?: number;
  p25?: number;
  median?: number;
  p75?: number;
  max?: number;
  // Categorical stats
  top_values?: { value: string; count: number; percentage: number }[];
}

export interface TargetCandidate {
  column: string;
  unique_classes: (string | number)[];
  class_counts: Record<string, number>;
  is_binary: boolean;
  recommended: boolean;
}

export interface DataQualityReport {
  completeness_percentage: number;
  cleanliness_percentage: number;
  health_score: number;
  total_cells: number;
  missing_cells: number;
  duplicate_rows: number;
  readiness_status: 'READY' | 'WARNINGS' | 'ACTION_REQUIRED';
  issues: string[];
  recommendations: string[];
}

export interface DatasetAnalysis {
  record_count: number;
  feature_count: number;
  columns: string[];
  column_types: Record<string, 'numeric' | 'categorical'>;
  columnTypes?: Record<string, 'numeric' | 'categorical'>;
  summaries: Record<string, ColumnSummary>;
  target_candidates: TargetCandidate[];
  recommended_target: string | null;
  data_quality: DataQualityReport;
  preview_rows: Record<string, any>[];
}

export interface TrainedModelResult {
  target_column: string;
  target_classes: { original: string | number; encoded: number }[];
  feature_columns: string[];
  feature_scalers: Record<string, { mean: number; std: number; median?: number }>;
  categorical_encodings: Record<string, Record<string, number>>;
  weights: Record<string, number>;
  weight_vector: number[];
  bias: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    specificity: number;
    f1_score: number;
    roc_auc: number;
    loss: number;
    train_count: number;
    test_count: number;
    epoch_losses: number[];
    confusion_matrix: {
      matrix: number[][];
      true_negatives: number;
      false_positives: number;
      false_negatives: number;
      true_positives: number;
    };
    sample_predictions: {
      actual: number;
      predicted: number;
      probability: number;
      features: Record<string, any>;
    }[];
  };
  feature_importances: {
    feature: string;
    weight: number;
    abs_weight: number;
    impact: 'INCREASES_RISK' | 'DECREASES_RISK';
  }[];
  trained_at: string;
}

export class DatasetAnalyzer {
  /**
   * RFC-4180 compliant CSV parser that correctly handles:
   * - UTF-8 BOM (\uFEFF)
   * - CRLF (\r\n) and LF (\n)
   * - Quoted fields with embedded commas and quotes ("" -> ")
   * - Empty lines and whitespace
   */
  public static parseCsv(content: string): ParsedCsvData {
    // Strip BOM if present
    let text = content;
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const char = text[i];

      if (char === '"') {
        if (insideQuotes && text[i + 1] === '"') {
          // Escaped double quote ("")
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
          i++;
          continue;
        }
      }

      if (!insideQuotes) {
        if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
          i++;
          continue;
        } else if (char === '\r') {
          if (text[i + 1] === '\n') {
            i++; // skip \n in \r\n
          }
          currentRow.push(currentField.trim());
          if (currentRow.some((f) => f.length > 0)) {
            lines.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push(currentField.trim());
          if (currentRow.some((f) => f.length > 0)) {
            lines.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          i++;
          continue;
        }
      }

      currentField += char;
      i++;
    }

    // Push trailing field/row if any
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        lines.push(currentRow);
      }
    }

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Clean headers
    const rawHeaders = lines[0];
    const headers = rawHeaders.map((h, idx) => (h && h.length > 0 ? h : `column_${idx + 1}`));

    const rawRows = lines.slice(1);
    const rows: Record<string, string>[] = [];

    for (const r of rawRows) {
      const rowObj: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        rowObj[headers[j]] = r[j] !== undefined ? r[j] : '';
      }
      rows.push(rowObj);
    }

    return {
      headers,
      rows,
      rawRows,
      totalLines: lines.length,
    };
  }

  /**
   * Checks if a value should be treated as missing
   */
  public static isMissing(val: any): boolean {
    if (val === null || val === undefined) return true;
    const str = String(val).trim().toLowerCase();
    return (
      str === '' ||
      str === '?' ||
      str === 'na' ||
      str === 'n/a' ||
      str === 'null' ||
      str === 'none' ||
      str === 'nan'
    );
  }

  /**
   * Analyzes dataset structure, types, missing values, duplicates, and stats
   */
  public static analyze(parsed: ParsedCsvData, maxPreviewRows = 20): DatasetAnalysis {
    const { headers, rows } = parsed;
    const recordCount = rows.length;
    const featureCount = headers.length;

    const columnTypes: Record<string, 'numeric' | 'categorical'> = {};
    const summaries: Record<string, ColumnSummary> = {};

    let totalMissingCells = 0;

    // 1. Determine column types and collect stats
    for (const col of headers) {
      let missingCount = 0;
      const values: string[] = [];
      const numValues: number[] = [];
      const catCounts: Record<string, number> = {};

      for (const row of rows) {
        const val = row[col];
        if (this.isMissing(val)) {
          missingCount++;
        } else {
          values.push(val);
          const parsedNum = Number(val);
          if (!isNaN(parsedNum) && val.trim() !== '') {
            numValues.push(parsedNum);
          }
          catCounts[val] = (catCounts[val] || 0) + 1;
        }
      }

      totalMissingCells += missingCount;

      // Determine dtype: If >85% of non-missing values are numeric, classify as numeric
      const isNum = values.length > 0 && numValues.length / values.length >= 0.85;
      columnTypes[col] = isNum ? 'numeric' : 'categorical';

      const uniqueCount = Object.keys(catCounts).length;
      const summary: ColumnSummary = {
        name: col,
        dtype: columnTypes[col],
        count: values.length,
        missing_count: missingCount,
        missing_percentage: recordCount > 0 ? Number(((missingCount / recordCount) * 100).toFixed(1)) : 0,
        unique_count: uniqueCount,
      };

      if (isNum && numValues.length > 0) {
        numValues.sort((a, b) => a - b);
        const sum = numValues.reduce((acc, v) => acc + v, 0);
        const mean = sum / numValues.length;
        const variance =
          numValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / Math.max(1, numValues.length - 1);
        const std = Math.sqrt(variance);

        summary.mean = Number(mean.toFixed(2));
        summary.std = Number(std.toFixed(2));
        summary.min = numValues[0];
        summary.max = numValues[numValues.length - 1];
        summary.median = this.percentile(numValues, 50);
        summary.p25 = this.percentile(numValues, 25);
        summary.p75 = this.percentile(numValues, 75);
      } else {
        // Categorical top frequencies
        const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
        summary.top_values = sortedCats.slice(0, 5).map(([val, cnt]) => ({
          value: val,
          count: cnt,
          percentage: values.length > 0 ? Number(((cnt / values.length) * 100).toFixed(1)) : 0,
        }));
      }

      summaries[col] = summary;
    }

    // 2. Detect duplicate rows
    const seenRows = new Set<string>();
    let duplicateCount = 0;
    for (const row of rows) {
      const serialized = headers.map((h) => row[h]).join('|~|');
      if (seenRows.has(serialized)) {
        duplicateCount++;
      } else {
        seenRows.add(serialized);
      }
    }

    // 3. Detect candidate target columns
    const targetCandidates: TargetCandidate[] = [];
    const targetNames = [
      'target',
      'outcome',
      'label',
      'class',
      'condition',
      'diagnosis',
      'disease',
      'heart_disease',
      'status',
      'diabetes',
      'cardiac_event',
    ];

    for (const col of headers) {
      const summary = summaries[col];
      const nameMatch = targetNames.some((t) => col.toLowerCase().includes(t));

      // Eligible targets usually have 2-10 unique non-empty values
      if (summary.unique_count >= 2 && summary.unique_count <= 10) {
        const counts: Record<string, number> = {};
        for (const row of rows) {
          const val = row[col];
          if (!this.isMissing(val)) {
            counts[val] = (counts[val] || 0) + 1;
          }
        }
        const classes = Object.keys(counts);
        const isBinary = classes.length === 2;

        targetCandidates.push({
          column: col,
          unique_classes: classes,
          class_counts: counts,
          is_binary: isBinary,
          recommended: nameMatch || isBinary,
        });
      }
    }

    // Sort target candidates by recommendation priority
    targetCandidates.sort((a, b) => {
      const aScore = (a.recommended ? 10 : 0) + (a.is_binary ? 5 : 0);
      const bScore = (b.recommended ? 10 : 0) + (b.is_binary ? 5 : 0);
      return bScore - aScore;
    });

    const recommendedTarget = targetCandidates.length > 0 ? targetCandidates[0].column : null;

    // 4. Data Quality Report
    const totalCells = Math.max(1, recordCount * featureCount);
    const completeness = Number((((totalCells - totalMissingCells) / totalCells) * 100).toFixed(1));
    const cleanliness =
      recordCount > 0 ? Number((((recordCount - duplicateCount) / recordCount) * 100).toFixed(1)) : 100;

    let healthScore = Math.round(completeness * 0.6 + cleanliness * 0.4);
    if (healthScore > 100) healthScore = 100;

    const issues: string[] = [];
    const recommendations: string[] = [];

    if (totalMissingCells > 0) {
      issues.push(`${totalMissingCells} missing value cells found across dataset (${(100 - completeness).toFixed(1)}% missing).`);
      recommendations.push('Missing values will be automatically imputed (median for numeric, mode for categorical).');
    } else {
      recommendations.push('Zero missing values: Dataset is 100% complete.');
    }

    if (duplicateCount > 0) {
      issues.push(`${duplicateCount} duplicate records detected (${(100 - cleanliness).toFixed(1)}% duplicates).`);
      recommendations.push('Duplicate records identified; consider verifying source EHR export integrity.');
    }

    if (!recommendedTarget) {
      issues.push('No obvious binary classification target detected automatically.');
      recommendations.push('Select a target column manually from the configuration panel.');
    } else {
      recommendations.push(`Detected '${recommendedTarget}' as recommended target variable.`);
    }

    const readiness: 'READY' | 'WARNINGS' | 'ACTION_REQUIRED' =
      healthScore >= 80 && !!recommendedTarget ? 'READY' : healthScore >= 60 ? 'WARNINGS' : 'ACTION_REQUIRED';

    const dataQuality: DataQualityReport = {
      completeness_percentage: completeness,
      cleanliness_percentage: cleanliness,
      health_score: healthScore,
      total_cells: totalCells,
      missing_cells: totalMissingCells,
      duplicate_rows: duplicateCount,
      readiness_status: readiness,
      issues,
      recommendations,
    };

    // 5. Build clean preview rows (first N)
    const previewRows = rows.slice(0, maxPreviewRows).map((r, rowIdx) => {
      const cleanRow: Record<string, any> = { _row_index: rowIdx + 1 };
      for (const h of headers) {
        cleanRow[h] = r[h] !== undefined ? r[h] : '';
      }
      return cleanRow;
    });

    return {
      record_count: recordCount,
      feature_count: featureCount,
      columns: headers,
      column_types: columnTypes,
      columnTypes: columnTypes,
      summaries,
      target_candidates: targetCandidates,
      recommended_target: recommendedTarget,
      data_quality: dataQuality,
      preview_rows: previewRows,
    };
  }

  private static percentile(sortedArr: number[], p: number): number {
    if (sortedArr.length === 0) return 0;
    const index = (p / 100) * (sortedArr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    const val = sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
    return Number(val.toFixed(2));
  }

  public static sigmoid(z: number): number {
    return 1.0 / (1.0 + Math.exp(-Math.max(-15, Math.min(15, z))));
  }

  /**
   * Preprocess dataset and train Logistic Regression model
   */
  public static trainLogisticRegression(
    parsed: ParsedCsvData,
    targetCol: string,
    options: {
      featureCols?: string[];
      epochs?: number;
      learning_rate?: number;
      batch_size?: number;
      l2_reg?: number;
      train_split?: number;
    } = {}
  ): TrainedModelResult {
    const { headers, rows } = parsed;

    if (!headers.includes(targetCol)) {
      throw new Error(`Target column '${targetCol}' does not exist in dataset headers.`);
    }

    // 1. Identify distinct classes in target column
    const targetValues: string[] = [];
    for (const row of rows) {
      const val = row[targetCol];
      if (!this.isMissing(val)) {
        targetValues.push(val);
      }
    }

    const uniqueClasses = Array.from(new Set(targetValues));
    if (uniqueClasses.length < 2) {
      throw new Error(
        `Target column '${targetCol}' must contain at least 2 distinct classes for classification. Found: ${uniqueClasses.join(', ') || 'none'}`
      );
    }

    // Map target to binary 0 and 1
    // If target is already 0 and 1:
    let class0: string;
    let class1: string;

    const lowerClasses = uniqueClasses.map((c) => c.toLowerCase());
    if (lowerClasses.includes('1') && lowerClasses.includes('0')) {
      class0 = uniqueClasses.find((c) => c.trim() === '0')!;
      class1 = uniqueClasses.find((c) => c.trim() === '1')!;
    } else if (lowerClasses.includes('true') && lowerClasses.includes('false')) {
      class0 = uniqueClasses.find((c) => c.toLowerCase() === 'false')!;
      class1 = uniqueClasses.find((c) => c.toLowerCase() === 'true')!;
    } else if (lowerClasses.includes('yes') && lowerClasses.includes('no')) {
      class0 = uniqueClasses.find((c) => c.toLowerCase() === 'no')!;
      class1 = uniqueClasses.find((c) => c.toLowerCase() === 'yes')!;
    } else if (lowerClasses.includes('positive') && lowerClasses.includes('negative')) {
      class0 = uniqueClasses.find((c) => c.toLowerCase() === 'negative')!;
      class1 = uniqueClasses.find((c) => c.toLowerCase() === 'positive')!;
    } else {
      class0 = uniqueClasses[0];
      class1 = uniqueClasses[1];
    }

    const targetClassMap: Record<string, number> = {
      [class0]: 0,
      [class1]: 1,
    };

    // 2. Determine Feature Columns
    const idKeywords = ['id', 'patient_id', 'uuid', 'record_id', 'hospital_id', 'index', '_row_index'];
    let featureCols = options.featureCols;
    if (!featureCols || featureCols.length === 0) {
      featureCols = headers.filter(
        (h) => h !== targetCol && !idKeywords.includes(h.toLowerCase())
      );
    }

    if (featureCols.length === 0) {
      throw new Error('At least one feature column is required for model training.');
    }

    // 3. Preprocess features: Compute medians for imputation and categorical mappings
    const analysis = this.analyze(parsed);
    const scalers: Record<string, { mean: number; std: number; median?: number }> = {};
    const catEncodings: Record<string, Record<string, number>> = {};

    for (const f of featureCols) {
      const summary = analysis.summaries[f];
      if (summary?.dtype === 'numeric') {
        const median = summary.median ?? (summary.mean || 0);
        scalers[f] = {
          mean: summary.mean || 0,
          std: summary.std && summary.std > 0 ? summary.std : 1.0,
          median,
        };
      } else {
        // Build categorical mapping
        const mapping: Record<string, number> = {};
        let code = 0;
        for (const row of rows) {
          const raw = row[f];
          if (!this.isMissing(raw) && mapping[raw] === undefined) {
            mapping[raw] = code++;
          }
        }
        catEncodings[f] = mapping;
        scalers[f] = { mean: 0.5, std: 0.5, median: 0 };
      }
    }

    // 4. Construct feature matrix X and target vector y
    interface DataPoint {
      x: number[];
      y: number;
      raw: Record<string, any>;
    }

    const dataPoints: DataPoint[] = [];

    for (const row of rows) {
      const rawTarget = row[targetCol];
      if (this.isMissing(rawTarget)) continue;

      let encodedY = targetClassMap[rawTarget];
      if (encodedY === undefined) {
        // Multi-class fallback: map class1 as 1, all others as 0
        encodedY = rawTarget === class1 ? 1 : 0;
      }

      const xVec: number[] = [];
      for (const f of featureCols) {
        const val = row[f];
        const isNum = analysis.column_types?.[f] === 'numeric';

        let numVal: number;
        if (this.isMissing(val)) {
          numVal = scalers[f].median || scalers[f].mean;
        } else if (isNum) {
          const parsedVal = Number(val);
          numVal = isNaN(parsedVal) ? (scalers[f].median || 0) : parsedVal;
        } else {
          numVal = catEncodings[f]?.[val] ?? 0;
        }

        // Standardize: (x - mean) / std
        const mean = scalers[f].mean;
        const std = scalers[f].std > 0 ? scalers[f].std : 1.0;
        xVec.push((numVal - mean) / std);
      }

      dataPoints.push({ x: xVec, y: encodedY, raw: row });
    }

    if (dataPoints.length < 5) {
      throw new Error(`Insufficient valid samples for training (found ${dataPoints.length}). Minimum 5 required.`);
    }

    // 5. Train / Test Split
    const splitRatio = options.train_split || 0.8;
    // Shuffle deterministically / randomly
    const shuffled = [...dataPoints].sort(() => Math.random() - 0.5);
    const splitIdx = Math.max(3, Math.floor(shuffled.length * splitRatio));
    const trainSet = shuffled.slice(0, splitIdx);
    const testSet = shuffled.slice(splitIdx).length > 0 ? shuffled.slice(splitIdx) : trainSet;

    // 6. Mini-batch Stochastic Gradient Descent
    const epochs = options.epochs || 20;
    const lr = options.learning_rate || 0.05;
    const batchSize = Math.min(options.batch_size || 32, trainSet.length);
    const l2 = options.l2_reg || 0.001;

    const numFeatures = featureCols.length;
    const weights = new Array(numFeatures).fill(0.0);
    let bias = 0.0;
    const epochLosses: number[] = [];

    for (let epoch = 0; epoch < epochs; epoch++) {
      let epochLoss = 0;
      const trainBatchShuffled = [...trainSet].sort(() => Math.random() - 0.5);

      for (let i = 0; i < trainBatchShuffled.length; i += batchSize) {
        const batch = trainBatchShuffled.slice(i, i + batchSize);
        const gradW = new Array(numFeatures).fill(0.0);
        let gradB = 0.0;

        for (const item of batch) {
          let z = bias;
          for (let j = 0; j < numFeatures; j++) {
            z += weights[j] * item.x[j];
          }

          const p = this.sigmoid(z);
          const err = p - item.y;

          const safeP = Math.max(1e-12, Math.min(1 - 1e-12, p));
          epochLoss += -(item.y * Math.log(safeP) + (1 - item.y) * Math.log(1 - safeP));

          for (let j = 0; j < numFeatures; j++) {
            gradW[j] += err * item.x[j];
          }
          gradB += err;
        }

        const bSize = batch.length;
        for (let j = 0; j < numFeatures; j++) {
          weights[j] -= lr * (gradW[j] / bSize + l2 * weights[j]);
        }
        bias -= lr * (gradB / bSize);
      }

      epochLosses.push(Number((epochLoss / Math.max(1, trainSet.length)).toFixed(4)));
    }

    // 7. Test Set Evaluation
    let tp = 0;
    let fp = 0;
    let tn = 0;
    let fn = 0;
    let testLoss = 0;
    const probTargets: { prob: number; target: number }[] = [];
    const samplePredictions: {
      actual: number;
      predicted: number;
      probability: number;
      features: Record<string, any>;
    }[] = [];

    for (const item of testSet) {
      let z = bias;
      for (let j = 0; j < numFeatures; j++) {
        z += weights[j] * item.x[j];
      }
      const p = this.sigmoid(z);
      const safeP = Math.max(1e-12, Math.min(1 - 1e-12, p));
      testLoss += -(item.y * Math.log(safeP) + (1 - item.y) * Math.log(1 - safeP));

      probTargets.push({ prob: p, target: item.y });

      const predictedClass = p >= 0.5 ? 1 : 0;
      if (predictedClass === 1 && item.y === 1) tp++;
      else if (predictedClass === 1 && item.y === 0) fp++;
      else if (predictedClass === 0 && item.y === 0) tn++;
      else if (predictedClass === 0 && item.y === 1) fn++;

      if (samplePredictions.length < 15) {
        samplePredictions.push({
          actual: item.y,
          predicted: predictedClass,
          probability: Number((p * 100).toFixed(1)),
          features: item.raw,
        });
      }
    }

    const testTotal = Math.max(1, testSet.length);
    const accuracy = Number(((tp + tn) / testTotal).toFixed(4));
    const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 0.0;
    const recall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 0.0;
    const specificity = tn + fp > 0 ? Number((tn / (tn + fp)).toFixed(4)) : 0.0;
    const f1_score =
      precision + recall > 0 ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4)) : 0.0;
    const avgLoss = Number((testLoss / testTotal).toFixed(4));

    // Mann-Whitney U for ROC-AUC
    const pos = probTargets.filter((x) => x.target === 1);
    const neg = probTargets.filter((x) => x.target === 0);
    let roc_auc = accuracy;
    if (pos.length > 0 && neg.length > 0) {
      let concordant = 0;
      for (const p of pos) {
        for (const n of neg) {
          if (p.prob > n.prob) concordant += 1;
          else if (p.prob === n.prob) concordant += 0.5;
        }
      }
      roc_auc = Number((concordant / (pos.length * neg.length)).toFixed(4));
    }

    // 8. Feature Weights Mapping & Importance
    const weightMap: Record<string, number> = {};
    const featureImportances: {
      feature: string;
      weight: number;
      abs_weight: number;
      impact: 'INCREASES_RISK' | 'DECREASES_RISK';
    }[] = [];

    for (let j = 0; j < numFeatures; j++) {
      const featName = featureCols[j];
      const wVal = Number(weights[j].toFixed(4));
      weightMap[featName] = wVal;
      featureImportances.push({
        feature: featName,
        weight: wVal,
        abs_weight: Math.abs(wVal),
        impact: wVal >= 0 ? 'INCREASES_RISK' : 'DECREASES_RISK',
      });
    }

    // Sort by absolute importance
    featureImportances.sort((a, b) => b.abs_weight - a.abs_weight);

    return {
      target_column: targetCol,
      target_classes: [
        { original: class0, encoded: 0 },
        { original: class1, encoded: 1 },
      ],
      feature_columns: featureCols,
      feature_scalers: scalers,
      categorical_encodings: catEncodings,
      weights: weightMap,
      weight_vector: weights.map((w) => Number(w.toFixed(5))),
      bias: Number(bias.toFixed(5)),
      metrics: {
        accuracy,
        precision,
        recall,
        specificity,
        f1_score,
        roc_auc,
        loss: avgLoss,
        train_count: trainSet.length,
        test_count: testSet.length,
        epoch_losses: epochLosses,
        confusion_matrix: {
          matrix: [
            [tn, fp],
            [fn, tp],
          ],
          true_negatives: tn,
          false_positives: fp,
          false_negatives: fn,
          true_positives: tp,
        },
        sample_predictions: samplePredictions,
      },
      feature_importances: featureImportances,
      trained_at: new Date().toISOString(),
    };
  }

  /**
   * Run patient disease risk inference with trained model
   */
  public static predictRisk(
    model: TrainedModelResult,
    inputValues: Record<string, any>
  ): {
    probability_risk: number;
    risk_tier: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK';
    prediction_label: string;
    target_class_1_label: string;
    target_class_0_label: string;
    top_risk_factors: { feature: string; contribution: number; direction: string }[];
  } {
    let z = model.bias;
    const contributions: { feature: string; contribution: number; direction: string }[] = [];

    for (const f of model.feature_columns) {
      const rawVal = inputValues[f];
      const scaler = model.feature_scalers[f];
      let numVal: number;

      if (rawVal === undefined || rawVal === null || rawVal === '') {
        numVal = scaler?.median || scaler?.mean || 0;
      } else if (!isNaN(Number(rawVal))) {
        numVal = Number(rawVal);
      } else {
        numVal = model.categorical_encodings[f]?.[rawVal] ?? (scaler?.median || 0);
      }

      const mean = scaler?.mean || 0;
      const std = scaler?.std && scaler.std > 0 ? scaler.std : 1.0;
      const normVal = (numVal - mean) / std;

      const w = model.weights[f] || 0;
      const term = w * normVal;
      z += term;

      contributions.push({
        feature: f,
        contribution: Number(term.toFixed(3)),
        direction: term > 0 ? 'Pushes toward High Risk' : 'Pushes toward Normal/Low Risk',
      });
    }

    const prob = this.sigmoid(z);
    const probPct = Number((prob * 100).toFixed(1));

    let riskTier: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK' = 'LOW_RISK';
    if (probPct >= 65) riskTier = 'HIGH_RISK';
    else if (probPct >= 35) riskTier = 'MODERATE_RISK';

    const class1 = model.target_classes.find((c) => c.encoded === 1)?.original ?? '1';
    const class0 = model.target_classes.find((c) => c.encoded === 0)?.original ?? '0';

    contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    return {
      probability_risk: probPct,
      risk_tier: riskTier,
      prediction_label: prob >= 0.5 ? `Positive Risk (${class1})` : `Negative Risk (${class0})`,
      target_class_1_label: String(class1),
      target_class_0_label: String(class0),
      top_risk_factors: contributions.slice(0, 5),
    };
  }
}
