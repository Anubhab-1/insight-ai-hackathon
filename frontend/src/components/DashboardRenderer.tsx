import { ChartConfig } from "@/types";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area, Treemap, Brush
} from "recharts";

// ── Neural Void Palette ──
const COLORS = [
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#c026d3', // Fuchsia
    '#10b981', // Emerald
    '#f43f5e', // Rose
    '#fbbf24'  // Amber
];

type ChartRow = Record<string, string | number | boolean | null | undefined>;

function isNumericValue(value: ChartRow[string]) {
    return typeof value === "number" && Number.isFinite(value);
}

function coerceNumber(value: ChartRow[string]) {
    if (isNumericValue(value)) return value as number;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function isDateishValue(value: ChartRow[string]) {
    if (typeof value !== "string") return false;
    return /^\d{4}-\d{2}(-\d{2})?/.test(value) || /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(value);
}

function formatKeyLabel(value: string) {
    return value.replace(/_/g, " ");
}

function coerceDate(value: ChartRow[string]) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }
    return null;
}

function isMonotonic(values: number[]) {
    if (values.length <= 2) return true;
    let nonDecreasing = true;
    let nonIncreasing = true;
    for (let i = 1; i < values.length; i += 1) {
        if (values[i] < values[i - 1]) nonDecreasing = false;
        if (values[i] > values[i - 1]) nonIncreasing = false;
    }
    return nonDecreasing || nonIncreasing;
}

const compactFormatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
});

function detectFormat(key?: string) {
    const label = (key || "").toLowerCase();
    if (/(percent|pct|rate|ratio|share|conversion)/.test(label)) return "percent";
    if (/(revenue|usd|amount|sales|price|cost|profit|income|mrr|arr)/.test(label)) return "currency";
    return "number";
}

function formatValue(value: ChartRow[string], key?: string, compact = false) {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") {
        const format = detectFormat(key);
        if (format === "currency") {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: value >= 100 ? 0 : 2,
            }).format(value);
        }
        if (format === "percent") {
            const percentValue = Math.abs(value) <= 1 ? value * 100 : value;
            return `${percentValue.toFixed(1)}%`;
        }
        if (compact) return compactFormatter.format(value);
        return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
    }
    return String(value);
}

function sortChartData(data: ChartRow[], config: ChartConfig) {
    if (!data.length) return data;
    const xKey = config.xAxis;
    const yKey = config.yAxis;
    if (!xKey) return data;

    const sample = data[0]?.[xKey];
    const asDate = coerceDate(sample);
    if (asDate) {
        return [...data].sort((a, b) => {
            const aDate = coerceDate(a[xKey]);
            const bDate = coerceDate(b[xKey]);
            if (!aDate || !bDate) return 0;
            return aDate.getTime() - bDate.getTime();
        });
    }

    if (typeof sample === "number") {
        const values = data.map((row) => coerceNumber(row[xKey])).filter((val): val is number => val !== null);
        if (values.length === data.length && !isMonotonic(values)) {
            return [...data].sort((a, b) => {
                const aVal = coerceNumber(a[xKey]) ?? 0;
                const bVal = coerceNumber(b[xKey]) ?? 0;
                return aVal - bVal;
            });
        }
        return data;
    }

    const yValues = data.map((row) => coerceNumber(row[yKey]));
    if (yValues.every((val) => val !== null) && !isMonotonic(yValues as number[])) {
        return [...data].sort((a, b) => {
            const aVal = coerceNumber(a[yKey]) ?? 0;
            const bVal = coerceNumber(b[yKey]) ?? 0;
            return bVal - aVal;
        });
    }
    return data;
}

