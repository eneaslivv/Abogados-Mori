

export type TenantID = string;
export type UserID = string;

// -- Enums --
export enum ClientType {
  INDIVIDUAL = 'Individual',
  COMPANY = 'Company',
}

export enum ContractStatus {
  DRAFT = 'Draft',
  IN_REVIEW = 'In Review',
  SIGNED = 'Signed',
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export enum TaskStatus {
  TODO = 'To Do',
  IN_PROGRESS = 'In Progress',
  ON_HOLD = 'On Hold',
  COMPLETED = 'Completed',
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  LAWYER = 'lawyer',
  PARALEGAL = 'paralegal',
  ASSISTANT = 'assistant',
}

// -- Entities --

export interface PermissionSet {
  can_view_all_documents: boolean;
  can_upload_documents: boolean;
  can_delete_documents: boolean;
  view_limited_documents: boolean; // If true, restricted to assigned clients
  access_contract_generator: boolean;
  access_style_training: boolean;
  access_contract_analysis: boolean;
  access_calendar: boolean;
  access_team_management: boolean;
  access_settings: boolean;
  access_finance: boolean;
}

export interface RoleSettings {
  id: string;
  tenant_id: TenantID;
  role_name: UserRole;
  permissions: PermissionSet;
}

export interface ClientEmployeeAccess {
  id: string;
  tenant_id: TenantID;
  client_id: string;
  user_id: UserID;
  created_at: string;
}

export interface User {
  id: UserID;
  tenant_id: TenantID;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Client {
  id: string;
  tenant_id: TenantID;
  created_by: UserID;
  full_name: string;
  email: string;
  phone: string;
  document_type: string; // DNI, CUIT, Passport
  document_number: string;
  
  // Extended Legal Details
  address?: string;
  city?: string;
  zip_code?: string;
  legal_representative?: string; // For companies (e.g. "Managing Partner")
  representative_dni?: string; // ID of the signer
  
  // Preferences
  default_contract_type?: string;
  default_context?: string;

  client_type: ClientType;
  notes: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface ClientDocument {
  id: string;
  tenant_id: TenantID;
  client_id: string;
  title: string;
  file_url: string; // Mock url
  file_type: string;
  uploaded_at: string;
}

export interface ContractCategory {
  id: string;
  tenant_id: TenantID;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentCategory {
  id: string;
  tenant_id: TenantID;
  name: string;
  created_at: string;
}

export interface Contract {
  id: string;
  tenant_id: TenantID;
  created_by: UserID;
  client_id: string;
  category_id?: string; // New field
  title: string;
  contract_type: string; // Service Agreement, etc. (Free text)
  status: ContractStatus;
  content: string; // Long text
  version_number?: number;
  parent_contract_id?: string;
  ai_prompt_used?: string;
  // In a real DB, this would be a vector type. Here we simulate it being "ready"
  fulltext_embedding_status?: 'pending' | 'ready'; 
  created_at: string;
  updated_at: string;
}

export interface ContractVersion {
    id: string;
    tenant_id: TenantID;
    contract_id: string;
    version_number: number;
    source: string;
    content: string;
    created_by: string;
    created_at: string;
}

// New Interface for Deep Analysis
export interface ContractAnalysis {
  id: string;
  contract_id: string;
  tenant_id: TenantID;
  summary: string;
  key_clauses: Array<{ title: string; content: string; type: 'standard' | 'unusual' }>;
  risks: Array<{ severity: 'High' | 'Medium' | 'Low'; description: string; clause_ref?: string }>;
  obligations: Array<{ party: 'Client' | 'Counterparty' | 'Both'; description: string }>;
  missing_clauses: Array<{ name: string; reason: string }>;
  recommended_changes: string;
  highlighted_variables: Array<{ label: string; value: string }>;
  created_at: string;
}

export interface ExternalContract {
    id: string;
    tenant_id: TenantID;
    file_name: string;
    extracted_text: string;
    analysis?: ContractAnalysis;
    created_at: string;
}

// Renamed/Extended from ExtractedDocument to Document for the new module
export interface Document {
  id: string;
  tenant_id: TenantID;
  uploaded_by: UserID;
  title: string;
  description?: string;
  file_url: string;
  extracted_text_raw: string;
  extracted_text_clean: string;
  document_type: 'contract' | 'DNI' | 'company_doc' | 'PDF' | 'other';
  linked_client_id?: string;
  linked_contract_id?: string;
  category_id?: string;
  tags?: string[];
  formatting_profile?: any;
  embedding_status: 'pending' | 'ready';
  created_at: string;
  updated_at: string;
}

// Keeping for backward compatibility if needed, but Document supersedes it
export type ExtractedDocument = Document; 

export interface ContractTrainingDocument {
  id: string;
  tenant_id: TenantID;
  uploaded_by: UserID;
  title: string;
  contract_type: string;
  category_id?: string;
  file_name: string;
  extracted_text: string;
  
  // New fields for enhanced analysis
  style_summary?: string; 
  tone_label?: string;
  
  created_at: string;
}

export interface ContractStyleProfile {
  id: string;
  tenant_id: TenantID;
  style_text: string;
  
  // Completeness Metrics (New)
  completeness_score?: number; // 0-100
  missing_elements?: string[]; // ["Payment Clauses", "Dispute Resolution"]
  suggestions?: string[]; // ["Upload an invoice", "Upload a service agreement"]
  
  updated_at: string;
}

export interface SubTask {
  id: string;
  title: string;
  is_completed: boolean;
}

export interface TaskComment {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  tenant_id: TenantID;
  assigned_to: UserID;
  related_client_id?: string;
  related_contract_id?: string;
  category_id?: string; // New field
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string;
  time_spent_minutes: number;
  subtasks?: SubTask[];
  comments?: TaskComment[];
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  tenant_id: TenantID;
  title: string;
  description: string;
  client_id?: string;
  contract_id?: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  location: string;
  event_type: 'Meeting' | 'Call' | 'Court' | 'Internal';
  source?: 'local' | 'google';
  created_at: string;
}

export interface Integration {
  id: string;
  tenant_id: TenantID;
  provider: 'google_calendar';
  is_connected: boolean;
  settings?: any;
  updated_at: string;
}