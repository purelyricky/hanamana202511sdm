import { makeResolver } from "@forge/resolver";
import { backendService } from "./BackendService";

export const resolver = makeResolver({
	writeText(request) {
		const { example } = request.payload;
		return backendService.getText(example);
	},
});
