import api, { route, fetch } from "@forge/api";

class BackendService {
    JTTP_API_KEY = "eyJhY2NvdW50SWQiOiI3MTIwMjA6OWU3OWRlZTMtYzg4NC00MTg2LWFlYjktNjhlMTRlZjRmNDUwIiwiY2xpZW50SWQiOjI2NjQxLCJzZWNyZXQiOiI5VUM0cU8wUkhZdlVFdmRwUGIzV1hQcUo1dGxaZyt3Zm1yNEhydlN4eUlmeDhuY2V1em5Hb0RVLzVCYXZMT0t6NjJreUZSTDBFM1NRZHhHeER4eWlGZ1x1MDAzZFx1MDAzZCJ9";

    getText(example) {
        return `This is text from the backend! You passed: ${example}`;
    }

    /**
     * Fetch worklog summary from JTTP API using Forge's authenticated fetch
     * @param {string} startDate - Start date in YYYY-MM-DD format
     * @param {string} endDate - End date in YYYY-MM-DD format
     * @param {string} [jql] - Optional JQL query
     * @param {string} [accountId] - Optional user account ID
     * @returns {Object} JTTP API response
     */
    async fetchWorklogSummary(startDate, endDate, jql, accountId) {
        try {
            // Use Forge's fetch (imported from @forge/api) with Jira authentication context
            // The jttp-cloud remote is configured in manifest.yml
            const response = await fetch("https://jttp-cloud.everit.biz/timetracker/api/latest/public/report/summary", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-everit-api-key": this.JTTP_API_KEY,
                    "x-requested-by": "working-hours-checker",
                },
                body: JSON.stringify({
                    startAt: 0,
                    startDate,
                    endDate,
                    jql,
                    groupBy: "userView",
                    users: accountId ? [accountId] : undefined,
                    expand: ["AUTHOR"], // Include author details with avatars
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`JTTP API request failed: ${response.status} - ${text}`);
                throw new Error(`Request failed: ${response.status} - ${text}`);
            }

            const data = await response.json();
            console.log("JTTP API Response:", JSON.stringify(data, null, 2));
            return data;
        } catch (error) {
            console.error("Error fetching worklog summary:", error);
            throw error;
        }
    }

    /**
     * Calculate required work hours for a date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {number} expectedDailyHours - Expected daily hours (default 8)
     * @param {string[]} holidays - Array of holiday dates in YYYY-MM-DD format
     * @param {string[]} extraWorkdays - Array of extra workday dates in YYYY-MM-DD format
     * @returns {number} Required hours
     */
    calculateRequiredHours(startDate, endDate, expectedDailyHours = 8, holidays = [], extraWorkdays = []) {
        const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        let workdays = 0;

        for (let i = 0; i < totalDays; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + i);
            
            const dateStr = currentDate.toISOString().split("T")[0];
            const dayOfWeek = currentDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const isHoliday = holidays.includes(dateStr);
            const isExtraWorkday = extraWorkdays.includes(dateStr);

            if ((!isWeekend && !isHoliday) || isExtraWorkday) {
                workdays++;
            }
        }

