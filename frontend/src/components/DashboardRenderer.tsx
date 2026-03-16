import { ChartConfig } from "@/types";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area, Treemap
} from "recharts";

// Premium modern SaaS BI color palette
const COLORS = [
    '#3b82f6', // Primary: Blue
    '#10b981', // Secondary: Emerald
    '#8b5cf6', // Tertiary: Purple
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#06b6d4'  // Cyan
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
    if (/(percent|pct|rate|ratio|share|conversion)/.test(label)) {
        return "percent";
    }
    if (/(revenue|usd|amount|sales|price|cost|profit|income|mrr|arr)/.test(label)) {
        return "currency";
    }
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
    if (columns.length === 0) {
        return config;
    }

    let type = config.type === "multi" ? "multi_line" : config.type;
    let xAxis = columns.includes(config.xAxis) ? config.xAxis : "";
    let yAxis = columns.includes(config.yAxis) ? config.yAxis : "";

    if (!xAxis) {
        if (type === "line" && dateColumns.length > 0) {
            xAxis = dateColumns[0];
        } else if (categoricalColumns.length > 0) {
            xAxis = categoricalColumns[0];
        } else {
            xAxis = columns[0];
        }
    }

    if (!yAxis) {
        const numericCandidate = numericColumns.find((column) => column !== xAxis);
        yAxis = numericCandidate || columns.find((column) => column !== xAxis) || xAxis;
    }

    if (type === "scatter" && (!numericColumns.includes(xAxis) || !numericColumns.includes(yAxis))) {
        if (numericColumns.length >= 2) {
            xAxis = numericColumns[0];
            yAxis = numericColumns[1];
        } else {
            type = "bar";
        }
    }

    if ((type === "line" || type === "area" || type === "multi_line") && !(dateColumns.includes(xAxis) || xAxis.toLowerCase().includes("date") || xAxis.toLowerCase().includes("time"))) {
        type = type === "multi_line" ? "stacked_bar" : "bar";
    }

    if (type === "stacked_bar" && numericColumns.length === 0) {
        type = "bar";
    }

    if (type === "pie" && data.length > 6) {
        type = "treemap";
    }

    if (!numericColumns.includes(yAxis) && type !== "table" && type !== "treemap") {
        const numericCandidate = numericColumns.find((column) => column !== xAxis);
        if (numericCandidate) {
            yAxis = numericCandidate;
        } else {
            type = "table";
        }
    }

    return { type, xAxis, yAxis };
}

function buildSeriesData(
    data: ChartRow[],
    renderConfig: ChartConfig,
) {
    const { columns, numericColumns, categoricalColumns } = profileColumns(data);
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
                if (!seriesOrder.includes(seriesVal)) {
                    seriesOrder.push(seriesVal);
                }

                const key = String(xVal);
                const bucket = pivot.get(key) || { [xAxis]: xVal };
                const numericValue = coerceNumber(row[valueKey]);
                if (numericValue !== null) {
                    bucket[seriesVal] = numericValue;
                } else if (type === "stacked_bar") {
                    bucket[seriesVal] = 0;
                }
                pivot.set(key, bucket);
            });

            seriesData = Array.from(pivot.values());
            seriesKeys = seriesOrder;
        }
    }

    const MAX_SERIES = 8;
    if (seriesKeys.length > MAX_SERIES) {
        seriesKeys = seriesKeys.slice(0, MAX_SERIES);
    }

    return { seriesData, seriesKeys };
}

