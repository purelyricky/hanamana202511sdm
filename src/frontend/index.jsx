import { makeInvoke } from "@forge/bridge";
import ForgeReconciler, { Badge, DynamicTable, Heading, Stack, Text, Strong, Box, Inline } from "@forge/react";
import React, { useEffect, useState } from "react";

export const callBackend = makeInvoke();

// Employee name-only renderer (avatars removed)
const NameOnly = ({ name }) => {
    return (
        <Text>
            <Strong>{name}</Strong>
        </Text>
    );
};

/**
 * Main Overtime Calculator Component
 * - Only fetches users who have JTTP data (getEmployeeOvertimeData)
 * - Increased spacing and table padding to improve appearance
 */
const App = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const employeeData = await callBackend("getEmployeeOvertimeData");
                setEmployees(employeeData || []);
            } catch (err) {
                console.error("Error fetching overtime data:", err);
                setEmployees([]);
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

    // head: removed "Overtime %" column and adjusted widths for better balance
    const head = {
        cells: [
            { key: "employee", content: "Employee", width: 30 },
            { key: "totalHours", content: "Total", width: 12 },
            { key: "requiredHours", content: "Required", width: 12 },
            { key: "overtime", content: "Overtime", width: 18 },
            { key: "billable", content: "Billable", width: 10 },
            { key: "nonBillable", content: "Non-Billable", width: 18 },
        ],
    };

    const rows = employees.map((employee) => ({
        key: employee.id,
        cells: [
            {
                key: "employee",
                // add inline wrapper to give horizontal breathing room
                content: (
                    <Inline>
                        <Box padding="space.100">
                            <NameOnly name={employee.name} />
                        </Box>
                    </Inline>
                ),
            },
            { key: "totalHours", content: <Box padding="space.100"><Text>{formatHours(employee.totalHours)}</Text></Box> },
            { key: "requiredHours", content: <Box padding="space.100"><Text>{formatHours(employee.requiredHours)}</Text></Box> },
            {
                key: "overtime",
                content: (
                    <Box padding="space.100">
                        <Badge
                            appearance={employee.overtime >= 0 ? "primary" : "default"}
                            text={employee.overtime >= 0 ? `+${formatHours(employee.overtime)}` : formatHours(employee.overtime)}
                        />
                    </Box>
                ),
            },
            { key: "billable", content: <Box padding="space.100"><Text>{formatHours(employee.billableHours)}</Text></Box> },
            { key: "nonBillable", content: <Box padding="space.100"><Text>{formatHours(employee.nonBillableHours)}</Text></Box> },
        ],
    }));

    if (loading) {
        return (
            <Stack space="space.300" alignInline="center">
                <Heading size="medium">Work Hours Overtime Calculator</Heading>
                <Text>Loading employee data from JTTP API...</Text>
            </Stack>
        );
    }

    return (
        // increase outer spacing so content breathes more
        <Stack space="space.600">
            

            <Box>
                <Text tone="secondary">Showing users and their logged hours.</Text>
            </Box>

            {/* extra padding around the table to increase perceived height and spacing */}
            <Box padding="space.200">
                <DynamicTable
                    head={head}
                    rows={rows}
                    isLoading={loading}
                    emptyView={<Text>No employee worklog data available. Please check JTTP API connection.</Text>}
                />
            </Box>
        </Stack>
    );
};

ForgeReconciler.render(<App />);