        return workdays * expectedDailyHours;
    }

    /**
     * Get employee overtime data from JTTP API
     * @returns {Array} Array of employee objects with overtime calculations
     */
    async getEmployeeOvertimeData() {
        try {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const startDateStr = startOfYear.toISOString().split("T")[0];
            const endDateStr = now.toISOString().split("T")[0];

            console.log(`Fetching worklog data from ${startDateStr} to ${endDateStr}`);

            // Request summary — expand AUTHOR so JTTP returns avatar data within "user.avatar"
            const summaryData = await this.fetchWorklogSummary(startDateStr, endDateStr);

            if (!summaryData || !summaryData.userView || summaryData.userView.length === 0) {
                console.warn("No worklog data found in JTTP API response");
                return [];
            }

            console.log(`Found ${summaryData.userView.length} users in JTTP response`);

            const requiredHours = this.calculateRequiredHours(startOfYear, now, 8, [], []);

            const employees = summaryData.userView.map((userEntry) => {
                const user = userEntry.user || {};
                const totalLoggedSeconds = userEntry.totalLogged || 0;
                const totalLoggedHours = totalLoggedSeconds / 3600;

                // Avatar removed — return name only
                return {
                    id: user.id || user.accountId || "unknown",
                    name: user.name || user.displayName || "Unknown User",
                    totalHours: Math.round(totalLoggedHours * 100) / 100,
                    requiredHours: Math.round(requiredHours * 100) / 100,
                    overtime: Math.round((totalLoggedHours - requiredHours) * 100) / 100,
                    overtimePercentage: Math.round(((totalLoggedHours - requiredHours) / (requiredHours || 1)) * 10000) / 100,
                    billableHours: Math.round((userEntry.billableLoggedSeconds || 0) / 3600 * 100) / 100,
                    nonBillableHours: Math.round((userEntry.nonBillableLoggedSeconds || 0) / 3600 * 100) / 100,
                };
            });

            employees.sort((a, b) => b.overtime - a.overtime);

            console.log(`Successfully processed ${employees.length} employees`);
            return employees;
        } catch (error) {
            console.error("Error getting employee overtime data:", error);
            return [];
        }
    }

    /**
     * Get overtime summary statistics
     * @returns {Object} Summary statistics
     */
    async getOvertimeSummary() {
        try {
            const employees = await this.getEmployeeOvertimeData();

            if (employees.length === 0) {
                return {
                    totalEmployees: 0,
                    averageOvertime: 0,
                    totalOvertime: 0,
                    employeesWithOvertime: 0,
                    employeesWithUndertime: 0,
                };
            }

            const totalOvertime = employees.reduce((sum, emp) => sum + emp.overtime, 0);
            const averageOvertime = totalOvertime / employees.length;
            const employeesWithOvertime = employees.filter((emp) => emp.overtime > 0).length;
            const employeesWithUndertime = employees.filter((emp) => emp.overtime < 0).length;

            return {
                totalEmployees: employees.length,
                averageOvertime: Math.round(averageOvertime * 100) / 100,
                totalOvertime: Math.round(totalOvertime * 100) / 100,
                employeesWithOvertime,
                employeesWithUndertime,
            };
        } catch (error) {
            console.error("Error getting overtime summary:", error);
            return {
                totalEmployees: 0,
                averageOvertime: 0,
                totalOvertime: 0,
                employeesWithOvertime: 0,
                employeesWithUndertime: 0,
            };
        }
    }

    /**
     * Fetch system users from Jira (paginated)
     * Requires read:jira-user or appropriate scope in manifest
     */
    async getAllSystemUsers(maxResults = 1000) {
        try {
            // MUST use route`...` to satisfy Forge safe URL check
            const res = await api.asApp().requestJira(route`/rest/api/3/users/search?startAt=0&maxResults=${maxResults}`, {
                 method: "GET",
                 headers: {
                     "Accept": "application/json",
                 },
             });
             if (!res.ok) {
                 const txt = await res.text();
                 console.error("Failed to fetch system users:", res.status, txt);
                 return [];
             }
             const users = await res.json();
             // Normalize to minimal structure (avatar removed)
             return users.map(u => ({
                id: u.accountId || u.key || "unknown",
                name: u.displayName || u.name || "Unknown"
            }));
         } catch (err) {
             console.error("Error fetching system users:", err);
             return [];
         }
     }

    /**
     * Return all employees: merge system users with JTTP overtime results.
     * Users with no JTTP logs will have zero values.
     */
    async getAllEmployees() {
        try {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const startDateStr = startOfYear.toISOString().split("T")[0];
            const endDateStr = now.toISOString().split("T")[0];

            // JTTP data for the date range
            const jttp = await this.fetchWorklogSummary(startDateStr, endDateStr);
            const jttpMap = new Map();
            (jttp?.userView || []).forEach(u => {
                const id = u.user?.id || u.user?.accountId || u.user?.name;
                jttpMap.set(id, u);
            });

            // all system users from Jira
            const systemUsers = await this.getAllSystemUsers();

            // requiredHours same calculation as getEmployeeOvertimeData
            const requiredHours = this.calculateRequiredHours(startOfYear, now, 8, [], []);

            const employees = systemUsers.map(su => {
                const j = jttpMap.get(su.id);
                const totalLoggedSeconds = j ? (j.totalLogged || 0) : 0;
                const billableSeconds = j ? (j.billableLoggedSeconds || 0) : 0;
                const nonBillableSeconds = j ? (j.nonBillableLoggedSeconds || 0) : 0;
                const totalHours = Math.round((totalLoggedSeconds / 3600) * 100) / 100;
                const overtime = Math.round((totalHours - requiredHours) * 100) / 100;
                const overtimePercentage = requiredHours > 0 ? Math.round((overtime / requiredHours) * 10000) / 100 : 0;

                // Avatar removed — only include name
                return {
                    id: su.id,
                    name: su.name,
                    totalHours,
                    requiredHours: Math.round(requiredHours * 100) / 100,
                    overtime,
                    overtimePercentage,
                    billableHours: Math.round((billableSeconds / 3600) * 100) / 100,
                    nonBillableHours: Math.round((nonBillableSeconds / 3600) * 100) / 100,
                };
            });

            // optional: sort by overtime desc
            employees.sort((a, b) => b.overtime - a.overtime);

            return employees;
        } catch (err) {
            console.error("Error in getAllEmployees:", err);
            return [];
        }
    }
}

export const backendService = new BackendService();
