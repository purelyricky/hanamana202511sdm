import { makeResolver } from "@forge/resolver";
import { backendService } from "./BackendService";

export const resolver = makeResolver({
	writeText(request) {
		const { example } = request.payload;
		return backendService.getText(example);
	},

	/**
	 * Get employee overtime data
	 */
	getEmployeeOvertimeData() {
		return backendService.getEmployeeOvertimeData();
	},

	/**
	 * Get overtime summary statistics
	 */
	getOvertimeSummary() {
		return backendService.getOvertimeSummary();
	},
});
