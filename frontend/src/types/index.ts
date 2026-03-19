export interface InsightCard {
    title: string;
    description: string;
}

export type ChartValue = string | number | boolean | null;
export type DatasetRecord = Record<string, ChartValue>;

export interface ChartConfig {
    type: "line" | "area" | "bar" | "stacked_bar" | "pie" | "treemap" | "scatter" | "multi_line" | "table" | "multi";
    xAxis: string;
    yAxis: string;
}

export interface DashboardMetric {
    title: string;
    value: string;
    sql: string;
    format?: "number" | "percent" | "currency" | "text" | string;
    insight?: string | null;
}

export interface DashboardWidget {
    id: string;
    title: string;
    chart_type: ChartConfig["type"];
    x_axis: string;
    y_axis: string;
    sql: string;
    data: DatasetRecord[];
    insight?: string | null;
}

export interface QueryResponse {
    dashboard_title: string;
    dashboard_subtitle?: string;
    executive_summary: string;
    kpis: DashboardMetric[];
    widgets: DashboardWidget[];
    recommendations: string[];
    follow_up_questions: string[];
    confidence?: string;
    cannot_answer?: boolean;
    cannot_answer_reason?: string;
}

export interface DatasetHealth {
    status: string;
    has_data: boolean;
    table: string;
    row_count: number;
    columns: string[];
    schema: string;
    example_prompts: string[];
    sample_data: DatasetRecord[];
    llm_client: boolean;
}

export interface UploadResponse {
    message: string;
    table_name: string;
    schema: string;
    row_count: number;
    columns: string[];
    example_prompts: string[];
    sample_data: DatasetRecord[];
    llm_client: boolean;
    auto_insights: InsightCard[];
}
