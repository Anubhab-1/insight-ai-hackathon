import { ChartConfig } from "@/types";
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, ScatterChart, Scatter,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area
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

function isDateishValue(value: ChartRow[string]) {
    if (typeof value !== "string") return false;
    return /^\d{4}-\d{2}(-\d{2})?/.test(value) || /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(value);
}

function deriveRenderableConfig(data: ChartRow[], config: ChartConfig): ChartConfig {
    const columns = Object.keys(data[0] || {});
    if (columns.length === 0) {
        return config;
    }

    const numericColumns = columns.filter((column) => {
        const values = data.slice(0, 5).map((row) => row[column]).filter((value) => value !== null && value !== undefined);
        return values.length > 0 && values.every(isNumericValue);
    });
    const dateColumns = columns.filter((column) => {
        const values = data.slice(0, 5).map((row) => row[column]).filter((value) => value !== null && value !== undefined);
        return column.toLowerCase().includes("date") || column.toLowerCase().includes("time") || (values.length > 0 && values.every(isDateishValue));
    });
    const categoricalColumns = columns.filter((column) => !numericColumns.includes(column));

    let type = config.type;
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

    if (type === "line" && !(dateColumns.includes(xAxis) || xAxis.toLowerCase().includes("date") || xAxis.toLowerCase().includes("time"))) {
        type = "bar";
    }

    if (type === "pie" && data.length > 6) {
        type = "bar";
    }

    if (!numericColumns.includes(yAxis) && type !== "table") {
        const numericCandidate = numericColumns.find((column) => column !== xAxis);
        if (numericCandidate) {
            yAxis = numericCandidate;
        } else {
            type = "table";
        }
    }

    return { type, xAxis, yAxis };
}

// Custom Glassmorphic Tooltip - Premium SaaS BI style
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 text-sm text-slate-200 shadow-xl backdrop-blur-md">
                <p className="mb-2 text-xs font-semibold tracking-wider text-slate-400">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={`item-${index}`} className="flex items-center gap-3 py-1">
                        <div
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full shadow-[0_0_8px_var(--color)]"
                            style={{ backgroundColor: entry.color || entry.fill || COLORS[0], "--color": entry.color || entry.fill || COLORS[0] } as React.CSSProperties}
                        />
                        <span className="font-medium">{entry.name}:</span>
                        <span className="font-bold text-white">{entry.value.toLocaleString()}</span>
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
                    <span className="text-xs font-medium tracking-wide text-slate-400">{entry.value}</span>
                </li>
            ))}
        </ul>
    );
};

export default function DashboardRenderer({ data, config }: { data: ChartRow[], config: ChartConfig }) {
    if (!data || data.length === 0) return <div className="text-muted-foreground p-8 text-center bg-background/50 rounded-xl border border-dashed border-border">No data available to render chart.</div>;
    const renderConfig = deriveRenderableConfig(data, config);
    const primaryColor = COLORS[0];
    const secondaryColor = COLORS[1];

    const renderChart = () => {
        switch (renderConfig.type.toLowerCase()) {
            case 'line':
            case 'area':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
                            <XAxis 
                                dataKey={renderConfig.xAxis} 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={30}
                            />
                            <YAxis 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={12}
                                domain={['auto', 'auto']}
                                tickFormatter={(value) => {
                                    if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
                                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                                    return value.toString();
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Legend content={renderLegend} />
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
                        </AreaChart>
                    </ResponsiveContainer>
                );
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#1e293b" vertical={false} />
                            <XAxis 
                                dataKey={renderConfig.xAxis} 
                                stroke="#64748b" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={30}
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
                                tickFormatter={(value) => {
                                    if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
                                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                                    return value.toString();
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)', rx: 6 }} />
                            <Legend content={renderLegend} />
                            <Bar dataKey={renderConfig.yAxis} fill={primaryColor} radius={[4, 4, 0, 0]} animationDuration={1200} maxBarSize={40}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="cursor-pointer transition-opacity hover:opacity-80" />
                                ))}
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
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '4 4', stroke: 'rgba(255,255,255,0.1)' }} />
                            <Scatter name="Data" data={data} fill={primaryColor} animationDuration={1200}>
                                {data.map((entry, index) => (
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
