import { makeInvoke } from "@forge/bridge";
import ForgeReconciler, { Badge, DynamicTable, Heading, Stack, Text, Box, Strong } from "@forge/react";
import React, { useEffect, useState } from "react";

export const callBackend = makeInvoke();

/**
 * Employee Avatar Component - displays avatar from API or initials fallback
 */
const EmployeeAvatar = ({ name, size = 48 }) => {
    // deterministic "random" color based on name
    const COLORS = [
        "#1F77B4", "#FF7F0E", "#2CA02C", "#D62728",
        "#9467BD", "#8C564B", "#E377C2", "#7F7F7F",
        "#BCBD22", "#17BECF"
    ];

    const hashName = (s = "") => {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = (h << 5) - h + s.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h);
    };

    const getBgColor = (fullName) => {
        if (!fullName) return COLORS[0];
        const key = fullName.trim().toLowerCase();
        return COLORS[hashName(key) % COLORS.length];
    };

    const hexToRgb = (hex) => {
        const c = hex.replace("#", "");
        const bigint = parseInt(c, 16);
        return [ (bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255 ];
    };

    const getTextColor = (bgHex) => {
        const [r, g, b] = hexToRgb(bgHex);
        const luminance = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
        return luminance > 0.6 ? "#0B1A2B" : "#FFFFFF";
    };

    const firstInitial = (fullName) => {
        if (!fullName) return "?";
        return fullName.trim().split(/\s+/)[0].charAt(0).toUpperCase();
    };

    const bg = getBgColor(name);
    const textColor = getTextColor(bg);
    const fontSize = Math.max(14, Math.round(size * 0.52));

    const avatarStyle = {
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        borderRadius: "50%",
        backgroundColor: bg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        boxSizing: "border-box",
        flex: "0 0 auto",
        flexShrink: 0,
        alignSelf: "center",
        boxShadow: "0 1px 2px rgba(11,26,43,0.12)"
    };

    const letterStyle = {
        color: textColor,
        fontSize,
        fontWeight: 700,
        lineHeight: 1,
        fontFamily: "inherit",
    };

    return (
        <Stack inline space="small" align="center">
            <Box style={avatarStyle}>
                <Text style={letterStyle}>{firstInitial(name)}</Text>
            </Box>
            <Text>{name}</Text>
        </Stack>
    );
};

/**
 * Main Overtime Calculator Component
 */
const App = () => {
    const [employees, setEmployees] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // IMPORTANT: only request users that have JTTP data
                const [employeeData, summaryData] = await Promise.all([
                    callBackend("getEmployeeOvertimeData"),
                    callBackend("getOvertimeSummary"),
                ]);
                setEmployees(employeeData || []);
                setSummary(summaryData || null);
            } catch (error) {
                console.error("Error fetching overtime data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const formatHours = (hours) => {
        if (hours === null || hours === undefined) return "0.0h";
        return `${hours.toFixed(1)}h`;
    };

    const formatPercentage = (percentage) => {
        if (percentage === null || percentage === undefined) return "0.0%";
        return `${percentage.toFixed(1)}%`;
    };

    // Prepare table headers
    const head = {
        cells: [
            { key: "employee", content: "Employee", width: 30 },
            { key: "totalHours", content: "Total Hours", width: 12 },
            { key: "requiredHours", content: "Required Hours", width: 12 },
            { key: "overtime", content: "Overtime", width: 12 },
            { key: "overtimePercentage", content: "Overtime %", width: 12 },
            { key: "billable", content: "Billable", width: 11 },
            { key: "nonBillable", content: "Non-Billable", width: 11 },
        ],
    };

    // Prepare table rows
    const rows = employees.map((employee) => ({
        key: employee.id,
        cells: [
            {
                key: "employee",
                content: <EmployeeAvatar name={employee.name} avatar={employee.avatar} />,
            },
            {
                key: "totalHours",
                content: <Text>{formatHours(employee.totalHours)}</Text>,
            },
            {
                key: "requiredHours",
                content: <Text>{formatHours(employee.requiredHours)}</Text>,
            },
            {
                key: "overtime",
                content: (
                    <Badge
                        appearance={employee.overtime >= 0 ? "primary" : "default"}
                        text={employee.overtime >= 0 ? `+${formatHours(employee.overtime)}` : formatHours(employee.overtime)}
                    />
                ),
            },
            {
                key: "overtimePercentage",
                content: (
                    <Badge
                        appearance={employee.overtimePercentage >= 0 ? "added" : "removed"}
                        text={
                            employee.overtimePercentage >= 0
                                ? `+${formatPercentage(employee.overtimePercentage)}`
                                : formatPercentage(employee.overtimePercentage)
                        }
                    />
                ),
            },
            {
                key: "billable",
                content: <Text>{formatHours(employee.billableHours)}</Text>,
            },
            {
                key: "nonBillable",
                content: <Text>{formatHours(employee.nonBillableHours)}</Text>,
            },
        ],
    }));

    if (loading) {
        return (
            <Stack space="medium">
                <Heading size="large">Work Hours Overtime Calculator</Heading>
                <Text>Loading employee data from JTTP API...</Text>
            </Stack>
        );
    }

    return (
        <Stack space="medium">
            <Heading size="large">Work Hours Overtime Calculator</Heading>

            {summary && (
                <Stack space="small">
                    <Text><Strong>Summary Statistics</Strong></Text>
                    <Text>
                        Total Employees: {summary.totalEmployees} • Average Overtime: {formatHours(summary.averageOvertime)} •
                        Total Overtime: {formatHours(summary.totalOvertime)}
                    </Text>
                    <Text>
                        Employees with Overtime: {summary.employeesWithOvertime} • Employees with Undertime: {summary.employeesWithUndertime}
                    </Text>
                </Stack>
            )}

            <DynamicTable
                head={head}
                rows={rows}
                isLoading={loading}
                emptyView={<Text>No employee worklog data available. Please check JTTP API connection.</Text>}
            />
        </Stack>
    );
};

ForgeReconciler.render(<App />);