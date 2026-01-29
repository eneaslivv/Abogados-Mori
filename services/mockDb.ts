import { 
  ContractStyleProfile, 
  PermissionSet, 
  Integration, 
  Document, 
  UserRole
} from '../types';

class MockDatabase {
  private storage: Record<string, any[]> = {};

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const data = localStorage.getItem('legalflow_db');
    if (data) {
      this.storage = JSON.parse(data);
    } else {
        this.initializeDefaults();
    }
  }

  private saveToStorage() {
    localStorage.setItem('legalflow_db', JSON.stringify(this.storage));
  }

  initialize() {
      // Re-initialize if empty or force reset if needed
      if (Object.keys(this.storage).length === 0) {
          this.initializeDefaults();
      }
  }
  
  private initializeDefaults() {
      this.storage = {
          clients: [],
          contracts: [],
          tasks: [],
          users: [
              { id: 'user-1', name: 'Juan Perez', email: 'juan@example.com', role: UserRole.LAWYER, tenant_id: 'demo', created_at: new Date().toISOString() }
          ],
          events: [],
          client_documents: [],
          contract_categories: [
              { id: 'cat-juicios', name: 'Juicios', description: 'Demandas, procesos judiciales, escritos', tenant_id: 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 'cat-familia', name: 'Derecho de Familia', description: 'Régimen de comunicación, tenencia, guarda', tenant_id: 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 'cat-divorcios', name: 'Divorcios', description: 'Divorcio, separación, convenio regulador', tenant_id: 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 'cat-alimentos', name: 'Alimentos', description: 'Cuota alimentaria, manutención', tenant_id: 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 'cat-sucesiones', name: 'Sucesiones', description: 'Herencia, declaratoria, testamento', tenant_id: 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              { id: 'cat-corporativo', name: 'Corporativo / Contratos', description: 'Derecho corporativo general', tenant_id: 'demo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          ],
          document_categories: [
              { id: 'doc-cat-1', name: 'Evidencia', tenant_id: 'demo', created_at: new Date().toISOString() },
              { id: 'doc-cat-2', name: 'Identificacion', tenant_id: 'demo', created_at: new Date().toISOString() },
              { id: 'doc-cat-3', name: 'Financiero', tenant_id: 'demo', created_at: new Date().toISOString() }
          ],
          documents: [],
          training_docs: [],
          style_profiles: [],
          contract_versions: [],
          contract_analyses: [],
          extracted_documents: [],
          integrations: [
              { id: 'int-1', tenant_id: 'demo', provider: 'google_calendar', is_connected: false, updated_at: new Date().toISOString() }
          ],
          roles_settings: [
              { 
                  id: 'role-1', 
                  tenant_id: 'demo', 
                  role_name: UserRole.LAWYER, 
                  permissions: {
                    can_view_all_documents: true,
                    can_upload_documents: true,
                    can_delete_documents: true,
                    view_limited_documents: false,
                    access_contract_generator: true,
                    access_style_training: true,
                    access_contract_analysis: true,
                    access_calendar: true,
                    access_team_management: true,
                    access_settings: true,
                    access_finance: true
                  }
              }
          ]
      };
      this.saveToStorage();
  }

  getAll<T>(collection: string): T[] {
      return (this.storage[collection] || []) as T[];
  }

  getOne<T extends { id: string }>(collection: string, id: string): T | undefined {
      const list = this.getAll<T>(collection);
      return list.find(item => item.id === id);
  }

  create<T extends { id?: string }>(collection: string, item: T): T {
      if (!this.storage[collection]) this.storage[collection] = [];
      const newItem = { ...item, id: item.id || Math.random().toString(36).substr(2, 9) };
      this.storage[collection].push(newItem);
      this.saveToStorage();
      return newItem as T;
  }

  update<T extends { id: string }>(collection: string, id: string, updates: Partial<T>): T {
      if (!this.storage[collection]) return {} as T; 
      const index = this.storage[collection].findIndex((i: any) => i.id === id);
      if (index === -1) {
          return {} as T;
      }
      
      const updatedItem = { ...this.storage[collection][index], ...updates };
      this.storage[collection][index] = updatedItem;
      this.saveToStorage();
      return updatedItem;
  }

  delete(collection: string, id: string) {
      if (!this.storage[collection]) return;
      this.storage[collection] = this.storage[collection].filter((i: any) => i.id !== id);
      this.saveToStorage();
  }
  
  // Specific Methods

  getUserPermissions(): PermissionSet {
      // Mock for current user 'user-1' who is a LAWYER
      const userRole = this.storage['users']?.[0]?.role || UserRole.LAWYER;
      const roleSettings = this.storage['roles_settings']?.find((r: any) => r.role_name === userRole);
      
      if (roleSettings) return roleSettings.permissions;

      // Fallback
      return {
          can_view_all_documents: true,
          can_upload_documents: true,
          can_delete_documents: true,
          view_limited_documents: false,
          access_contract_generator: true,
          access_style_training: true,
          access_contract_analysis: true,
          access_calendar: true,
          access_team_management: true,
          access_settings: true,
          access_finance: true
      };
  }

  getContractStyleProfile(): ContractStyleProfile | undefined {
    const profiles = this.getAll<ContractStyleProfile>('style_profiles');
    return profiles.length > 0 ? profiles[0] : undefined;
  }

  saveContractStyleProfile(data: Partial<ContractStyleProfile>) {
    let profiles = this.getAll<ContractStyleProfile>('style_profiles');
    if (profiles.length > 0) {
        this.update<ContractStyleProfile>('style_profiles', profiles[0].id, data);
    } else {
        this.create('style_profiles', { ...data, tenant_id: 'demo', updated_at: new Date().toISOString() } as any);
    }
  }
  
  getIntegration(provider: string): Integration | undefined {
      return this.getAll<Integration>('integrations').find(i => i.provider === provider);
  }
  
  setIntegration(provider: string, isConnected: boolean) {
      const existing = this.getIntegration(provider);
      if (existing) {
          this.update<Integration>('integrations', existing.id, { is_connected: isConnected, updated_at: new Date().toISOString() });
      } else {
          this.create('integrations', { provider, is_connected: isConnected, tenant_id: 'demo', updated_at: new Date().toISOString() } as any);
      }
  }

  getDocumentsForUser(): Document[] {
      return this.getAll<Document>('documents');
  }

}

export const db = new MockDatabase();
