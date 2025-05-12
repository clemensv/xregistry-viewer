export interface RegistryModel {
  specversion: string;
  registryid: string;
  name: string;
  description: string;
  capabilities: {
    apis: string[];
    schemas: string[];
    pagination: boolean;
  };
  groups: {
    [groupType: string]: GroupType;
  };
}

export interface GroupType {
  plural: string;
  singular: string;
  description: string;
  resources: {
    [resourceType: string]: ResourceType;
  };
  attributes?: {
    [key: string]: {
      type: string;
      description?: string;
      required?: boolean;
      default?: any;
      readonly?: boolean;
      item?: any; // For nested attributes like arrays or objects
      attributes?: { [key: string]: any }; // For nested objects
    };
  };
}

export interface ResourceType {
  plural: string;
  singular: string;
  description: string;
  maxversions: number;
  hasdocument: boolean;
  attributes?: {
    [key: string]: {
      type: string;
      description?: string;
      required?: boolean;
      default?: any;
      readonly?: boolean;
      item?: any; // For nested attributes like arrays or objects
      attributes?: { [key: string]: any }; // For nested objects
    };
  };
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  serverscount?: number; // Added to support displaying server count
  [key: string]: any; // Index signature for dynamic property access
}

export interface Resource {
  id: string;
  name: string;
  description?: string;
  createdAt?: string; // ISO date string
  modifiedAt?: string; // ISO date string
  [key: string]: any; // Index signature for dynamic property access
}

export interface VersionDetail {
  id: string;
  attributes: any;
  document?: string;
  // Document representations when using $details
  resource?: any;
  resourceBase64?: string;
  resourceUrl?: string;
  [key: string]: any; // Index signature to allow dynamic property access
}

export interface Capabilities {
  apis: string[];
  schemas: string[];
  pagination: boolean;
}
