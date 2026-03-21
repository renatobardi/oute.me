declare global {
	interface CredentialResponse {
		credential: string;
		select_by: string;
		clientId: string;
	}

	interface PromptMomentNotification {
		isDisplayMoment: () => boolean;
		isDisplayed: () => boolean;
		isNotDisplayed: () => boolean;
		getNotDisplayedReason: () => string;
		isSkippedMoment: () => boolean;
		getSkippedReason: () => string;
		isDismissedMoment: () => boolean;
		getDismissedReason: () => string;
	}

	interface IdConfiguration {
		client_id: string;
		callback: (response: CredentialResponse) => void;
		auto_select?: boolean;
		cancel_on_tap_outside?: boolean;
		use_fedcm_for_prompt?: boolean;
		itp_support?: boolean;
		context?: 'signin' | 'signup' | 'use';
	}

	interface Google {
		accounts: {
			id: {
				initialize: (config: IdConfiguration) => void;
				prompt: (momentListener?: (notification: PromptMomentNotification) => void) => void;
				cancel: () => void;
				renderButton: (parent: HTMLElement, options: object) => void;
			};
		};
	}

	interface Window {
		google: Google;
	}
}

export {};