function profileColumns(data: ChartRow[]) {
    const columns = Object.keys(data[0] || {});
    const numericColumns = columns.filter((column) => {
        const values = data.slice(0, 5).map((row) => row[column]).filter((value) => value !== null && value !== undefined);
        return values.length > 0 && values.every(isNumericValue);
    });
    const dateColumns = columns.filter((column) => {
        const values = data.slice(0, 5).map((row) => row[column]).filter((value) => value !== null && value !== undefined);
        return column.toLowerCase().includes("date") || column.toLowerCase().includes("time") || (values.length > 0 && values.every(isDateishValue));
    });
    const categoricalColumns = columns.filter((column) => !numericColumns.includes(column));

    return { columns, numericColumns, dateColumns, categoricalColumns };
}

function deriveRenderableConfig(data: ChartRow[], config: ChartConfig): ChartConfig {
    const { columns, numericColumns, dateColumns, categoricalColumns } = profileColumns(data);
    if (columns.length === 0) return config;

    let type = config.type === "multi" ? "multi_line" : config.type;
    let xAxis = columns.includes(config.xAxis) ? config.xAxis : "";
    let yAxis = columns.includes(config.yAxis) ? config.yAxis : "";

    if (!xAxis) {
        if (type === "line" && dateColumns.length > 0) xAxis = dateColumns[0];
        else if (categoricalColumns.length > 0) xAxis = categoricalColumns[0];
        else xAxis = columns[0];
    }

    if (!yAxis) {
        const numericCandidate = numericColumns.find((column) => column !== xAxis);
        yAxis = numericCandidate || columns.find((column) => column !== xAxis) || xAxis;
    }

    if (type === "scatter" && (!numericColumns.includes(xAxis) || !numericColumns.includes(yAxis))) {
        if (numericColumns.length >= 2) { xAxis = numericColumns[0]; yAxis = numericColumns[1]; }
        else type = "bar";
    }

    if ((type === "line" || type === "area" || type === "multi_line") && !(dateColumns.includes(xAxis) || xAxis.toLowerCase().includes("date") || xAxis.toLowerCase().includes("time"))) {
        type = type === "multi_line" ? "stacked_bar" : "bar";
    }

    if (type === "stacked_bar" && numericColumns.length === 0) type = "bar";
    if (type === "pie" && data.length > 6) type = "treemap";

    if (!numericColumns.includes(yAxis) && type !== "table" && type !== "treemap") {
        const numericCandidate = numericColumns.find((column) => column !== xAxis);
        if (numericCandidate) yAxis = numericCandidate;
        else type = "table";
    }

    return { type, xAxis, yAxis };
}

function buildSeriesData(data: ChartRow[], renderConfig: ChartConfig) {
    const { numericColumns, categoricalColumns } = profileColumns(data);
    const type = renderConfig.type;
    const xAxis = renderConfig.xAxis;

    const numericSeries = numericColumns.filter((column) => column !== xAxis);
    let seriesKeys = numericSeries.length ? numericSeries : (renderConfig.yAxis ? [renderConfig.yAxis] : []);
    let seriesData = data;

    if ((type === "multi_line" || type === "stacked_bar") && numericSeries.length === 0) {
        const seriesDimension = categoricalColumns.find((column) => column !== xAxis);
        const valueKey = numericColumns[0];

        if (seriesDimension && valueKey) {
            const seriesOrder: string[] = [];
            const pivot = new Map<string, ChartRow>();
            data.forEach((row) => {
                const xVal = row[xAxis] ?? "";
                const seriesValRaw = row[seriesDimension];
                if (seriesValRaw === null || seriesValRaw === undefined) return;
                const seriesVal = String(seriesValRaw);
                if (!seriesOrder.includes(seriesVal)) seriesOrder.push(seriesVal);

                const bucket = pivot.get(String(xVal)) || { [xAxis]: xVal };
                bucket[seriesVal] = coerceNumber(row[valueKey]) ?? (type === "stacked_bar" ? 0 : null);
                pivot.set(String(xVal), bucket);
            });
            seriesData = Array.from(pivot.values());
            seriesKeys = seriesOrder;
        }
    }
    return { seriesData, seriesKeys: seriesKeys.slice(0, 8) };
}

