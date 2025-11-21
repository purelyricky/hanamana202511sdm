import api, { fetch, route } from "@forge/api";

class BackendService {
	getText(example) {
		return `This is text from the backend! You passed: ${example}`;
	}

	/**
	 * Fetch users from Jira
	 * @returns {Array} Array of Jira users
	 */
	async fetchJiraUsers() {
		try {
			// Fetch users from Jira using the users search API
			const response = await api.asUser().requestJira(route`/rest/api/3/users/search?maxResults=50`);

			if (!response.ok) {
				console.error("Failed to fetch Jira users:", response.status);
				return [];
			}

			const users = await response.json();
			return users.filter((user) => user.active && !user.accountType?.includes("app"));
		} catch (error) {
			console.error("Error fetching Jira users:", error);
			return [];
		}
	}

	/**
	 * Fetch worklog data for a specific user from Jira
	 * @param {string} accountId - Jira account ID
	 * @param {Date} startDate - Start date for worklog search
	 * @param {Date} endDate - End date for worklog search
	 * @returns {number} Total hours worked
	 */
	async fetchUserWorklogs(accountId, startDate, endDate) {
		try {
			// Search for issues updated in the date range
			const jql = `worklogAuthor = ${accountId} AND worklogDate >= "${startDate.toISOString().split("T")[0]}" AND worklogDate <= "${endDate.toISOString().split("T")[0]}"`;

			const response = await api
				.asUser()
				.requestJira(route`/rest/api/3/search?jql=${jql}&fields=worklog&maxResults=100`);

			if (!response.ok) {
				console.error(`Failed to fetch worklogs for user ${accountId}:`, response.status);
				return 0;
			}

			const data = await response.json();
			let totalSeconds = 0;

			// Process each issue's worklogs
			for (const issue of data.issues || []) {
				if (issue.fields?.worklog?.worklogs) {
					for (const worklog of issue.fields.worklog.worklogs) {
						// Check if worklog is by this user and in date range
						if (worklog.author?.accountId === accountId) {
							const worklogDate = new Date(worklog.started);
							if (worklogDate >= startDate && worklogDate <= endDate) {
								totalSeconds += worklog.timeSpentSeconds || 0;
							}
						}
					}
				}
			}

			// Convert seconds to hours
			return totalSeconds / 3600;
		} catch (error) {
			console.error(`Error fetching worklogs for user ${accountId}:`, error);
			return 0;
		}
	}

	/**
	 * Fetch time tracking data from JTTP Cloud (if available)
	 * @param {string} userKey - User identifier
	 * @param {Date} startDate - Start date
	 * @param {Date} endDate - End date
	 * @returns {number} Total hours worked
	 */
	async fetchJTTPTimeTracking(userKey, startDate, endDate) {
		try {
			// Example JTTP Cloud API endpoint (adjust based on actual API documentation)
			const url = `/worklogs?user=${userKey}&dateFrom=${startDate.toISOString().split("T")[0]}&dateTo=${endDate.toISOString().split("T")[0]}`;

			const response = await fetch(url, {
				method: "GET",
				headers: {
					Accept: "application/json",
				},
			});

			if (!response.ok) {
				console.error("Failed to fetch JTTP time tracking:", response.status);
				return null;
			}

			const data = await response.json();
			// Process JTTP response (adjust based on actual API response format)
			let totalSeconds = 0;
			if (data.worklogs) {
				for (const worklog of data.worklogs) {
					totalSeconds += worklog.timeSpentSeconds || 0;
				}
			}

			return totalSeconds / 3600; // Convert to hours
		} catch (error) {
			console.error("Error fetching JTTP time tracking:", error);
			return null;
		}
	}

	/**
	 * Get employee work hours data with overtime calculations (using real data)
	 * @returns {Array} Array of employee objects with calculated overtime
	 */
	async getEmployeeOvertimeData() {
		try {
			// Fetch real users from Jira
			const jiraUsers = await this.fetchJiraUsers();

			if (jiraUsers.length === 0) {
				console.warn("No Jira users found, using fallback data");
				return this.getFallbackData();
			}

			// Calculate date range (last 30 days)
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - 30);

			// Process each user and fetch their work hours
			const employeePromises = jiraUsers.map(async (user) => {
				// Parse user name
				const displayName = user.displayName || "Unknown User";
				const nameParts = displayName.split(" ");
				const firstName = nameParts[0] || "Unknown";
				const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "User";

				// Fetch worked hours from Jira worklogs
				let workedHours = await this.fetchUserWorklogs(user.accountId, startDate, endDate);

				// Try JTTP Cloud as backup if Jira worklogs return 0
				if (workedHours === 0) {
					const jttpHours = await this.fetchJTTPTimeTracking(user.accountId, startDate, endDate);
					if (jttpHours !== null) {
						workedHours = jttpHours;
					}
				}

				// Default expected hours: 8 hours/day for 20 working days = 160 hours/month
				const expectedDailyHours = 8;
				const workDaysInPeriod = 20;
				const expectedHours = expectedDailyHours * workDaysInPeriod;

				// Calculate overtime
				const extraHours = workedHours - expectedHours;
				const overtimeHours = Math.max(0, extraHours);

				return {
					id: user.accountId,
					firstName,
					lastName,
					email: user.emailAddress || "no-email@company.com",
					startDate: "2024-01-01", // Default start date (Jira API doesn't provide this)
					expectedDailyHours,
					workedHours: Math.round(workedHours * 10) / 10, // Round to 1 decimal
					expectedHours,
					extraHours: Math.round(extraHours * 10) / 10,
					overtimeHours: Math.round(overtimeHours * 10) / 10,
				};
			});

			const employees = await Promise.all(employeePromises);

			// Filter out employees with no activity (optional)
			return employees.filter((emp) => emp.workedHours > 0 || employees.length <= 5);
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
