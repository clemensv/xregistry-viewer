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

export interface DeprecatedInfo {
  reason?: string;
  alternative?: string;
  since?: string; // ISO date string
}

export interface CrossReference {
  grouptype: string;
  groupid: string;
  resourcetype?: string;
  resourceid?: string;
  versionid?: string;
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
  xid: string;
  name: string;
  description?: string;
  epoch?: string; // ETag-like mechanism for detecting modifications per xRegistry spec
  deprecated?: DeprecatedInfo; // Deprecation information per xRegistry spec
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
  epoch?: string; // ETag-like mechanism for detecting modifications per xRegistry spec
  deprecated?: DeprecatedInfo; // Deprecation information per xRegistry spec

  // Document representation fields
  resource?: any;
  resourceBase64?: string;
  resourceUrl?: string;

  // Version-specific fields
  versionId?: string;
  isDefault?: boolean;
  ancestor?: string; // Version ancestry per xRegistry spec
  compatibility?: string; // Version compatibility strategy per xRegistry spec
  compatibilityauthority?: string; // Authority for compatibility validation per xRegistry spec
  attributes?: any;

  // Cross-reference support per xRegistry spec
  xref?: CrossReference[];

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
