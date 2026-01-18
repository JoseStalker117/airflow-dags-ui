/**
 * Common Operators - Operadores más usados de Airflow 2.4.0
 * Categoría: Comunes
 */

import { airflowOperators } from "./airflowOperators";
import { databaseOperators } from "./databaseOperators";
import { googleCloudOperators } from "./googleCloudOperators";
import { pythonOperators } from "./pythonOperators";
import { sensorOperators } from "./sensorOperators";
import { sqlOperators } from "./sqlOperators";
import { transferOperators } from "./transferOperators";
import { otherUtils } from "./otherUtils";

export const commonOperators = [
  ...airflowOperators.filter((op) => op.favoritos),
  ...databaseOperators.filter((op) => op.favoritos),
  ...googleCloudOperators.filter((op) => op.favoritos),
  ...pythonOperators.filter((op) => op.favoritos),
  ...sensorOperators.filter((op) => op.favoritos),
  ...sqlOperators.filter((op) => op.favoritos),
  ...transferOperators.filter((op) => op.favoritos),
  ...otherUtils.filter((op) => op.favoritos),
];