// Custom Glassmorphic Tooltip - Premium SaaS BI style
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-sm text-slate-200 shadow-xl backdrop-blur-md">
                <p className="mb-2 text-xs font-semibold tracking-wider text-slate-400">
                    {typeof label === "string" || typeof label === "number" ? label : "Details"}
                </p>
                {payload.map((entry: any, index: number) => (
                    <div key={`item-${index}`} className="flex items-center gap-3 py-1">
                        <div
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-[0_0_8px_var(--color)]"
                            style={{ backgroundColor: entry.color || entry.fill || COLORS[0], "--color": entry.color || entry.fill || COLORS[0] } as React.CSSProperties}
                        />
                        <span className="font-medium">{entry.name}:</span>
                        <span className="font-bold text-white">{formatValue(entry.value, entry.name)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// Custom Legend
const renderLegend = (props: any) => {
    const { payload } = props;
    return (
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4">
            {payload.map((entry: any, index: number) => (
                <li key={`item-${index}`} className="flex items-center gap-2">
                    <div
                        className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px_var(--color)]"
                        style={{ backgroundColor: entry.color, "--color": entry.color } as React.CSSProperties}
                    />
                    <span className="text-xs font-medium tracking-wide text-slate-400">{formatKeyLabel(entry.value)}</span>
                </li>
            ))}
        </ul>
    );
};

export default function DashboardRenderer({ data, config }: { data: ChartRow[], config: ChartConfig }) {
    if (!data || data.length === 0) return <div className="text-muted-foreground p-8 text-center bg-background/50 rounded-xl border border-dashed border-border">No data available to render chart.</div>;
    const renderConfig = deriveRenderableConfig(data, config);
    const { seriesData, seriesKeys } = buildSeriesData(data, renderConfig);
    const chartData = sortChartData(data, renderConfig);
    const sortedSeriesData = sortChartData(seriesData, { ...renderConfig, type: "line" });
    const primaryColor = COLORS[0];
    const secondaryColor = COLORS[1];

    const renderChart = () => {
        switch (renderConfig.type.toLowerCase()) {
            case 'line':
            case 'area':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            {renderConfig.type === "area" && (
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                            )}
                            <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
                            <XAxis 
                                dataKey={renderConfig.xAxis} 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={30}
                                tickFormatter={(value) => {
                                    const parsed = coerceDate(value);
                                    if (parsed) {
                                        return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(parsed);
                                    }
                                    return String(value);
                                }}
                            />
                            <YAxis 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={12}
                                domain={['auto', 'auto']}
                                tickFormatter={(value) => formatValue(value, renderConfig.yAxis, true)}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Legend content={renderLegend} />
                            {renderConfig.type === "area" ? (
                                <Area 
                                    type="monotone" 
                                    dataKey={renderConfig.yAxis} 
                                    stroke={primaryColor} 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#chartGradient)" 
                                    activeDot={{ r: 6, stroke: primaryColor, strokeWidth: 2, fill: '#0f172a' }} 
                                    animationDuration={1200} 
                                />
                            ) : (
                                <Line
                                    type="monotone"
                                    dataKey={renderConfig.yAxis}
                                    stroke={primaryColor}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 5 }}
                                    animationDuration={1200}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'multi_line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedSeriesData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey={renderConfig.xAxis}
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={30}
                                tickFormatter={(value) => {
                                    const parsed = coerceDate(value);
                                    if (parsed) {
                                        return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(parsed);
                                    }
                                    return String(value);
                                }}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                domain={['auto', 'auto']}
                                tickFormatter={(value) => formatValue(value, renderConfig.yAxis, true)}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Legend content={renderLegend} />
                            {seriesKeys.length <= 1 ? (
                                <Line
                                    type="monotone"
                                    dataKey={seriesKeys[0] || renderConfig.yAxis}
                                    stroke={primaryColor}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 5 }}
                                    animationDuration={1200}
                                />
                            ) : (
                                seriesKeys.map((key, index) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        name={formatKeyLabel(key)}
                                        stroke={COLORS[index % COLORS.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 5 }}
                                        animationDuration={1200}
                                    />
                                ))
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
                            <XAxis 
                                dataKey={renderConfig.xAxis} 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={30}
                                tickFormatter={(value) => {
                                    const parsed = coerceDate(value);
                                    if (parsed) {
                                        return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(parsed);
                                    }
                                    return String(value);
                                }}
                            />
                            <YAxis 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickMargin={12}
                                domain={[(dataMin: number) => {
                                    const diff = dataMin * 0.05;
                                    return Math.max(0, Math.floor(dataMin - diff));
                                }, 'auto']}
                                tickFormatter={(value) => formatValue(value, renderConfig.yAxis, true)}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)', rx: 6 }} />
                            <Legend content={renderLegend} />
                            <Bar dataKey={renderConfig.yAxis} fill={primaryColor} radius={[4, 4, 0, 0]} animationDuration={1200} maxBarSize={40}>
                                {chartData.map((entry, index) => {
                                    const rawValue = coerceNumber(entry[renderConfig.yAxis]);
                                    const fill = rawValue !== null && rawValue < 0 ? "#f87171" : COLORS[index % COLORS.length];
                                    return (
                                        <Cell key={`cell-${index}`} fill={fill} className="cursor-pointer transition-opacity hover:opacity-80" />
                                    );
                                })}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'stacked_bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedSeriesData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey={renderConfig.xAxis}
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={30}
                                tickFormatter={(value) => {
                                    const parsed = coerceDate(value);
                                    if (parsed) {
                                        return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(parsed);
                                    }
                                    return String(value);
                                }}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                domain={[(dataMin: number) => {
                                    const diff = dataMin * 0.05;
                                    return Math.max(0, Math.floor(dataMin - diff));
                                }, 'auto']}
                                tickFormatter={(value) => formatValue(value, renderConfig.yAxis, true)}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)', rx: 6 }} />
                            <Legend content={renderLegend} />
                            {seriesKeys.map((key, index) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    name={key.replace(/_/g, " ")}
                                    stackId="stack"
                                    fill={COLORS[index % COLORS.length]}
                                    radius={index === seriesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                    maxBarSize={40}
                                    animationDuration={1200}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend content={renderLegend} />
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={100}
                                innerRadius={70}
                                paddingAngle={4}
                                stroke="none"
                                dataKey={renderConfig.yAxis}
                                nameKey={renderConfig.xAxis}
                                animationDuration={1200}
                                className="outline-none focus:outline-none"
                            >
                                {data.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={COLORS[index % COLORS.length]} 
                                        className="cursor-pointer outline-none transition-all duration-300 hover:scale-[1.03] hover:opacity-90 focus:outline-none" 
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            case 'treemap': {
                const treemapData = chartData.map((row) => ({
                    name: String(row[renderConfig.xAxis] ?? "Unknown"),
                    size: coerceNumber(row[renderConfig.yAxis]) ?? 0,
                }));
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <Treemap
                            data={treemapData}
                            dataKey="size"
                            stroke="#0f172a"
                            fill={primaryColor}
                            aspectRatio={4 / 3}
                            content={({ x, y, width, height, name, index, value }) => {
                                const color = COLORS[index % COLORS.length];
                                const label = typeof name === "string" ? name : "Segment";
                                return (
                                    <g>
                                        <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.85} stroke="#0f172a" />
                                        {width > 70 && height > 40 && (
                                            <>
                                                <text x={x + 8} y={y + 22} fill="#f8fafc" fontSize={12} fontWeight={600}>
                                                    {label}
                                                </text>
                                                <text x={x + 8} y={y + 40} fill="#e2e8f0" fontSize={11}>
                                                    {formatValue(value, renderConfig.yAxis, true)}
                                                </text>
                                            </>
                                        )}
                                    </g>
                                );
                            }}
                        />
                    </ResponsiveContainer>
                );
            }
            case 'scatter':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" />
                            <XAxis 
                                type="number" 
                                dataKey={renderConfig.xAxis} 
                                name={renderConfig.xAxis} 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={12}
                                tickFormatter={(value) => formatValue(value, renderConfig.xAxis, true)}
                            />
                            <YAxis 
                                type="number" 
                                dataKey={renderConfig.yAxis} 
                                name={renderConfig.yAxis} 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={12}
                                tickFormatter={(value) => formatValue(value, renderConfig.yAxis, true)}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '4 4', stroke: 'rgba(255,255,255,0.1)' }} />
                            <Scatter name="Data" data={chartData} fill={primaryColor} animationDuration={1200}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="opacity-80 transition-opacity hover:opacity-100" />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            default:
                return (
                    <div className="h-full w-full overflow-auto rounded-xl border border-white/10 bg-white/5 shadow-inner">
                        <table className="w-full text-left text-sm text-slate-300">
                            <thead className="sticky top-0 bg-slate-900/90 text-xs font-semibold uppercase tracking-wider text-slate-400 backdrop-blur-md">
                                <tr>
                                    {Object.keys(data[0] || {}).map((key) => (
                                        <th key={key} className="border-b border-white/10 px-6 py-4">
                                            {key.replace(/_/g, " ")}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data.map((row, i) => (
                                    <tr key={i} className="transition-colors hover:bg-white/5">
                                        {Object.values(row).map((val, j) => (
                                            <td key={j} className="whitespace-nowrap px-6 py-4 font-medium">
                                                {val !== null && val !== undefined ? val.toString() : "-"}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
        }
    };

    return (
        <div className="relative z-10 h-full w-full animate-in fade-in duration-700 ease-out">
            {renderChart()}
        </div>
    );
}
