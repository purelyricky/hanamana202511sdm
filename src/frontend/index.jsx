import { makeInvoke } from "@forge/bridge";
import ForgeReconciler, { Badge, DynamicTable, Heading, Stack, Text, Strong, Box, Inline } from "@forge/react";
import React, { useEffect, useState } from "react";

export const callBackend = makeInvoke();

/**
 * Avatar component that displays user avatar from API
 */
const UserAvatar = ({ employee }) => {
	const { firstName, lastName, avatar, displayName } = employee;

	// Use size32x32 from the API avatar object, or fallback to generated avatar
	const avatarUrl = avatar?.size32x32 || avatar?.size48x48 || avatar?.size24x24;

	const containerStyle = {
		display: "flex",
		alignItems: "center",
		gap: "8px",
	};

	const avatarImgStyle = {
		width: "32px",
		height: "32px",
		borderRadius: "50%",
		flexShrink: 0,
	};

	const fallbackAvatarStyle = {
		width: "32px",
		height: "32px",
		borderRadius: "50%",
		backgroundColor: "#4C9AFF",
		color: "white",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		fontWeight: "bold",
		fontSize: "14px",
		flexShrink: 0,
	};

	const nameContainerStyle = {
		display: "flex",
		flexDirection: "column",
	};

	const nameStyle = {
		fontWeight: "500",
		fontSize: "14px",
	};

	const emailStyle = {
		fontSize: "12px",
		color: "#6B778C",
		marginTop: "2px",
	};

	// Generate initials for fallback
	const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

	return (
		<div style={containerStyle}>
			{avatarUrl ? (
				<img src={avatarUrl} alt={displayName || `${firstName} ${lastName}`} style={avatarImgStyle} />
			) : (
				<div style={fallbackAvatarStyle}>{initials}</div>
			)}
			<div style={nameContainerStyle}>
				<span style={nameStyle}>
					{firstName} {lastName}
				</span>
				<span style={emailStyle}>@{firstName.toLowerCase()}</span>
			</div>
		</div>
	);
};

/**
 * Main Overtime Calculator Component
 * - Only fetches users who have JTTP data (getEmployeeOvertimeData)
 * - Increased spacing and table padding to improve appearance
 */
const App = () => {
	const [employees, setEmployees] = useState([]);
	const [summary, setSummary] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const [employeeData, summaryData] = await Promise.all([
					callBackend("getEmployeeOvertimeData"),
					callBackend("getOvertimeSummary"),
				]);
				setEmployees(employeeData);
				setSummary(summaryData);
			} catch (error) {
				console.error("Error fetching overtime data:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	const formatHours = (hours) => {
		return `${hours.toFixed(1)}h`;
	};

	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	// Prepare table headers
	const head = {
		cells: [
			{ key: "employee", content: "Employee" },
			{ key: "startDate", content: "Start Date" },
			{ key: "expectedDaily", content: "Expected Daily Hours" },
			{ key: "workedHours", content: "Worked Hours" },
			{ key: "extraHours", content: "Extra Hours" },
			{ key: "overtimeHours", content: "Overtime Hours" },
		],
	};

	// Prepare table rows
	const rows = employees.map((employee) => ({
		key: employee.id,
		cells: [
			{
				key: "employee",
				content: <UserAvatar employee={employee} />,
			},
			{
				key: "startDate",
				content: <Text>{formatDate(employee.startDate)}</Text>,
			},
			{
				key: "expectedDaily",
				content: <Text>{formatHours(employee.expectedDailyHours)}</Text>,
			},
			{
				key: "workedHours",
				content: <Text>{formatHours(employee.workedHours)}</Text>,
			},
			{
				key: "extraHours",
				content: (
					<Badge
						appearance={employee.extraHours >= 0 ? "primary" : "default"}
						text={employee.extraHours >= 0 ? `+${formatHours(employee.extraHours)}` : formatHours(employee.extraHours)}
					/>
				),
			},
			{
				key: "overtimeHours",
				content: (
					<Badge
						appearance={employee.overtimeHours > 0 ? "added" : "default"}
						text={formatHours(employee.overtimeHours)}
					/>
				),
			},
		],
	}));

	if (loading) {
		return (
			<Stack space="medium">
				<Heading size="large">Work Hours Overtime Calculator</Heading>
				<Text>Loading employee data...</Text>
			</Stack>
		);
	}

	return (
		<Stack space="medium">
			<Heading size="large">Work Hours Overtime Calculator</Heading>

			{summary && (
				<Stack space="small">
					<Text>
						<strong>Summary:</strong> {summary.employeeCount} employees • Total Worked:{" "}
						{formatHours(summary.totalWorked)} • Total Overtime: {formatHours(summary.totalOvertime)} • Average
						Overtime: {formatHours(summary.averageOvertime)}
					</Text>
				</Stack>
			)}

			<DynamicTable head={head} rows={rows} isLoading={loading} emptyView={<Text>No employee data available</Text>} />
		</Stack>
	);
};

ForgeReconciler.render(<App />);