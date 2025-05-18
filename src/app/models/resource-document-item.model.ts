export interface ResourceDocumentItem {
  key: string;
  value: any;
  description?: string;
  type?: string;
  itemModel?: {
    type: string;
    attributes?: { [key: string]: any };
    item?: any; // For nested arrays or maps
  };
  isExpanded?: boolean;
}
