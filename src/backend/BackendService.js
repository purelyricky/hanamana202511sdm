class BackendService {
	getText(example) {
		return `This is text from the backend! You passed: ${example}`;
	}

	/**
	 * Get employee work hours data with overtime calculations
	 * @returns {Array} Array of employee objects with calculated overtime
	 */
	getEmployeeOvertimeData() {
		// Mock employee data - in production, this would come from Jira API or external time tracking system
		const employees = [
			{
				id: "1",
				firstName: "Alex",
				lastName: "Thompson",
				email: "alex.t@company.com",
				startDate: "2024-01-15",
				expectedDailyHours: 8,
				workedHours: 176, // Total hours worked in the period
			},
			{
				id: "2",
				firstName: "Sarah",
				lastName: "Chen",
				email: "sarah.c@company.com",
				startDate: "2023-06-01",
				expectedDailyHours: 8,
				workedHours: 168,
			},
			{
				id: "3",
				firstName: "Maria",
				lastName: "Garcia",
				email: "m.garcia@company.com",
				startDate: "2024-03-10",
				expectedDailyHours: 8,
				workedHours: 152,
			},
			{
				id: "4",
				firstName: "David",
				lastName: "Kim",
				email: "d.kim@company.com",
				startDate: "2023-11-20",
				expectedDailyHours: 8,
				workedHours: 184,
			},
			{
				id: "5",
				firstName: "Emma",
				lastName: "Wilson",
				email: "emma.w@company.com",
				startDate: "2024-02-01",
				expectedDailyHours: 8,
				workedHours: 160,
			},
		];

		// Calculate overtime for each employee
		const workDaysInPeriod = 20; // Typical month has ~20 work days
		return employees.map((employee) => {
			const expectedHours = employee.expectedDailyHours * workDaysInPeriod;
			const extraHours = employee.workedHours - expectedHours;
			// Overtime is typically hours worked beyond expected (positive extra hours)
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
	getOvertimeSummary() {
		const employees = this.getEmployeeOvertimeData();

		const totalOvertime = employees.reduce((sum, emp) => sum + emp.overtimeHours, 0);
		const totalExpected = employees.reduce((sum, emp) => sum + emp.expectedHours, 0);
		const totalWorked = employees.reduce((sum, emp) => sum + emp.workedHours, 0);

		return {
			employeeCount: employees.length,
			totalExpected,
			totalWorked,
			totalOvertime,
			averageOvertime: totalOvertime / employees.length,
		};
	}
}

export const backendService = new BackendService();
