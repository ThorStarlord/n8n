export interface CredentialResolutionWarning {
	nodeName: string;
	credentialType: string;
	attemptedId: string | null | undefined;
	attemptedName: string | null | undefined;
	reason: 'not_found' | 'ambiguous_name';
}
