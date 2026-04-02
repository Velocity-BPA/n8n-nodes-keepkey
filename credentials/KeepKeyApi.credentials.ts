import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class KeepKeyApi implements ICredentialType {
	name = 'keepKeyApi';
	displayName = 'KeepKey API';
	documentationUrl = 'https://docs.shapeshift.com/';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'ShapeShift API key for KeepKey integration. Generate this in your ShapeShift developer settings.',
		},
		{
			displayName: 'API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.shapeshift.com/v1',
			required: true,
			description: 'Base URL for the ShapeShift API',
		},
	];
}