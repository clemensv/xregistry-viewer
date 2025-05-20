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
  origin?: string; // API endpoint of origin
  [key: string]: any; // Index signature for dynamic property access
}

export interface ResourceDocument {
  // Common fields for both resources and versions
  id: string;
  name?: string;
  description?: string;
  createdAt?: string; // ISO date string
  modifiedAt?: string; // ISO date string

  // Document representation fields
  resource?: any;
  resourceBase64?: string;
  resourceUrl?: string;

  // Version-specific fields
  versionId?: string;
  isDefault?: boolean;
  attributes?: any;

  origin?: string; // API endpoint of origin

  // Index signature for dynamic property access
  [key: string]: any;
}

// Keep these for backward compatibility
export interface Resource extends ResourceDocument {}
export interface VersionDetail extends ResourceDocument {
  origin?: string; // API endpoint of origin
}

export interface Capabilities {
  apis: string[];
  schemas: string[];
  pagination: boolean;
}
