import api, { route, fetch } from "@forge/api";

class BackendService {
	// API Configuration
	static API_BASE_URL = "https://jttp-cloud.everit.biz/timetracker/api/latest/public";
	static API_TOKEN = "eyJhY2NvdW50SWQiOiI3MTIwMjA6OWU3OWRlZTMtYzg4NC00MTg2LWFlYjktNjhlMTRlZjRmNDUwIiwiY2xpZW50SWQiOjI2NjQxLCJzZWNyZXQiOiI5VUM0cU8wUkhZdlVFdmRwUGIzV1hQcUo1dGxaZyt3Zm1yNEhydlN4eUlmeDhuY2V1em5Hb0RVLzVCYXZMT0t6NjJreUZSTDBFM1NRZHhHeER4eWlGZ1x1MDAzZFx1MDAzZCJ9";

	getText(example) {
		return `This is text from the backend! You passed: ${example}`;
	}

	/**
	 * Fetch summary report data from Timetracker API
	 * @param {Date} startDate - Start date for report
	 * @param {Date} endDate - End date for report
	 * @returns {Object} Summary report data
	 */
	async fetchSummaryReport(startDate, endDate) {
		try {
			const url = `${BackendService.API_BASE_URL}/report/summary`;

			// Format dates as yyyy-MM-dd
			const formatDate = (date) => date.toISOString().split("T")[0];

			const requestBody = {
				startDate: formatDate(startDate),
				endDate: formatDate(endDate),
				startAt: 0,
				maxResults: 1000,
				groupBy: "userView",
				expand: ["AUTHOR", "PROJECT", "STATUS", "TYPE", "ASSIGNEE", "REPORTER", "PRIORITY"]
			};

			console.log("Fetching summary report with body:", JSON.stringify(requestBody));

			const response = await fetch(url, {
				method: "POST",
				headers: {
					"X-Everit-API-Key": BackendService.API_TOKEN,
					"X-Timezone": "UTC",
					"X-Requested-By": "forge-app",
					"Content-Type": "application/json",
					"Accept": "application/json"
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error("Failed to fetch summary report:", response.status, errorText);
				return null;
			}

			const data = await response.json();
			console.log("Summary report response:", JSON.stringify(data));
			return data;
		} catch (error) {
			console.error("Error fetching summary report:", error);
			return null;
		}
	}

	/**
	 * Get employee work hours data with overtime calculations (using Summary Report API)
	 * @returns {Array} Array of employee objects with calculated overtime
	 */
	async getEmployeeOvertimeData() {
		try {
			// Calculate date range (last 30 days)
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - 30);

			// Fetch data from Summary Report API
			const summaryData = await this.fetchSummaryReport(startDate, endDate);

			if (!summaryData || !summaryData.userView || summaryData.userView.length === 0) {
				console.warn("No user data found in summary report, using fallback data");
				return this.getFallbackData();
			}

			// Process each user from the summary report
			const employees = summaryData.userView.map((userEntry) => {
				const user = userEntry.user;

				// Parse user name
				const displayName = user.name || "Unknown User";
				const nameParts = displayName.split(" ");
				const firstName = nameParts[0] || "Unknown";
				const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "User";

				// Calculate total worked hours (billable + non-billable)
				const totalSeconds = (userEntry.billableLoggedSeconds || 0) + (userEntry.nonBillableLoggedSeconds || 0);
				const workedHours = totalSeconds / 3600; // Convert to hours

				// Default expected hours: 8 hours/day for 20 working days = 160 hours/month
				const expectedDailyHours = 8;
				const workDaysInPeriod = 20;
				const expectedHours = expectedDailyHours * workDaysInPeriod;

				// Calculate overtime
				const extraHours = workedHours - expectedHours;
				const overtimeHours = Math.max(0, extraHours);

				return {
					id: user.id,
					firstName,
					lastName,
					displayName,
					avatar: user.avatar || null, // Avatar URLs from API
					email: `${firstName.toLowerCase()}@company.com`, // API doesn't provide email
					startDate: "2024-01-01", // Default start date
					expectedDailyHours,
					workedHours: Math.round(workedHours * 10) / 10, // Round to 1 decimal
					expectedHours,
					extraHours: Math.round(extraHours * 10) / 10,
					overtimeHours: Math.round(overtimeHours * 10) / 10,
					billableHours: Math.round((userEntry.billableLoggedSeconds / 3600) * 10) / 10,
					nonBillableHours: Math.round((userEntry.nonBillableLoggedSeconds / 3600) * 10) / 10
				};
			});

			// Filter out employees with no activity
			return employees.filter((emp) => emp.workedHours > 0);
		} catch (error) {
			console.error("Error fetching employee overtime data:", error);
			return this.getFallbackData();
		}
	}

	/**
	 * Fallback data in case API calls fail
	 * @returns {Array} Fallback employee data
	 */
	getFallbackData() {
		const employees = [
			{
				id: "fallback-1",
				firstName: "Alex",
				lastName: "Thompson",
				email: "alex.t@company.com",
				startDate: "2024-01-15",
				expectedDailyHours: 8,
				workedHours: 176,
			},
			{
				id: "fallback-2",
				firstName: "Sarah",
				lastName: "Chen",
				email: "sarah.c@company.com",
				startDate: "2023-06-01",
				expectedDailyHours: 8,
				workedHours: 168,
			},
			{
				id: "fallback-3",
				firstName: "Maria",
				lastName: "Garcia",
				email: "m.garcia@company.com",
				startDate: "2024-03-10",
				expectedDailyHours: 8,
				workedHours: 152,
			},
		];

		const workDaysInPeriod = 20;
		return employees.map((employee) => {
			const expectedHours = employee.expectedDailyHours * workDaysInPeriod;
			const extraHours = employee.workedHours - expectedHours;
			const overtimeHours = Math.max(0, extraHours);

			return {
				...employee,
				expectedHours,
				extraHours,
				overtimeHours,
			};
		});
	}

	/**
	 * Calculate overtime summary statistics
	 * @returns {Object} Summary statistics
	 */
	async getOvertimeSummary() {
		const employees = await this.getEmployeeOvertimeData();

		const totalOvertime = employees.reduce((sum, emp) => sum + emp.overtimeHours, 0);
		const totalExpected = employees.reduce((sum, emp) => sum + emp.expectedHours, 0);
		const totalWorked = employees.reduce((sum, emp) => sum + emp.workedHours, 0);

		return {
			employeeCount: employees.length,
			totalExpected: Math.round(totalExpected * 10) / 10,
			totalWorked: Math.round(totalWorked * 10) / 10,
			totalOvertime: Math.round(totalOvertime * 10) / 10,
			averageOvertime: Math.round((totalOvertime / (employees.length || 1)) * 10) / 10,
		};
	}
}

export const backendService = new BackendService();