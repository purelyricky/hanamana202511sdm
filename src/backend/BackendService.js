class BackendService {
	getText(example) {
		return `This is text from the backend! You passed: ${example}`;
	}
}

export const backendService = new BackendService();