// ── Neural Void Tooltip ──
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-xl border border-violet-500/20 bg-[#090714]/90 p-3.5 text-xs shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
                <p className="mb-2 font-bold tracking-[0.1em] text-violet-400 uppercase">
                    {typeof label === "string" || typeof label === "number" ? label : "Data Point"}
                </p>
                <div className="space-y-1.5">
                    {payload.map((entry: any, index: number) => (
                        <div key={`item-${index}`} className="flex items-center gap-3">
                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color || entry.fill || COLORS[0], boxShadow: `0 0 8px ${entry.color || entry.fill || COLORS[0]}` }} />
                            <span className="font-medium text-slate-400">{formatKeyLabel(entry.name)}:</span>
                            <span className="font-bold text-white">{formatValue(entry.value, entry.name)}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

// ── Neural Void Legend ──
const renderLegend = (props: any) => {
    const { payload } = props;
    return (
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6">
            {payload.map((entry: any, index: number) => (
                <li key={`item-${index}`} className="flex items-center gap-2 group cursor-default">
                    <div className="h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-125"
                        style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}` }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#7c6fa0] group-hover:text-violet-300 transition-colors">
                        {formatKeyLabel(entry.value)}
                    </span>
                </li>
            ))}
        </ul>
    );
};

export default function DashboardRenderer({ data, config }: { data: ChartRow[], config: ChartConfig }) {
    if (!data || data.length === 0) return <div className="text-slate-500 p-12 text-center rounded-[2rem] border-2 border-dashed border-violet-500/10 bg-violet-500/5">Source empty or unreachable.</div>;
    
    const renderConfig = deriveRenderableConfig(data, config);
    const { seriesData, seriesKeys } = buildSeriesData(data, renderConfig);
    
    // Coerce Y-axis values to numbers to ensure Recharts scales them proportionally
    const coerceChartValues = (arr: ChartRow[], keys: string[]) => {
        return arr.map(row => {
            const newRow = { ...row };
            keys.forEach(k => {
                if (k && newRow[k] !== undefined && newRow[k] !== null) {
                    newRow[k] = coerceNumber(newRow[k]);
                }
            });
            return newRow;
        });
    };

    const yKeysToCoerce = renderConfig.type === 'multi_line' ? seriesKeys : [renderConfig.yAxis];
    const numericData = coerceChartValues(data, yKeysToCoerce);
    const numericSeriesData = coerceChartValues(seriesData, seriesKeys);

    const chartData = sortChartData(numericData, renderConfig);
    const sortedSeriesData = sortChartData(numericSeriesData, { ...renderConfig, type: "line" });
    
    const primaryColor = COLORS[0];
    const gridColor = "rgba(139, 92, 246, 0.05)";
    const tickColor = "#4d4270";

    const commonAxisProps = {
        stroke: tickColor,
        fontSize: 10,
        fontWeight: 600,
        tickLine: false,
        axisLine: false,
        tickMargin: 12,
    };

    const renderChart = () => {
        switch (renderConfig.type.toLowerCase()) {
            case 'line':
            case 'area':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: chartData.length > 8 ? 30 : 0 }}>
                            <defs>
                                <linearGradient id="nvGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                            <XAxis {...commonAxisProps} dataKey={renderConfig.xAxis} tickFormatter={(v) => {
                                const d = coerceDate(v);
                                return d ? new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(d) : String(v);
                            }} />
                            <YAxis {...commonAxisProps} tickFormatter={(v) => formatValue(v, renderConfig.yAxis, true)} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(139,92,246,0.2)', strokeWidth: 1 }} />
                            <Legend content={renderLegend} />
                            <Area type="monotone" dataKey={renderConfig.yAxis} stroke={primaryColor} strokeWidth={2.5}
                                fillOpacity={1} fill="url(#nvGradient)" activeDot={{ r: 6, stroke: primaryColor, strokeWidth: 2, fill: '#04030a' }}
                                animationDuration={1500} />
                            {chartData.length > 8 && (
                                <Brush dataKey={renderConfig.xAxis} height={22} travellerWidth={6}
                                    stroke="rgba(139,92,246,0.25)" fill="rgba(9,7,20,0.8)"
                                    className="recharts-brush" />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'multi_line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: sortedSeriesData.length > 8 ? 30 : 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                            <XAxis {...commonAxisProps} dataKey={renderConfig.xAxis} />
                            <YAxis {...commonAxisProps} tickFormatter={(v) => formatValue(v, renderConfig.yAxis, true)} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.05)' }} />
                            <Legend content={renderLegend} />
                            {seriesKeys.map((key, i) => (
                                <Line key={key} type="monotone" dataKey={key} name={key} stroke={COLORS[i % COLORS.length]}
                                    strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} animationDuration={1500} />
                            ))}
                            {sortedSeriesData.length > 8 && (
                                <Brush dataKey={renderConfig.xAxis} height={22} travellerWidth={6}
                                    stroke="rgba(139,92,246,0.25)" fill="rgba(9,7,20,0.8)" />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: chartData.length > 6 ? 40 : 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                            <XAxis {...commonAxisProps} dataKey={renderConfig.xAxis}
                                angle={chartData.length > 6 ? -35 : 0}
                                textAnchor={chartData.length > 6 ? "end" : "middle"}
                                interval={0}
                                tickFormatter={(v) => {
                                    const s = String(v);
                                    return chartData.length > 8 ? s.slice(0, 10) : s;
                                }} />
                            <YAxis {...commonAxisProps} tickFormatter={(v) => formatValue(v, renderConfig.yAxis, true)} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.03)', rx: 8 }} />
                            <Legend content={renderLegend} />
                            <Bar dataKey={renderConfig.yAxis} radius={[4, 4, 0, 0]} animationDuration={1500} maxBarSize={32}>
                                {chartData.map((e, idx) => {
                                    const val = coerceNumber(e[renderConfig.yAxis]);
                                    return <Cell key={idx} fill={val !== null && val < 0 ? "#f43f5e" : COLORS[idx % COLORS.length]} fillOpacity={0.8} />;
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend content={renderLegend} />
                            <Pie data={numericData} cx="50%" cy="45%" labelLine={false} outerRadius="85%" innerRadius="65%" paddingAngle={5} stroke="none"
                                dataKey={renderConfig.yAxis} nameKey={renderConfig.xAxis} animationDuration={1500}>
                                {numericData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} className="outline-none" />)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            case 'treemap':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap data={chartData.map((r, i) => ({ name: String(r[renderConfig.xAxis] || "Unknown"), size: numericData[i]?.[renderConfig.yAxis] || 0 }))}
                            dataKey="size" stroke="#04030a" fill={primaryColor} aspectRatio={4/3}
                            content={({ x, y, width, height, index, name, value }: any) => (
                                <g>
                                    <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} stroke="#04030a" />
                                    {width > 60 && height > 30 && (
                                        <text x={x + 6} y={y + 18} fill="white" fontSize={11} fontWeight={700} className="uppercase tracking-wider">
                                            {String(name).slice(0, 12)}
                                        </text>
                                    )}
                                </g>
                            )} />
                    </ResponsiveContainer>
                );
            default:
                return (
                    <div className="h-full w-full overflow-auto rounded-2xl border border-violet-500/10 bg-violet-500/5">
                        <table className="w-full text-left font-mono text-[11px] text-slate-400">
                            <thead className="sticky top-0 bg-[#090714] text-violet-400 uppercase tracking-widest border-b border-violet-500/10">
                                <tr>{Object.keys(data[0] || {}).map(k => <th key={k} className="px-6 py-3 font-bold">{k.replace(/_/g, " ")}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-violet-500/5">
                                {data.map((r, i) => (
                                    <tr key={i} className="hover:bg-violet-500/5 transition-colors">
                                        {Object.values(r).map((v, j) => <td key={j} className="px-6 py-3 text-white/90">{v?.toString() || "-"}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
        }
    };

    return <div className="h-full w-full">{renderChart()}</div>;
}
