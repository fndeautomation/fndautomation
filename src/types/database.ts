export type UserRole = 'admin' | 'finance_officer' | 'director_pm';
export type UserStatus = 'pending' | 'active';
export type ProjectStatus = 'unassigned' | 'active' | 'on_hold' | 'completed';
export type MilestoneStatus = 'pending' | 'claim_submitted' | 'approved' | 'paid';
export type ClaimStatus = 'pending_review' | 'approved' | 'rejected';
export type NotificationType =
  | 'project_assigned'
  | 'claim_raised'
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_commented'
  | 'new_message';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  label: string;
  status: UserStatus;
  created_at: string;
}

export interface Project {
  id: string;
  short_id: string;
  name: string;
  total_value: number;
  status: ProjectStatus;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
}

export interface ProjectWithProfiles extends Project {
  created_by_profile?: Profile;
  assigned_to_profile?: Profile;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  percentage: number;
  value: number;
  status: MilestoneStatus;
  order_index: number;
  created_at: string;
}

export interface ProjectEngineer {
  id: string;
  project_id: string;
  engineer_name: string;
  engineer_role_tag: string;
  added_by: string;
  created_at: string;
}

export interface Claim {
  id: string;
  project_id: string;
  milestone_id: string;
  project_engineer_id: string;
  raised_by: string;
  status: ClaimStatus;
  amount: number;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface ClaimWithDetails extends Claim {
  milestone?: Milestone;
  engineer?: ProjectEngineer;
  raised_by_profile?: Profile;
  reviewed_by_profile?: Profile | null;
  project?: Project;
}

export interface ClaimComment {
  id: string;
  claim_id: string;
  author_id: string;
  comment: string;
  created_at: string;
  author?: Profile;
}

export interface ProjectInboxMessage {
  id: string;
  project_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender?: Profile;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  file_path: string;
  size: number;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface ProjectDocumentWithProfile extends ProjectDocument {
  uploaded_by_profile?: Pick<Profile, 'full_name' | 'label'>;
}

// Supabase Database type map for typed client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'> & { created_at?: string };
        Update: Partial<Omit<Profile, 'id'>>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'short_id' | 'created_at'> & {
          id?: string;
          short_id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Project, 'id' | 'short_id' | 'created_at'>>;
      };
      milestones: {
        Row: Milestone;
        Insert: Omit<Milestone, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Milestone, 'id' | 'project_id'>>;
      };
      project_engineers: {
        Row: ProjectEngineer;
        Insert: Omit<ProjectEngineer, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ProjectEngineer, 'id'>>;
      };
      claims: {
        Row: Claim;
        Insert: Omit<Claim, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<Claim, 'id' | 'created_at'>>;
      };
      claim_comments: {
        Row: ClaimComment;
        Insert: Omit<ClaimComment, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: never;
      };
      project_inbox_messages: {
        Row: ProjectInboxMessage;
        Insert: Omit<ProjectInboxMessage, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: never;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'is_read'> & {
          id?: string;
          created_at?: string;
          is_read?: boolean;
        };
        Update: Partial<Pick<Notification, 'is_read'>>;
      };
      project_documents: {
        Row: ProjectDocument;
        Insert: Omit<ProjectDocument, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ProjectDocument, 'id' | 'project_id' | 'created_at'>>;
      };
    };
    Functions: {
      get_my_role: { Args: Record<never, never>; Returns: string };
      generate_project_short_id: { Args: Record<never, never>; Returns: string };
    };
  };
}
