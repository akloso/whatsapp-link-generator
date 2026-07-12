import type { ChartType } from 'chart.js';

export type IcrChartKind = 'health' | 'recommendations' | 'owners' | 'trend';
export interface IcrChartPoint { label: string; value: number }
export interface IcrTrendPoint { label: string; value: number; count: number; dateKey: string }
export interface IcrChartModel { kind: IcrChartKind; title: string; description: string; type: ChartType; labels: string[]; values: number[]; summary: string; points: IcrChartPoint[]; emptyReason: string | null }
export interface IcrTrendChartModel extends Omit<IcrChartModel,'points'> { kind: 'trend'; points: IcrTrendPoint[] }
export type IcrAnyChartModel = IcrChartModel | IcrTrendChartModel;
