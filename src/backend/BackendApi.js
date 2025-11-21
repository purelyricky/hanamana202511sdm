import { makeResolver } from "@forge/resolver";
import { backendService } from "./BackendService";

export const resolver = makeResolver({
	writeText(request) {
		const { example } = request.payload;
		return backendService.getText(example);
	},

	/**
	 * Get employee overtime data (async)
	 */
	async getEmployeeOvertimeData() {
		return await backendService.getEmployeeOvertimeData();
	},

	/**
	 * Get overtime summary statistics (async)
	 */
	async getOvertimeSummary() {
		return await backendService.getOvertimeSummary();
	},
});
